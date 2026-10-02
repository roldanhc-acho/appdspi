# Database Query & Execution Optimization

> Diagnose bottlenecks, resolve N+1 patterns, eliminate implicit planner penalties, and execute deterministic, high-throughput queries across SQL, ORM, and RLS-protected layers.

---

## 1. The N+1 Problem & High-Latency Traversal

The N+1 problem occurs when an application executes 1 initial query to fetch a parent dataset, followed by $N$ secondary queries to retrieve related records. On mobile or distributed backends, this amplifies latency across network boundaries and exhausts connection pools.

```text
What is N+1?
├── 1 query to retrieve parent entities (e.g., 100 orders)
├── N queries executed in a loop for child relations (100 customer lookups)
└── Total: 101 round-trips (High latency, connection saturation)
```

### Remediation Strategies
* **Relational `JOIN`**: Flattens parent and child entities into a single round-trip query.
* **ORM Eager Loading**: Instructs the ORM to prefetch relations using a single `WHERE IN (...)` or `LEFT JOIN` instead of lazy resolution on property access.
* **GraphQL DataLoader / Batch Loaders**: Batches discrete field resolver calls into a single deferred array query, caching identical keys within the tick/request lifecycle.
* **Set-Based Subqueries**: Aggregates related IDs in an array/set subquery instead of executing row-correlated subselects.

---

## 2. Query Analysis Mindset (`EXPLAIN ANALYZE`)

Never optimize based on intuition. Always measure planning time, execution time, and buffer cache hits under realistic concurrent volume.

```sql
-- PostgreSQL / Supabase: Profiling real execution metrics
EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE)
SELECT * FROM public.documents WHERE account_id = 'c1a2b3c4-0000-0000-0000-000000000000';
```

### Key Execution Plan Red Flags

| Plan Indicator | Root Cause | Direct Fix |
| :--- | :--- | :--- |
| **`Seq Scan` (Sequential Scan)** | Full table scan; table lacks an index matching the predicate or cardinality is extremely low. | Create a B-Tree index on filtered, joined, or ordered columns. |
| **`Rows Removed by Filter` is High** | The database engine read thousands of rows from disk/memory only to discard them post-filter. | Replace with a more selective index or composite index matching the exact query filter. |
| **Estimated vs. Actual Row Discrepancy** | Outdated table statistics mislead the query planner into picking sub-optimal scan paths. | Run `ANALYZE target_table;` to refresh optimizer metadata. |
| **`SubPlan` inside Loop Nodes** | Correlated subqueries or RLS functions executing imperatively per inspected row. | Wrap the call in `(SELECT fn())` (InitPlan) or refactor into set operations. |
| **High `Buffers: read=` vs. `hit=`** | Query is fetching cold data directly from physical disk instead of Shared Buffers. | Add covering indexes (`INCLUDE`) to facilitate Index-Only Scans. |

---

## 3. RLS Performance Optimization (The Hidden Multiplier)

When Row Level Security (RLS) is enabled, security policies act as implicit `WHERE` clauses automatically appended to every query plan. Naive RLS rules introduce massive $O(N)$ execution penalties.

```sql
-- SLOW: auth.uid() evaluates imperatively for EVERY row inspected
CREATE POLICY "slow_documents" ON public.documents 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id); -- ~171 ms execution on 100k rows

-- FAST: Scalar subquery triggers PostgreSQL's InitPlan caching
CREATE POLICY "fast_documents" ON public.documents 
  FOR SELECT TO authenticated 
  USING ((SELECT auth.uid()) = user_id); -- <0.1 ms execution (>1700x speedup)
```

### Critical RLS Rules:

1. **InitPlan Subquery Caching**: Always wrap dynamic session primitives (`auth.uid()`, `auth.jwt()`) in `(SELECT ...)`.
2. **Directional Join Inversion**: Avoid checking if an outer column matches a subquery row-by-row; retrieve the authorized key set once:
```sql
-- FAST: Set-based lookup
USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = (SELECT auth.uid())));
```
*(Benchmark: ~9,000 ms drops to ~20 ms, a 450x speedup).*

3. **Encapsulate Multi-Table Joins in `SECURITY DEFINER`**:
For complex RBAC policies, route lookups through functions marked `SECURITY DEFINER` and annotated as `STABLE` with `SET search_path = ''`. The `STABLE` annotation allows the engine to cache evaluation within the transaction.

4. **Explicit Application-Level Filters**:
Do not rely solely on implicit RLS for filtering. Providing explicit client parameters (e.g., `.eq('account_id', id)`) alongside RLS allows the optimizer to execute direct index scans instead of broad index ranges.

---

## 4. Architectural Pagination: Cursor Seek vs. Offset Degradation

Unbounded collection responses cause memory exhaustion and denial-of-wallet spikes. Choosing the right pagination pattern directly dictates query planner efficiency.

```text
Offset-Based Pagination (?offset=100000&limit=20):
├── Algorithm: Scans and discards N records before extracting result set
├── Performance: O(N) execution degradation as offset depth increases
└── Data Drift: High risk of duplicate or skipped records during concurrent writes

Cursor-Based / Keyset Pagination (?cursor=eyJjcmVhdGVkX2F0Ijoi...):
├── Algorithm: B-Tree index seek directly to the anchor boundary
├── Performance: O(1) constant seek time regardless of dataset size
└── Data Drift: Immune to concurrent write offsets; anchors to stable record key
```

### Deterministic Keyset Implementation

Never rely on timestamps alone for cursor boundaries (concurrent inserts share identical clock ticks, resulting in missed rows). Always append a unique tie-breaker:

```sql
-- Query: Fetch next 20 items after cursor (last_seen_created_at, last_seen_id)
SELECT id, title, created_at
FROM public.feed_items
WHERE tenant_id = 'c1a2...' 
  AND (created_at, id) < ('2026-09-27T12:00:00Z', '8f2a91c3-...')
ORDER BY created_at DESC, id DESC
LIMIT 20;

-- Backed by the corresponding composite B-tree index:
CREATE INDEX ix_feed_cursor ON public.feed_items (tenant_id, created_at DESC, id DESC);
```

---

## 5. Prioritized Optimization Hierarchy

Execute query optimizations in strict order of return on investment (ROI):

1. **Eliminate Full Table Scans (`Seq Scan`)**:
Add B-Tree indexes to all foreign keys, tenant predicates (`tenant_id`), join keys, and RLS evaluation columns.

2. **Optimize Policy Evaluation**:
Wrap RLS auth functions in scalar subqueries `(SELECT auth.uid())` and convert correlated join subqueries into `STABLE SECURITY DEFINER` functions.

3. **Transition to Cursor-Based Seek Pagination**:
Replace `OFFSET / LIMIT` on large datasets (>10k rows) with deterministic keyset filtering (`WHERE (sort_col, id) < (cursor_col, cursor_id) LIMIT K`).

4. **Constrain Projection (`SELECT` Projections)**:
Never use wildcard `SELECT *`. Request only required attributes to allow **Index-Only Scans** (via `INCLUDE` clauses) and reduce network serialization overhead.

5. **Enforce Transaction-Level Advisory Locks for Append-Only Contention**:
For linear streams and hash-chained audit rows (HMAC-SHA256), prevent race forks and lock contention by acquiring tenant-level advisory locks (`pg_advisory_xact_lock(hashtext(...))`) prior to querying head records.

6. **Multi-Layer Caching**:
* *HTTP Layer*: Edge CDN caching using `stale-while-revalidate` for non-personalized responses.
* *Application Layer*: Distributed key-value caches (Redis) for high-frequency, expensive aggregate computations.

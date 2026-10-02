# High-Performance Indexing Principles

> Optimize data access patterns, enforce multi-tenant isolation, and eliminate query planner bottlenecks without incurring write-amplification or lock contention.

---

## 1. When to Create Indexes

```text
Index these:
├── Columns evaluated in WHERE clauses & JOIN conditions
├── Foreign key references & cascade constraints (e.g., account_id, team_id)
├── Deterministic sort columns in ORDER BY
├── Opaque cursor keys (cursor-based pagination seek points)
├── Row Level Security (RLS) predicates (tenant_id, user_id)
└── Monotonically increasing ledger sequences & hash anchors (prev_hash)

Don't over-index:
├── Low-cardinality attributes without partial filters (e.g., raw boolean status flags)
├── Volatile, high-write tables where B-Tree page splits degrade insert throughput
├── Redundant composite prefixes (an index on (A, B) already covers queries filtering solely on A)
└── Unfiltered NULL values on optional attributes
```

---

## 2. Advanced Multi-Tenant & RLS Indexing Patterns

Row Level Security (RLS) policies act as implicit filtering predicates injected by the query planner into every statement. Without dedicated B-Tree index coverage, the planner falls back to sequential table scans on every row comparison.

### Target Multi-Tenant Predicates and Foreign Keys
```sql
-- Explicitly index foreign keys and RLS lookup columns
CREATE INDEX ix_documents_user_id 
  ON public.documents USING btree (user_id);

CREATE INDEX ix_account_memberships_account_user 
  ON public.account_memberships USING btree (account_id, user_id);
```

### The RLS InitPlan Index Handshake

An unindexed policy condition evaluated per row turns $O(1)$ lookups into $O(N)$ nested loops:

* Direct function invocations in policies (e.g., `auth.uid() = user_id`) evaluate imperatively for each candidate row.
* Wrapping the identity check in a scalar subquery `(SELECT auth.uid()) = user_id` triggers PostgreSQL's **InitPlan** cache.
* Pairing `(SELECT auth.uid())` with a B-Tree index on `user_id` drops execution time from **~171 ms to <0.1 ms** (>1700x speedup).

---

## 3. Cursor Pagination & Seek Optimization

Offset-based pagination (`OFFSET N LIMIT M`) degrades to $O(N)$ sequential scan overhead at high offsets because the engine must scan and discard $N$ rows prior to returning results. High-concurrency mobile interfaces mandate deterministic cursor-based seek lookups ($O(1)$ index seek complexity).

```sql
-- Efficient deterministic cursor seek pattern:
-- Query: WHERE tenant_id = ? AND (created_at, id) < (cursor_timestamp, cursor_uuid)
--        ORDER BY created_at DESC, id DESC LIMIT 20;

CREATE INDEX ix_feed_items_cursor 
  ON public.feed_items USING btree (tenant_id, created_at DESC, id DESC);
```

* **Tie-Breaker Column**: Always append the unique primary key (`id`) to the sort attribute (`created_at`) in both the index and query. This guarantees deterministic ordering and prevents data drift (skipped or duplicated rows) during concurrent writes.

---

## 4. Cryptographic Ledger & Audit Stream Indexing

In append-only, tamper-evident ledgers (HMAC-SHA256 chains), verification workers and sequence monitors require targeted access to chain boundaries:

```sql
-- Monotonic sequence and tenant isolation index
CREATE INDEX ix_audit_ledger_stream_seq 
  ON public.audit_log USING btree (tenant_id, created_at ASC, id ASC);

-- Enforce strictly one event following any predecessor (prevents chain forks)
-- Note: Genesis must be 32 zero bytes (not NULL) so the UNIQUE index covers the root.
CREATE UNIQUE INDEX uq_audit_ledger_prev_hash 
  ON public.audit_log (prev_hash);
```

---

## 5. Index Type Selection Matrix

| Type | Primary Access Patterns & Strengths | Operational Limitations & Trade-offs | Use Case Fit |
| :--- | :--- | :--- | :--- |
| **B-tree** | Default for equality (`=`), inequality (`<`, `<=`, `>`, `>=`), and range searches. Supports sort ordering and composite prefix traversal. | Write amplification on frequent updates and page splits. | Primary keys, RLS user/tenant IDs, foreign keys, monotonic sequences, and cursor tokens. |
| **Hash** | Exact equality lookups (`=`) only. Slightly more compact for wide scalar strings. | No range queries, cannot satisfy `ORDER BY` or multi-column composite structures. | Point-lookup caches and discrete state lookup keys. |
| **GIN** (Generalized Inverted Index) | Deep JSONB key/value querying (`@>`, `?`, `?\|`), arrays, and full-text search. | Slower write/update times; larger disk footprint than B-tree. | Document stores, tag filters, full-text catalog search. |
| **GiST** (Generalized Search Tree) | Geometric objects, multi-dimensional ranges, network addresses, exclusion constraints (`EXCLUDE`). | Slower build times and lossy index structures requiring re-checks. | Time-range overlaps, booking schedule collisions, and geospatial bounding boxes. |
| **BRIN** (Block Range Index) | Huge, append-only physical datasets ordered naturally by insertion time (e.g., historical audit logs, telemetry). | Ineffective for unsorted or heavily mutated data. | Multi-gigabyte audit archives and chronological telemetry partitioned by date. |
| **HNSW / IVFFlat** (`pgvector`) | Vector similarity distance calculations ($L2$, Cosine, Inner Product). | High memory requirements during build; IVFFlat requires periodic retraining as datasets expand. | RAG embedding retrieval, semantic search, and AI agent memory stores. |

---

## 6. Composite Index Design Principles

### The Equality-First Ordering Rule

Place attributes matching exact equality (`=`) at the leading edge of the composite index, followed by columns subject to range operations or sorting:

```text
Composite Key Layout:
[ Equality Columns ] ──> [ Range / Comparison Columns ] ──> [ ORDER BY / Cursor Keys ]
```

* **Leftmost Prefix Requirement**: An index on `(tenant_id, status, created_at)` accelerates queries filtering on:
  - `WHERE tenant_id = ?`
  - `WHERE tenant_id = ? AND status = ?`
  - `WHERE tenant_id = ? AND status = ? AND created_at > ?`
  - *It will NOT accelerate:* `WHERE status = ?` or `WHERE created_at > ?` without the leading `tenant_id` prefix.

### Partial & Covering Indexes

Reduce index bloat and avoid table heap lookups:

```sql
-- Partial Index: Indexes only active records, ignoring high-volume archive data
CREATE INDEX ix_orders_unprocessed 
  ON public.orders (created_at) 
  WHERE status = 'pending';

-- Covering Index (Index-Only Scan): Attaches payload data to index leaf nodes
CREATE INDEX ix_memberships_covering 
  ON public.account_memberships USING btree (account_id, user_id) 
  INCLUDE (account_role);
```

---

## 7. Diagnostic & Verification Queries

Inspect index utilization and query plans before promoting schema changes to production:

```sql
-- 1. Simulate authenticated RLS context and verify Index Scan vs. Seq Scan
SET session role authenticated;
SET request.jwt.claims TO '{"role":"authenticated", "sub":"00000000-0000-0000-0000-000000000000"}';

EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT * FROM public.documents WHERE account_id = 'c1a2b3c4-0000-0000-0000-000000000000';

RESET session role;

-- 2. Detect missing indexes on Foreign Keys and RLS joins
SELECT 
    conrelid::regclass AS table_name,
    conname AS foreign_key_name,
    pg_get_constraintdef(c.oid) AS constraint_def
FROM pg_constraint c
WHERE contype = 'f' 
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i 
    WHERE i.indrelid = c.conrelid 
      AND i.indkey[0] = c.conkey[1]
  );
```

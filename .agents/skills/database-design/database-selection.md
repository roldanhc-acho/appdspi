# Database & Persistence Architecture Selection

> Choose storage and persistence based on isolation guarantees, latency constraints, access patterns, and security boundaries — not defaults.

---

## Decision Tree
```text
What are your architectural & storage requirements?
│
├── Client / Edge / Local Persistence (Offline-First & SSOT)
│   ├── Native Mobile (Android/iOS)
│   │   ├── Structured relational / SSOT → Room (SQLite) / CoreData
│   │   └── Key-Value / Preferences → DataStore / Keychain / Keystore (Hardware-backed)
│   ├── Web / Progressive Web Apps (PWA)
│   │   ├── High-throughput binary IO / SQLite WASM → OPFS (Origin Private File System via Dedicated Worker)
│   │   └── Asset & API Shell Caching → Cache API (Service Worker: Stale-While-Revalidate / Cache-First)
│   └── Edge Serverless (Ultra-low latency / Read replicas)
│       └── Turso (libSQL/Edge SQLite), Cloudflare D1
│
├── Server / Cloud Relational (Full ACID, Normalization & RLS)
│   ├── Self-Hosted / Complex Joins / Extensibility → PostgreSQL (vanilla)
│   ├── Serverless Scaling / Branching Workflows → Neon
│   └── BaaS / Realtime / Direct Client API via PostgREST → Supabase (PostgreSQL + RLS + GoTrue)
│
├── Serverless NoSQL / Document Store
│   └── Realtime Sync / Rapid Prototyping → Cloud Firestore / Firebase RTDB (CEL Security Rules)
│
├── Compliance, Regulatory & Tamper-Evident Ledger
│   └── Cryptographic Audit Trail → PostgreSQL (Append-Only + HMAC-SHA256 Chaining + pg_advisory_xact_lock) + WORM S3/GCS
│
└── Vector Search & AI Pipelines
    ├── Integrated Relational + Vectors → PostgreSQL + pgvector
    └── Standalone Vector Engine → Qdrant, Pinecone, Milvus
```

---

## Comparison Matrix

| Engine / Target | Best For | Architecture & Performance Pros | Critical Trade-offs & Security Rules |
| :--- | :--- | :--- | :--- |
| **PostgreSQL (Self-hosted)** | Relational 3NF/BCNF schemas, complex joins, cryptographic triggers. | Full engine control, native B-Tree indexing, procedural logic (PL/pgSQL), advisory locks. | Requires infrastructure management, connection pooling configuration (PgBouncer), and manual replication. |
| **Supabase (Managed PG)** | Multi-tenant SaaS, direct client-to-DB access, realtime events. | Native Row-Level Security (RLS), built-in Auth, PostgREST automatic endpoints. | **Mandatory:** Enable RLS on every public table (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Wrap auth in `(SELECT auth.uid())` to prevent $O(N)$ row-evaluation and index all policy columns. Never expose `service_role` in client. |
| **Neon** | Ephemeral preview environments, CI branch testing, serverless autoscaling. | Instant DB branching via copy-on-write, scales to zero. | Cold start latencies on inactive branches; pooling required for high-frequency stateless connections. |
| **Room / Local SQLite (Mobile)** | Native Mobile Offline-First Single Source of Truth (SSOT). | $O(1)$ fast local reads, zero latency UI binding via observable types (`Flow`), background sync via WorkManager. | Single-writer limitations; requires migration scripts and explicit conflict resolution strategies (e.g., *Last-Write-Wins*). |
| **OPFS + WASM SQLite (PWA)** | Web apps requiring native-like disk IO and relational client storage. | Bypasses main-thread serialization via `FileSystemSyncAccessHandle` in Dedicated Workers; persistent mode available. | Asynchronous messaging boundary (`postMessage`) from UI; not accessible from window context. |
| **Turso (Edge libSQL)** | Distributed edge reads, local-first embedded replicas. | Microsecond read latency close to user, multi-region replication. | SQLite dialect limits; cross-region write latency to primary node. |
| **Cloud Firestore / Firebase** | Hierarchical document sync, mobile live feeds. | Out-of-the-box offline cache, real-time reactive listeners, automated horizontal scale. | Authorization enforced via path-based CEL rules (not SQL); expensive/inefficient joins require denormalization; high costs on high read/write churn. |

---

## Architectural & Security Decision Rules

### 1. Client-Side Persistence (Offline-First)
* **Mobile SSOT**: UI and Domain layers must never read directly from the network. The local database (Room/SQLite) is the Single Source of Truth (SSOT). All network reads update the local DB; UI observes the DB through reactive flows.
* **Write Strategies**:
  * *Online-only*: For transient analytics or non-critical logs.
  * *Lazy Writes*: Write locally first, queue via persistent background workers (WorkManager / Background Tasks) with exponential backoff.

### 2. Multi-Tenancy & Authorization (RLS Protocols)
* **Zero-Trust Client Access**: If client applications communicate directly with the database engine (e.g., Supabase / PostgREST), Row Level Security (RLS) is non-negotiable on 100% of tables.
* **Policy Optimization Rule**:
  * *Anti-Pattern*: `USING (auth.uid() = user_id)` (causes function re-evaluation per row, turning 10k rows into 10k subqueries).
  * *Optimized Pattern*: `USING ((SELECT auth.uid()) = user_id)` (triggers PostgreSQL `InitPlan` to evaluate and cache the scalar UUID once per statement).
  * *Complex Joins*: Encapsulate cross-table checks in `SECURITY DEFINER` routines marked as `STABLE` with explicit `SET search_path = ''`.
  * *Index Mandate*: Every foreign key and column evaluated inside an RLS expression must carry a dedicated B-Tree index.

### 3. High-Assurance Auditing (Append-Only Ledgers)
* Regular tables with `UPDATE` or `DELETE` triggers fail regulatory audits because database superusers or compromised credentials can rewrite history without trace.
* When audit integrity or legal compliance (SOC 2, ISO 27001, HIPAA) is required:
  * Structure tables as **HMAC-SHA256 Hash Chains** where row $i$ includes the cryptographic hash of row $i-1$.
  * Acquire tenant-level advisory locks (`pg_advisory_xact_lock`) before reading chain heads to prevent concurrent write forks.
  * Block mutations using database rules (`CREATE RULE ... DO INSTEAD NOTHING`) and statement-level triggers blocking `TRUNCATE`.
  * Export historical partitions (>90 days) to Write-Once-Read-Many (WORM) storage (AWS S3 Object Lock / GCS Bucket Lock).

---

## Diagnostic Questions to Ask

1. **Client & Offline Context**:
   - Does the app need to function seamlessly in airplane mode or unstable connections? *(If yes → Local SQLite/Room as SSOT + sync engine)*.
   - Is it a PWA requiring heavy local data processing? *(If yes → OPFS with SQLite WASM in a Web Worker)*.
2. **Access Model & Perimeter**:
   - Will client apps query the database directly via REST/GraphQL/SDKs? *(If yes → PostgreSQL with RLS and InitPlan optimization, or Firebase with Security Rules)*.
   - Will all database calls go through a custom backend API? *(If yes → PostgreSQL/MySQL normalized to 3NF/BCNF behind DTOs and API gateways)*.
3. **Data Integrity & Traceability**:
   - Does the application process financial transactions, sensitive permissions, or medical data? *(If yes → Implement tamper-evident HMAC-SHA256 hash-chained ledger tables)*.
4. **Query & Ingestion Profile**:
   - Are read queries deeply relational with multiple joins? *(Avoid NoSQL/Document DBs; use relational PG with appropriate composite indexing)*.
   - Is low-latency distributed global read access needed? *(Evaluate Turso or edge read replicas)*.

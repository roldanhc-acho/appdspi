# Database Client & ORM/Data-Mapper Selection

> Choose database drivers, ORMs, and query builders based on target execution runtime, boundary isolation (FCIS), N+1 prevention, and security constraints (Row-Level Security & Parameterization) — not syntactic defaults.

---

## 1. Context Decision Tree

```text
What is your runtime environment & execution model?
│
├── Native Mobile Client (Offline-First / SSOT)
│   ├── Android (Kotlin) → Room (SQLite) + Flow (Single Source of Truth)
│   ├── iOS (Swift) → SwiftData / CoreData + @Observable
│   └── Cross-Platform / React Native (0.76+ Bridgeless) → Turbo Modules + Nitro/C++ SQLite bindings
│
├── Web / Progressive Web App (PWA)
│   └── High-throughput client storage → WASM SQLite over OPFS (FileSystemSyncAccessHandle in Web Worker)
│
├── Cloud Server / Microservices Backend
│   ├── Edge / Serverless (Cloudflare Workers, Cloud Functions, Vercel Edge)
│   │   ├── TypeScript / Zero Cold-Start → Drizzle ORM (SQL-like, minimal footprint)
│   │   └── Low-Latency Distributed Replicas → Kysely / Drizzle + libSQL (Turso) / Neon Serverless
│   ├── Enterprise / Complex Domain / Schema Governance
│   │   ├── TypeScript Developer Experience → Prisma ORM (Schema-first, automated migrations, Prisma Studio)
│   │   ├── High Performance + Direct SQL Precision → Kysely (Type-safe SQL builder, zero bloat)
│   │   └── Python Async Ecosystem → SQLAlchemy 2.0 (Core + ORM, full async session support)
│   └── Multi-Tenant Data Protection (PostgreSQL / Supabase RLS)
│       └── PostgREST / Supabase Client or Typed SQL with explicit parameterization (Enforcing RLS + InitPlan)
```

---

## 2. Comprehensive Comparison Matrix

| Technology | Architectural Fit | Strengths & Security | Trade-offs & Critical Vulnerabilities |
| :--- | :--- | :--- | :--- |
| **Room / Local SQLite** | Mobile Native (Android) Offline-First SSOT. | Compile-time SQL validation, native coroutines/`Flow` reactivity, zero network latency. | Schema migrations require explicit scripts; single-writer limits. Must sit in Data Layer. |
| **Drizzle ORM** | Edge Serverless & Node.js runtimes. | Lightweight, near-zero startup overhead, raw SQL similarity, native prepared statements against SQL injection. | Newer ecosystem; relational queries require explicit configuration; manual index optimization needed. |
| **Prisma ORM** | Rapid prototyping, monolithic backends. | Intuitive modeling DSL, declarative migrations, automated relations. | Engine binary payload (unsuitable for edge/low-memory limits); lazy relation queries risk latent N+1 execution. |
| **Kysely** | Node.js / Bun / Cloudflare Workers. | Zero runtime bloat, end-to-end type safety, native composite keys and cursor pagination support. | Requires manual migration tooling; developers write explicit SQL idioms. |
| **SQLAlchemy 2.0** | Python microservices & data backends. | Robust Unit of Work, full async I/O, explicit join strategies, enterprise relationship control. | High complexity; misconfigured relationships easily trigger silent N+1 query cascades. |
| **Raw SQL (Prepared Statements)** | Cryptographic ledgers, complex analytics, PL/pgSQL triggers. | Absolute query control, native advisory locks (`pg_advisory_xact_lock`), zero abstraction overhead. | Manual type mapping; vulnerable to SQL injection if parameters are concatenated instead of parameterized. |

---

## 3. Critical Architectural & Operational Directives

### 1. N+1 Problem Prevention
ORMs often abstract object relationships via lazy property loading, silently triggering $1$ parent query followed by $N$ secondary child queries:
* **Eager Loading Mandate**: Always enforce explicit `JOIN` / `include` prefetching in ORM configs instead of relying on property access inside iteration loops.
* **GraphQL / API Boundary**: When ORMs back API resolvers, use **DataLoaders** to batch and cache discrete identifier lookups into unified `WHERE id IN (...)` array queries.

### 2. Multi-Tenancy & Row-Level Security (RLS) Alignment
When using ORMs or direct query clients over multi-tenant PostgreSQL (e.g., Supabase):
* **InitPlan Caching**: When constructing RLS policies for ORM tables, wrap dynamic identity functions in scalar subqueries `((SELECT auth.uid()) = user_id)` to prevent $O(N)$ row-by-row function execution.
* **Application-Level Filtering**: Never rely solely on RLS policies to constrain result sets. Always pass explicit tenant/user parameters in ORM query builders (e.g., `.where('tenant_id', '=', tenantId)`) to allow the planner to utilize B-Tree indexes directly.
* **Foreign Key Indexing**: Ensure all columns referenced in ORM relations and cascade rules carry explicit database B-Tree indexes.

### 3. Functional Core Separation (Clean Code & Boundaries)
* **Persistence Ignorance**: In Clean Architecture / FCIS, ORM entities (Prisma models, Room `@Entity`, SQLAlchemy models) belong strictly to the **Data Layer / Imperative Shell**.
* **No Leaky Models**: Never pass ORM model classes into the pure domain core or UI presentation layers. Convert database records into validated, immutable Value Objects via domain mappers at repository boundaries.

---

## 4. Selection Diagnostic Checklist

1. **Target Environment**:
   - Running inside a mobile application? $\rightarrow$ Choose **Room (Android)** or **SwiftData (iOS)** as the Single Source of Truth.
   - Running on an edge worker (Cloudflare/Vercel Edge)? $\rightarrow$ Choose **Drizzle** or **Kysely**.
   - Traditional Node.js/TypeScript server? $\rightarrow$ Choose **Prisma** (for DX) or **Kysely** (for raw SQL control).
2. **Access Security & Isolation**:
   - Accessing multi-tenant tables directly via client SDKs? $\rightarrow$ Ensure engine supports PostgreSQL RLS with `(SELECT auth.uid())` subqueries.
   - Are queries parameterized? $\rightarrow$ Never concatenate raw variables; mandate prepared statement interfaces to prevent SQL injection vulnerabilities.
3. **Pagination & Query Profile**:
   - Does the client support infinite feeds or real-time streams? $\rightarrow$ Avoid offset/limit; ensure the ORM/query builder cleanly supports **cursor seek queries** `(WHERE (sort_col, id) < (cursor_val, cursor_id))`.

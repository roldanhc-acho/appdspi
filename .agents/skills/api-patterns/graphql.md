---
name: graphql-principles
description: High-performance, secure GraphQL schema and runtime design principles. Enforces depth and complexity ceilings, N+1 elimination via DataLoaders, Relay cursor connections, per-field zero-trust authorization, and federated schema governance.
when_to_use: "Mandatory when designing, implementing, auditing, or securing GraphQL APIs, subgraphs, resolvers, and Backend-For-Frontend (BFF) layers."
allowed-tools: Read, Write, Edit
version: 3.0.0
priority: CRITICAL
---

# GraphQL Architecture & Security Engineering Principles

> Balance client flexibility and declarative querying with strict server-side resource predictability, resolver performance, and zero-trust data protection.

---

## 1. Protocol Selection: GraphQL vs. REST vs. gRPC

GraphQL is not a universal replacement for REST; it is an interface style optimized for heterogeneous clients with complex, graph-like data requirements:

```text
What is your consumer profile and data access geometry?
│
├── Mixed / Heterogeneous Clients (Mobile + Web + Backoffice)
│   ├── Differing field density & bandwidth constraints → ✅ GraphQL (Eliminates over-fetching)
│   └── Backends for Frontends (BFF) aggregating multiple upstream microservices → ✅ GraphQL
│
├── Public Partner APIs / Third-Party Integration
│   └── Standard HTTP caching, OpenAPI 3.1 & SDK generation mandatory → ❌ REST (OpenAPI 3.1)
│
├── Service-to-Service Internal Communication
│   └── Ultra-low latency (<10ms), binary serialization, streaming → ❌ gRPC (HTTP/2 + Protobuf)
│
└── File Uploads & Binary Payloads
    └── Heavy multipart stream handling → ❌ REST / Pre-signed Object Storage URLs
```

### Architectural Comparison

| Protocol | Best For | Strengths | Trade-offs & Bottlenecks |
| :--- | :--- | :--- | :--- |
| **GraphQL** | Bandwidth-constrained mobile apps, dynamic multi-client UIs, aggregated BFF layers. | Exact field selection, single round-trip nested retrieval, strong type system. | Difficult HTTP edge caching (single POST endpoint), vulnerable to nested DoS, resolver N+1 queries. |
| **REST (OAS 3.1)** | Public platforms, universal client SDKs, CRUD operations. | Native HTTP caching (`Cache-Control`, `ETag`), standard status codes, horizontal scale. | Can cause over-fetching and under-fetching, requires multiple network round-trips. |
| **gRPC** | Internal synchronous microservice meshes. | Sub-10ms latency, Protobuf binary compression, streaming. | Incompatible with direct browser clients, payloads are not human-readable. |

---

## 2. Schema Design & Evolution Standards

### 1. Think in Graphs and Client Capabilities, Not Database Tables
* **No Leaky Models**: Never map raw database tables 1:1 to GraphQL types. Types must reflect domain concepts and client jobs-to-be-done.
* **Specific Mutation Inputs**: Design mutations with a single, dedicated input object (e.g., `UpdateOrderInput`) returning a structured payload (`UpdateOrderPayload`) that includes the mutated entity and user-facing error arrays.
* **Thoughtful Nullability**: 
  - Non-nullable (`!`) fields should only be used when a value is guaranteed to exist under all runtime conditions.
  - Use nullable fields for sub-resources so that resolver errors can degrade gracefully without collapsing the entire response tree.

### 2. Additive Evolution Over Versioning
GraphQL APIs should avoid URL version paths (such as `/v1/graphql`). Treat the schema as an evolvable graph:
* **Additive Changes**: Add new fields or optional inputs without deleting existing definitions.
* **The `@deprecated` Directive**: Annotate legacy fields with `@deprecated(reason: "Use newField instead")`. Monitor field usage in telemetry before removing any deprecated field.

---

## 3. Cursor Pagination: The Relay Connection Standard

Collection queries must never return unbounded lists. Use the standard Relay Cursor Connection specification backed by deterministic index keyset seeks:

```graphql
type Query {
  orders(first: Int = 20, after: String): OrderConnection!
}

type OrderConnection {
  edges: [OrderEdge!]!
  pageInfo: PageInfo!
  totalCount: Int # Optional: avoid if calculating count causes expensive DB scans
}

type OrderEdge {
  cursor: String! # Opaque, deterministic token (e.g., base64(createdAt + id))
  node: Order!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

* **Tie-Breaker Rule**: The underlying database cursor must bundle the sort key alongside a unique tie-breaker (e.g., primary key UUID) to prevent skipped records under high-frequency writes.

---

## 4. Resolver Performance & The N+1 Solution

Naive resolver implementations trigger a recursive $O(N)$ database query explosion (e.g., fetching 100 orders results in 100 individual customer queries):

```text
[ Client Query: orders -> customer ]
                │
                ▼
[ Execute orders Query ] ──> 1 DB Query (Returns 100 rows)
                │
                ▼
[ Resolve customer for each ] ──> 100 Sequential DB Queries! ❌ (N+1 Bottleneck)
```

### The DataLoader Pattern

Wrap child resolvers in a request-scoped **DataLoader** that collates individual ID lookups during an event loop tick and dispatches a single batch query:

```typescript
// Request-scoped batch loader
const customerLoader = new DataLoader<string, Customer>(async (customerIds) => {
  // Dispatches: SELECT * FROM customers WHERE id = ANY($1)
  const customers = await db.customers.findByIds(customerIds);
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  return customerIds.map((id) => customerMap.get(id) ?? null);
});

// Resolver delegates directly to the loader
const resolvers = {
  Order: {
    customer: (order, _, { loaders }) => loaders.customer.load(order.customerId),
  },
};
```

---

## 5. Security & Resource Protection (OWASP API Top 10)

GraphQL's flexible query execution opens unique attack surfaces mapped to OWASP API Security:

```text
GraphQL Threat Landscape:
├── API4: Unrestricted Resource Consumption
│   ├── Deeply nested queries (DoS via recursive graph loops)
│   ├── High query complexity (expensive joins and computational exhaustion)
│   └── Batching and alias abuse (amplifying request load inside a single HTTP call)
├── API1: Broken Object Level Authorization (BOLA)
│   └── Resolvers failing to verify tenant/user ownership on child nodes
├── API3: Broken Object Property Level Authorization (BOPLA)
│   └── Introspection and excessive property exposure in public types
└── API2: Broken Authentication
    └── Bypassing edge rate limits by bundling multiple operations into a single batch
```

### Defensive Controls Matrix

| Defense Mechanism | Operational Configuration | Attack Vector Mitigated |
| :--- | :--- | :--- |
| **Max Query Depth** | Enforce a strict tree-depth ceiling (e.g., max depth = 6). | Prevents nested loop bombs (e.g., `user -> posts -> author -> posts`). |
| **Query Cost Analysis** | Assign cost points to fields and connections (e.g., scalar = 1, connection = 10 * `first`). Reject queries over budget before execution. | Computational DoS and database memory exhaustion. |
| **Disable Introspection** | Set `introspection: false` in production; block `__schema` and `__type` queries. | Reconnaissance, internal schema leakage, and shadow field discovery. |
| **Persisted Queries (PQL)** | Whitelist known query hashes on the server. Clients submit only `queryId` instead of arbitrary query strings. | Eliminates ad-hoc malicious queries; restores HTTP GET caching at CDN edge. |
| **Batching / Alias Limits** | Cap maximum multiplexed queries per request (e.g., max 5) and restrict repetitive alias operations. | Gateway rate limit bypass and brute-force amplification attacks. |

### Per-Field Authorization (Zero-Trust Resolvers)

Never rely solely on edge gateway authentication. Enforce authorization at the field and resolver level using domain context:

```typescript
const resolvers = {
  User: {
    ssn: (user, _, ctx) => {
      // Step-up authentication or strict privilege check
      if (ctx.currentUser.id !== user.id && !ctx.currentUser.roles.includes('COMPLIANCE_ADMIN')) {
        throw new GraphQLError('Forbidden: Insufficient privileges for sensitive attribute.', {
          extensions: { code: 'FORBIDDEN', http: { status: 403 } },
        });
      }
      return user.ssn;
    },
  },
};
```

---

## 6. Enterprise Federation & Supergraph Governance

In distributed systems, microservices expose federated subgraphs unified through a gateway router:

* **Entity Ownership**: An entity is defined in its primary subgraph and extended across others using declarative directives (e.g., `@key(fields: "id")`).
* **Schema Registry Validation**: Use a CI schema check pipeline to validate that subgraph changes compose cleanly into the supergraph without breaking consumers.
* **Router Gateway**: Use dedicated low-latency query plan routers (such as Apollo Router or WunderGraph Cosmo) to optimize inter-service calls across subgraphs.

---

## 7. Operational & Security Verification Checklist

* [ ] **Depth Limiter Active**: Requests exceeding the configured nesting limit are terminated during validation.
* [ ] **Complexity Budget Enforced**: Queries calculate costs upfront and reject execution if limits are exceeded.
* [ ] **N+1 Eliminated**: Child resolvers are backed by request-scoped DataLoaders.
* [ ] **Introspection Disabled in Production**: `__schema` queries return errors for public clients.
* [ ] **Field-Level Access Control**: Sensitive fields assert caller scopes and resource ownership before resolving.
* [ ] **Deterministic Pagination**: Collection connections utilize Relay-compliant cursors with primary key tie-breakers.
* [ ] **Persisted Queries Implemented**: Clients use pre-registered query hashes for production traffic.

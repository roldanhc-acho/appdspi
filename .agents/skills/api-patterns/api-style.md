---
name: api-style-selection
description: Architectural decision framework for selecting API communication protocols (REST, GraphQL, tRPC, gRPC, WebSockets, AsyncAPI). Evaluates consumer boundaries, data topology, type safety, caching, performance, and OWASP API security trade-offs.
when_to_use: "Mandatory when architecting new network boundaries, decomposing microservices, selecting Backend-For-Frontend (BFF) layers, or choosing integration interfaces between clients and servers."
allowed-tools: Read, Write, Edit
version: 3.0.0
priority: CRITICAL
---

# API Style & Communication Protocol Selection

> Choose network communication protocols based on consumer profiles, execution topology, caching requirements, boundary isolation, and security constraints — not habitual defaults. Most production platforms in 2026 deploy a hybrid architecture combining multiple complementary styles.

---

## 1. Context Decision Tree

```text
Who are your primary API consumers & what are their network constraints?
│
├── Public Partners / Multi-Platform Third Parties / External Devs
│   └── REST + OpenAPI 3.1 (Full JSON Schema 2020-12, universal compatibility, HTTP edge caching)
│
├── Mixed Clients with Divergent, Nested Data Needs (Mobile + Web + Admin)
│   ├── Complex client-specified graph queries → GraphQL (Eliminates over/under-fetching via BFF)
│   └── Heterogeneous apps needing strict RPC verbs → REST (OpenAPI 3.1)
│
├── TypeScript Full-Stack Monorepo (Next.js / Turborepo / Expo)
│   ├── Shared language across frontend & backend → tRPC (Zero-drift inference, zero codegen)
│   └── Standalone native mobile clients outside monorepo → REST (OpenAPI 3.1) or GraphQL
│
├── Ultra-Low Latency Internal Communication (<10ms)
│   └── Microservice-to-microservice synchronous mesh → gRPC (HTTP/2 + Protocol Buffers binary serialization)
│
├── Real-Time Bidirectional Streaming / Collaborative State
│   └── Persistent client-server push (live feeds, chats, gaming) → WebSockets
│
└── Asynchronous Workflows / Decoupled Systems / Long-Running Tasks
    ├── Event-driven message brokers (Kafka, RabbitMQ, EventBridge) → AsyncAPI
    └── Outbound partner push notifications → Webhooks (HMAC-SHA256 signature signed)
```

---

## 2. Protocol Comparison Matrix

| Architectural Factor | REST (OpenAPI 3.1) | GraphQL | tRPC | gRPC | WebSockets / AsyncAPI |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Sweet Spot** | Public APIs, SaaS integrations, CRUD services. | Bandwidth-limited mobile apps, dynamic dashboards. | Full-stack TypeScript monorepos & internal tools. | Synchronous inter-service microservice backbones. | Real-time bidirectional streaming, pub/sub events. |
| **Data Fetching Precision** | Fixed resource schemas; prone to over/under-fetching. | Exact client-specified field selection (zero over-fetching). | Procedure-defined output types (parse-don't-validate). | Fixed schema contracts compiled via `.proto`. | Push-driven event payloads. |
| **Type Safety & Contracts** | Machine-readable OpenAPI 3.1 (JSON Schema 2020-12). | Strictly typed GraphQL SDL schema. | Automatic end-to-end inference from server router. | Strongly typed Protocol Buffers. | Message-level AsyncAPI schemas. |
| **Caching Mechanics** | Native HTTP edge & proxy caching (`Cache-Control`, `ETag`). | Complex (most queries route over single HTTP POST). | Client runtime caching (TanStack / React Query). | Gateway or in-memory application caches only. | Stateful; manual client-side cache stores. |
| **Latency & Wire Overhead** | Moderate; JSON text serialization over HTTP/1.1–3. | Moderate; JSON text queries & responses. | Moderate; serialized JSON payloads over HTTP. | Extremely low; binary serialization, HTTP/2 multiplexing. | Low; persistent full-duplex TCP framing. |
| **Tooling & DX** | Swagger UI, Redoc, automatic SDK generators. | GraphiQL, Apollo Studio, GraphQL Code Generator. | Instant IDE autocompletion; zero compile build step. | `protoc` compiler, Buf, Postman gRPC. | AsyncAPI Studio, MQTT/WebSocket clients. |

---

## 3. Protocol Strengths, Bottlenecks & Security Mitigations

### 1. REST (Representational State Transfer) with OpenAPI 3.1
* **When to Choose:** Public APIs, developer platforms, standard CRUD operations, or architectures relying on edge/CDN caching.
* **Core Rules:**
  - Structure URIs around resources (nouns), never actions: `GET /v1/orders`, `POST /v1/orders` (Avoid: `/createOrder`).
  - Use semantic HTTP methods: `GET` (safe/idempotent), `POST` (create), `PUT` (full replace), `PATCH` (partial), `DELETE` (idempotent).
  - Emit machine-readable OpenAPI 3.1 specifications with complete JSON Schema 2020-12 validation and RFC 9457 error formats.
* **Security & Failure Surface (OWASP API Top 10):**
  - **BOLA (API1):** Enforce strict server-side resource ownership validation (`user_id == session.user_id`) in every controller.
  - **BOPLA (API3):** Use explicit DTO allow-lists; never deserialize input directly into database models.

### 2. GraphQL
* **When to Choose:** Dynamic multi-client frontends where mobile and web clients demand radically different field representations from a unified Backend-For-Frontend (BFF).
* **Core Rules:**
  - Treat schema changes additively; phase out legacy attributes via `@deprecated(reason: "...")` instead of URL versioning.
  - Implement Relay-compliant cursor connections (`edges`, `node`, `pageInfo`) with deterministic database keyset seeks.
  - Eliminate the resolver $N+1$ problem using request-scoped DataLoaders to batch database queries.
* **Security & Failure Surface (OWASP API Top 10):**
  - **Resource Consumption (API4):** Set strict max query depth limits (e.g., $\le 6$) and calculate query complexity scores before execution to prevent nested DoS attacks.
  - **Introspection Abuse (API9):** Disable schema introspection (`__schema`, `__type`) in production to prevent complete schema reconnaissance.

### 3. tRPC
* **When to Choose:** Green-field web and mobile applications operating in an end-to-end TypeScript monorepo (e.g., Next.js, Turborepo, Expo).
* **Core Rules:**
  - Export only router types (`type AppRouter`) to frontend client packages to prevent server runtime or database secret leakage.
  - Enforce runtime schema parsing using Zod or Valibot on every procedure input to eliminate runtime type mismatches and mass assignment.
  - Keep resolvers as thin adapters of the **Imperative Shell**; delegate all calculations to an isolated, pure **Functional Core**.

### 4. gRPC (Google Remote Procedure Call)
* **When to Choose:** Internal synchronous microservices requiring high throughput, low CPU overhead, and strict sub-10ms response times.
* **Core Rules:**
  - Version contracts inside Protocol Buffer namespaces (`package orders.v1;`).
  - Enforce Mutual TLS (mTLS) for zero-trust identity between microservices.
* **Trade-offs:** Poor browser support (requires gRPC-Web proxying); binary payloads cannot be easily inspected or debugged in plain network proxies without tooling.

### 5. WebSockets & AsyncAPI
* **When to Choose:** Real-time push requirements (collaboration tools, real-time tracking, chat) or event-driven distributed architectures.
* **Core Rules:**
  - Enforce connection authentication during the initial handshake (using verified JWTs or session cookies).
  - Document asynchronous channels, topics, message schemas, and retry semantics using the **AsyncAPI** specification.

---

## 4. Hybrid Production Architecture Standard

Production architectures in 2026 avoid picking a single style for all boundaries:

```text
[ External Consumers & Mobile Apps ]     [ Partner Integrations ]     [ Web Browser (Monorepo) ]
│                                   │                           │
▼                                   ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Public Edge API Gateway                              │
│               (TLS 1.3, Rate Limiting, OpenAPI 3.1)                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┴──────────────────────────────────────┐
▼                                                                             ▼
[ REST / OpenAPI 3.1 ]                                                 [ GraphQL / BFF ]
│                                                                             │
└──────────────────────┬──────────────────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────────────────────┐
│                              Internal Mesh                                  │
│                       (mTLS + gRPC Protocol Buffers)                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┴──────────────────────────────────────┐
▼                                                                             ▼
( Order Microservice )                                         ( Inventory Microservice )
│                                                                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
                           [ Kafka / AsyncAPI Broker ]
```

---

## 5. Architectural Diagnostic Checklist

Ask these 5 questions before locking in an API communication protocol:

1. **Who is consuming the contract?**
   - External developers or public partners? $\rightarrow$ **REST + OpenAPI 3.1**.
   - Internal full-stack TypeScript team? $\rightarrow$ **tRPC**.
   - Polyglot internal microservices? $\rightarrow$ **gRPC**.
2. **What is the data access profile?**
   - High nesting with varying client-selected fields? $\rightarrow$ **GraphQL**.
   - Predictable CRUD resources? $\rightarrow$ **REST**.
3. **What are the network and caching constraints?**
   - Edge CDN caching and minimal bandwidth overhead? $\rightarrow$ **REST** (via `Cache-Control` / `ETag`).
   - Low mobile roundtrips over cellular connections? $\rightarrow$ **GraphQL**.
4. **Is communication synchronous or asynchronous?**
   - Synchronous request-response? $\rightarrow$ **REST / GraphQL / gRPC**.
   - Continuous bidirectional updates? $\rightarrow$ **WebSockets**.
   - Asynchronous decoupled worker tasks? $\rightarrow$ **AsyncAPI / Event-Driven Queues**.
5. **How is security audited?**
   - Are schemas mapped to automated contract testing (Schemathesis, Dredd) against OWASP API Security Top 10 vulnerabilities?

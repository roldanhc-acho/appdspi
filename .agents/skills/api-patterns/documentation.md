---
name: api-documentation-principles
description: High-impact API documentation and developer experience (DX) standards. Enforces OpenAPI 3.1 contract-first specifications, interactive developer portals, AI-agent discovery (llms.txt), RFC 9457 error catalogs, and zero-drift CI/CD governance.
when_to_use: "Mandatory when authoring, reviewing, automating, or auditing API documentation, OpenAPI/AsyncAPI specifications, developer portals, SDK guides, and AI agent consumption interfaces."
allowed-tools: Read, Write, Edit
version: 3.0.0
priority: CRITICAL
---

# API Documentation & Developer Experience (DX) Principles

> The best API in the world with poor documentation is a closed door. High-impact documentation serves as the primary user interface and contract of your system, reducing Time-To-First-Call (TTFC) from hours to minutes for both human developers and autonomous AI agents.

---

## 1. Documentation as a Design Deliverable (Contract-First)

Documentation is not an afterthought written post-deployment; it is authored and reviewed before implementation begins.

```text
Contract-First Lifecycle:
[ OpenAPI 3.1 Design Draft ] ──> [ Peer & Consumer Review ]
              │
              ▼
[ Ephemeral Mock Servers (Prism) ] ──> [ Frontend/Mobile Parallel Build ]
              │
              ▼
[ Implementation & CI Linting (Spectral) ] ──> [ Automated Docs & SDK Publishing ]
```

* **Single Source of Truth**: The OpenAPI/AsyncAPI specification is the canonical reference. Interactive documentation portals, client SDKs, mock servers, and contract verification tests must generate directly from the spec to prevent documentation drift.
* **No Raw Database Model Leakage**: Document DTOs (Data Transfer Objects) that model client domain jobs. Never document or expose internal database tables directly.
* **Mandatory U.S. English**: All path parameters, properties, query attributes, and descriptive texts must be authored in clear, consistent U.S. English.

---

## 2. OpenAPI 3.1 Specification Essentials

OpenAPI 3.1 aligns natively with the **JSON Schema 2020-12** dialect, providing complete schema validation parity:

| Specification Feature | Implementation Requirement | Operational Rationale |
| :--- | :--- | :--- |
| **JSON Schema 2020-12** | Use full dialect keywords (`prefixItems`, `pattern`, `unevaluatedProperties`). | Unifies backend runtime validators (e.g., Zod, JSONSchema) with the API contract. |
| **Nullable Handling** | Use `type: ["string", "null"]` instead of 3.0 `nullable: true`. | Follows strict JSON Schema type arrays without vendor-specific extensions. |
| **Rich Semantic Descriptions** | Explain the *purpose*, business role, and relational dependencies of every attribute. | Enables human developers and autonomous AI agents to construct valid queries and reason about effects. |
| **Real Request/Response Examples** | Define comprehensive `examples` on every operation (happy path and failure cases). | Provides instant copy-paste fixtures and hydrates interactive API consoles. |
| **Webhook Definitions** | Model asynchronous outbound events under the root `webhooks:` object. | Documents callback signatures and HMAC-SHA256 signature verification headers in the same portal. |

```yaml
# OpenAPI 3.1 snippet demonstrating production standards
paths:
  /v1/workspaces/{workspace_id}/orders:
    get:
      summary: Retrieve paginated customer orders
      description: Returns a reverse-chronological stream of sales orders for the specified workspace using deterministic keyset seek pagination.
      operationId: listWorkspaceOrders
      parameters:
        - name: workspace_id
          in: path
          required: true
          description: Unique identifier of the parent workspace.
          schema:
            type: string
            format: uuid
            example: "c1a2b3c4-0000-0000-0000-000000000000"
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: cursor
          in: query
          required: false
          description: Opaque pagination cursor retrieved from previous meta.next_cursor.
          schema:
            type: string
            example: "ZXlKaGJHY2lPaUpTVXpVeE5pSXNJblI1Y0NJNklrcFhWQ0o5..."
      responses:
        '200':
          description: A paginated collection of orders.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/OrderCollectionEnvelope'
        '401':
          $ref: '#/components/responses/UnauthorizedProblem'
        '403':
          $ref: '#/components/responses/ForbiddenProblem'
        '429':
          $ref: '#/components/responses/RateLimitProblem'
```

---

## 3. Core Anatomy of a High-Impact Developer Portal

A complete developer portal must provide the following standard resources:

```text
Documentation Information Architecture:
├── 1. Getting Started (< 5-Minute "Hello World")
│   ├── Step-by-step account onboarding and sandbox access
│   └── Copy-paste request yielding a successful 200/201 call in under 5 minutes
├── 2. Authentication & Authorization Manual
│   ├── Token lifecycle diagrams (OAuth 2.1 PKCE flows, Refresh Token rotation)
│   └── Required permissions and scope breakdown per endpoint
├── 3. Complete Reference & Interactive API Console
│   ├── Live "Try-It" explorer executing requests against sandbox mock engines
│   └── Idiomatic code samples in at least 4 languages (TypeScript, Python, Go, Kotlin)
├── 4. Standardized Error Catalog (RFC 9457)
│   ├── Comprehensive mapping of machine-readable error codes (code)
│   └── Diagnostic guides explaining root causes and remediation hints
├── 5. Quotas, Rate Limiting & Network Guidance
│   ├── Documented tiered thresholds (Anonymous vs. Authenticated vs. Premium)
│   └── Gateway response headers (RateLimit-* and Retry-After)
└── 6. Versioning, Deprecation & Sunset Lifecycle
    ├── Formal RFC 8594 Sunset and Deprecation response header policies
    └── Transparent changelog highlighting breaking vs. additive revisions
```

---

## 4. Designing Documentation for AI Agents (`llms.txt`)

Autonomous AI coding agents consume documentation alongside human software engineers. Serving raw, heavy HTML documentation wastes context window tokens and degrades comprehension.

* **Standard Discovery Endpoints**: Serve discoverable documentation files at root paths:
  * `/llms.txt`: Curated Markdown summary specifying core capabilities, authentication mechanics, and critical endpoints.
  * `/llms-full.txt`: Consolidated raw Markdown documentation of the complete API surface.
  * `/openapi.json` or `/openapi.yaml`: Raw OpenAPI 3.1 specification linked directly from `llms.txt`.
* **Content Negotiation**: Support `Accept: text/markdown` headers on documentation endpoints to strip client-side styling, JavaScript scripts, and HTML wrappers, returning pure Markdown directly.
* **Language-Filtered Scopes**: Allow agents to request language-scoped documentation endpoints (e.g., `/llms-full.txt?lang=python`) to eliminate irrelevant language examples and optimize context consumption.

---

## 5. Machine-Readable Error Documentation (RFC 9457)

Eliminate ad-hoc error descriptions. Every non-2xx status code must be documented with an explicit RFC 9457 `application/problem+json` response schema:

```json
{
  "type": "https://api.domain.com/errors/resource-not-found",
  "title": "Resource Not Found",
  "status": 404,
  "code": "ORDER_NOT_FOUND",
  "detail": "The requested order 'ord_9901' does not exist in workspace 'ws_123'.",
  "instance": "/v1/workspaces/ws_123/orders/ord_9901",
  "trace_id": "req_01HPX7K0M8B2D5QZ87X6"
}
```

* **The Troubleshooting Matrix**: Maintain a documented lookup table mapping every machine-readable `code` (e.g., `INSUFFICIENT_FUNDS`, `RATE_LIMIT_EXCEEDED`) to potential triggers and exact remediation actions.
* **Redact Stack Traces**: Explicitly state and verify that documentation and live error responses never expose internal database models, file paths, or raw stack traces.

---

## 6. Automated Governance & Anti-Drift CI Pipeline

Docs must be tested with the same rigor as production application code:

```text
[ Git Commit ] ──> [ Spectral Schema Linter ] (Enforces casing, descriptions, examples)
                          │
                          ▼
                   [ OAS Diff / Breaking Change Detector ] (Fails on unversioned breaks)
                          │
                          ▼
                   [ Schemathesis / Dredd Contract Tests ] (Validates runtime against spec)
                          │
                          ▼
                   [ Artifact Build ] ──> Publishes Docs Hub, SDKs, and llms.txt
```

### Critical Verification Rules:

1. **No Untyped or Empty Parameters**: Schemas with missing descriptions, missing property formats, or raw `type: object` without defined properties are blocked in CI.
2. **Deterministic Enums**: Explicitly document enumeration ranges using open-ended example arrays for fields likely to expand in future additive releases.
3. **Deprecation Warnings**: Every deprecated endpoint or parameter must declare `deprecated: true` in the specification and document the targeted `Sunset` date and migration alternative.

---

## 7. Documentation Readiness Checklist

Before publishing or approving an API release, verify:

* [ ] **Contract Version**: Authored in valid OpenAPI 3.1 with complete JSON Schema 2020-12 data typing.
* [ ] **Time-To-First-Call**: Getting Started tutorial verified to produce a successful call within 5 minutes.
* [ ] **Authentication Fully Documented**: Token headers (`Authorization: Bearer <token>`), refresh flows, and scopes explicitly defined.
* [ ] **Realistic Examples**: Valid request payloads and real response examples supplied for every route (2xx and 4xx/5xx).
* [ ] **RFC 9457 Errors Covered**: All anticipated error statuses (400, 401, 403, 404, 409, 422, 429, 500) documented with standard problem attributes.
* [ ] **Rate Limiting Details**: Quotas, tiers, and response headers (`RateLimit-Limit`, `RateLimit-Remaining`, `Retry-After`) explicitly detailed.
* [ ] **AI-Ready Endpoints**: Machine-readable `/openapi.json` and `/llms.txt` endpoints generated and served at canonical paths.
* [ ] **Zero Drift Verification**: Specification matches actual runtime behavior via automated contract testing (Schemathesis/Dredd).

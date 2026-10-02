---
name: api-security-testing
description: Adversarial & contract-based API security testing standards. Enforces OWASP API Security Top 10 (2023/2026 active standard), multi-tenant RLS isolation, OAuth 2.1 PKCE, DTO mass-assignment prevention, and automated CI DAST/SAST validation.
when_to_use: "Mandatory when evaluating, auditing, or penetration-testing API endpoints, microservices, GraphQL, gRPC, and cloud serverless boundaries."
allowed-tools: Read, Write, Edit, Bash
version: 3.0.0
priority: CRITICAL
---

# API Security Testing & Adversarial Verification

> Rigorous verification of machine-to-machine boundaries, object-level authorization, and contract conformance. Verify like an attacker: automated scanners achieve breadth, but manual and multi-role adversarial testing uncover business-logic and authorization flaws.

---

## 1. OWASP API Security Top 10 Testing Matrix

The 2023 edition remains the active baseline. Authorization failures represent over 40% of critical incidents and dominate the list:

| Category | Primary Threat & Weakness | Adversarial Test Objective | Detection Method |
| :--- | :--- | :--- | :--- |
| **API1: BOLA** | Broken Object Level Authorization (IDOR). Missing server-side ownership verification. | Manipulate object IDs in URL/body (`/orders/{id}`) across tenant and user session boundaries. | Multi-role DAST, matrix replays (User A vs. User B). |
| **API2: Broken Auth** | Flawed token lifecycle, missing rotation, weak credential enforcement. | Exploit `alg:none`, key injection, token re-use post-logout, brute-force login endpoints. | Fuzzing auth flows, credential stuffing simulations. |
| **API3: BOPLA** | Mass assignment & excessive data exposure. Returning raw DB models. | Inject unlisted properties (`isAdmin`, `role`, `balance`) via POST/PATCH; inspect JSON payloads for PII. | Contract assertion against OpenAPI 3.1 schema. |
| **API4: Resource Consumption** | Denial of Service (DoS) and Denial of Wallet via unbounded queries. | Send unbounded batch queries, nested payloads, high pagination limits (`?limit=100000`). | Concurrency fuzzing, quota and throttling audits. |
| **API5: BFLA** | Broken Function Level Authorization. Admin endpoint exposure via guessing or verb tampering. | Invoke admin endpoints (`/api/admin/*`) with standard tokens or by switching HTTP methods (GET $\rightarrow$ DELETE). | Forced browsing, RBAC role-matrix scanning. |
| **API6: Sensitive Business Flows** | Automated abuse of legitimate workflows (scalping, gift card fraud). | Execute rapid automated state transitions bypassing rate limits via distributed requests. | Behavioral flow monitoring, bot-simulation tools. |
| **API7: SSRF** | Server-Side Request Forgery via unvalidated URLs and webhooks. | Inject cloud metadata targets (`169.254.169.254`), private CIDR IPs, or loopback paths. | Out-of-band application testing (OAST), SSRF probes. |
| **API8: Misconfiguration** | Permissive CORS, verbose stack traces, debug/staging endpoints exposed. | Test wildcard CORS with credentials, examine 5xx responses for internal paths, probe `/actuator` or `/debug`. | Automated configuration linters, HTTP header audits. |
| **API9: Inventory Management** | Shadow APIs, deprecated/zombie versions (`/v1/`, `/v2/`) reachable without auth. | Fuzz version prefixes, inspect passive traffic for uncatalogued endpoints, probe unpatched versions. | Runtime API discovery, OpenAPI drift analysis. |
| **API10: Unsafe Consumption** | Blind trust in third-party APIs, upstream webhooks, or partner data. | Inject malicious payloads into upstream responses, spoof webhook signatures, test redirect chains. | Upstream response fuzzing, webhook replay tests. |

---

## 2. Authentication & Token Verification (OAuth 2.1 & JWT)

Verify that identity verification and token lifecycles strictly enforce modern defensive baselines:

### JWT Adversarial Test Checklist
* **Signature Enforcement:**
  - Strip signature entirely and mutate payload claims (`"alg": "none"`). Reject immediately.
  - Attempt algorithm confusion (e.g., swapping asymmetric RS256/ES256 public keys into symmetric HMAC-SHA256 verification keys).
* **Secret Robustness:**
  - Audit HMAC secret strength against dictionary lists using tools like `jwt-cracker`.
* **Claims & Scope Verification:**
  - Verify rejection of expired (`exp`), not-before (`nbf`), and incorrect audience (`aud`) or issuer (`iss`) claims.
  - Confirm token claims match server-side revocations; verify that logging out invalidates refresh tokens immediately in persistence storage (e.g., Redis blacklists or DB revocation tables).
* **Channel Hygiene:**
  - Ensure tokens are **never passed in query strings** (prevent log leakage); mandate the `Authorization: Bearer <token>` header.

### OAuth 2.1 Hygiene (Native & SPA)
* **PKCE Mandate:** Confirm Proof Key for Code Exchange (RFC 7636) is enforced on all authorization code grants.
* **Prohibited Flows:** Validate that legacy Implicit Grant and Resource Owner Password Credentials (ROPC) flows are completely disabled.
* **Exact Redirect URI Matching:** Verify the authorization server enforces strict string matching and rejects partial wildcards (e.g., `*.domain.com` or path traversal tricks).

---

## 3. Authorization Testing Methodology: BOLA & BOPLA

### Multi-Role Matrix Testing for BOLA (API1)
Never test an API using only one authenticated session. Use two distinct users in separate tenants:

```text
[Attacker Client (User B, Tenant 2)]
│
▼
[HTTP Request: GET /api/v1/workspaces/T2/invoices/INV-1004] (Legitimate)
│ (Mutate Target ID)
▼
[HTTP Request: GET /api/v1/workspaces/T1/invoices/INV-1001] (BOLA Probe)
│
▼
[Server Engine: Evaluate Ownership (user_id == session.user_id / RLS)]
│
┌────────┴────────┐
▼                 ▼
[403 / 404]       [200 OK + Data]
✅ SECURE          ❌ CRITICAL BOLA!
```

* **Execution Steps:**
  1. Capture authenticated requests containing resource identifiers (`UUID`, sequential integers, slug names) using session `User A`.
  2. Replay the identical request swapping in the Bearer token or cookie of `User B`.
  3. Ensure the server answers with `403 Forbidden` or `404 Not Found`. Returning `200 OK` confirms an object-level bypass.
  4. Repeat across all HTTP verbs (`GET`, `PUT`, `PATCH`, `DELETE`).

### Property-Level Testing for BOPLA (API3)
* **Mass Assignment (Write Side):**
  - Extract the internal domain model from documentation or client code.
  - Append privileged fields into request payloads (e.g., `{"role": "admin"}`, `{"verified": true}`, `{"account_id": "other"}`).
  - If the server accepts the request and mutates the attribute, it violates BOPLA. Verify the backend uses strict DTO binding and discards unmapped fields.
* **Excessive Data Exposure (Read Side):**
  - Inspect JSON response payloads from public or low-privilege endpoints.
  - Verify that sensitive fields (hashed passwords, internal tenant IDs, payment metadata) are not transmitted to the client with the expectation that the frontend will filter them.

---

## 4. Resource Consumption & Rate Limiting (API4)

Evaluate resistance against volumetric and cost-amplification attacks:

* **Rate Limiting Boundaries:**
  - Verify rate limiting is enforced across multiple tiers: **Per-IP, Per-User/Token, and Per-Endpoint** (especially on compute-heavy operations like exports, searches, or auth).
  - Probe for bypasses using spoofed headers: `X-Forwarded-For`, `X-Real-IP`, `Client-IP`. Ensure the API gateway only respects forward headers injected by trusted reverse proxies.
* **Pagination & Payload Caps:**
  - Request extreme collection limits: `GET /items?limit=1000000` or `?page=999999`.
  - Validate that the server enforces a hard ceiling (e.g., `max_limit: 100`) and leverages deterministic cursor keyset seeks instead of high-cost database `OFFSET` operations.
  - Test request body size caps by sending oversized multipart or raw JSON payloads; ensure the gateway terminates the connection before parsing into server memory.

---

## 5. GraphQL & Emerging Protocol Security

### GraphQL Specific Probes
* **Introspection Control:** Verify that Schema Introspection (`__schema`, `__type`) is disabled in production environments to avoid full schema leakage.
* **Query Depth & Complexity Analysis:**
  - Send deeply nested recursive queries (e.g., `author -> posts -> author -> posts...`) to test for recursion exhaustion.
  - Send batched alias queries combining hundreds of high-cost operations within a single HTTP POST request to bypass rate limiters.
  - Ensure the GraphQL engine rejects queries exceeding configured depth and complexity limits before execution.
* **Field-Level Authorization:** Verify that field resolvers independently check user ownership and role requirements (BOLA/BOPLA at the resolver level).

### gRPC & Protocol Buffers
* **Server Reflection:** Ensure gRPC server reflection is disabled in production to prevent schema enumeration.
* **Interceptors:** Verify that authorization interceptors evaluate caller metadata/tokens on streaming calls before processing frames.

---

## 6. Security Testing Automation & CI Integration

Integrate automated security gates directly into build and deployment pipelines:

```text
[ Developer Commit ] ──> [ Static Analysis (SAST/SCA) ]
│ (Lint secrets, dependencies, config)
▼
[ Staging Ephemeral DB ] ──> [ Contract Tests (Schemathesis / Dredd) ]
│ (Assert OAS 3.1 & RFC 7807 compliance)
▼
[ Multi-Role Matrix CI ] ──> [ DAST / Fuzzing (OWASP ZAP / Custom Suite) ]
│ (Automated BOLA / BFLA checks)
▼
[ Deployment Gate ] ──> Pass: Deploy | Fail: Block & Alert
```

### Automated Verification Tools
* **Contract & Schema Fuzzing:** `Schemathesis`, `Dredd` (validates API compliance against OpenAPI 3.1 specifications).
* **Dynamic Scanners (DAST):** `OWASP ZAP`, `Burp Suite CI`.
* **SAST & Secret Audits:** `Semgrep`, `TruffleHog` (catches hardcoded tokens and misconfigured permissions in IaC).

---

## 7. Operational Testing Checklist

Before approving an API for production release, verify:

### Authentication & Authorization
- [ ] BOLA: Object-level ownership checks enforced server-side on every resource endpoint.
- [ ] BOPLA: DTOs enforce strict property binding allow-lists on write operations.
- [ ] BOPLA: Responses are scoped and never expose raw internal database entities.
- [ ] BFLA: Admin endpoints and privileged HTTP methods enforce explicit role-based access controls (RBAC).
- [ ] OAuth 2.1: PKCE is enforced; implicit grant and password grants are disabled.
- [ ] JWT: Signature, expiry, issuer, and audience are verified; `alg:none` is rejected.

### Transport, Network & Infrastructure
- [ ] Enforce TLS 1.3 across all endpoints.
- [ ] Include required security headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, and restrictive `Cache-Control: no-store` on sensitive routes.
- [ ] CORS is restricted to trusted, explicit domains; wildcard origins (`*`) with credentials are prohibited.
- [ ] SSRF: All user-supplied destination URLs and webhooks are validated against explicit host/protocol allow-lists; calls to internal IPs and cloud metadata (`169.254.169.254`) are blocked.

### Resource Limits & Error Handling
- [ ] Tiered rate limiting (per-user, per-IP, per-endpoint) is enforced with `429 Too Many Requests` status codes.
- [ ] Request body sizes, file uploads, and pagination limits are capped server-side.
- [ ] Standardized RFC 7807/9457 error responses return safe machine-readable codes without leaking stack traces or internal paths.

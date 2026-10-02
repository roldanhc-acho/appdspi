---
name: response-format-principles
description: High-reliability API response and payload formatting standards. Enforces RFC 9457/RFC 7807 problem details, predictable success envelopes, deterministic cursor pagination, and information leakage prevention.
when_to_use: "Mandatory when defining, reviewing, or implementing API responses, serialization DTOs, error handlers, and collection pagination schemas."
allowed-tools: Read, Write, Edit
version: 3.0.0
priority: CRITICAL
---

# API Response Formatting & Contract Principles

> Consistency is the single biggest driver of developer experience. Choose explicit serialization patterns, enforce standard HTTP status codes, prevent information leakage, and stick to strict contracts from day one.

---

## 1. Response Structure Archetypes

| Pattern | Wire Structure | Primary Use Case | Trade-offs & Rules |
| :--- | :--- | :--- | :--- |
| **Response Envelope** | `{ "data": T, "meta": { ... } }` | Heterogeneous collections, paginated queries, client SDK generation. | Adds slight payload overhead; simplifies generic client parsers by segregating payloads from metadata. Top-level payload must always be a JSON object, never a bare array. |
| **Direct Resource** | `{ "id": "...", "name": "..." }` | High-throughput microservices, single-entity REST CRUD, simple domain models. | Minimal payload footprint; cannot attach pagination cursors or audit metadata without mutating domain models. |
| **RFC 9457 / RFC 7807** | Problem Details JSON schema | **Mandatory** across all 4xx/5xx HTTP error responses. | Replaces disparate error schemas with an industry-standard, machine-parsable failure format. |

---

## 2. Standardized Success Responses

### Single Resource Inspection (`GET /v1/orders/{id}`)
Return HTTP `200 OK` with the domain entity directly or enclosed under `"data"`:
```json
{
  "data": {
    "id": "ord_8f92a11b02c4",
    "status": "CONFIRMED",
    "amount_cents": 12500,
    "currency": "USD",
    "created_at": "2026-09-27T19:00:00Z"
  }
}
```

### Resource Mutation Standards
* **`POST` (Creation)**: Return HTTP `201 Created` accompanied by the canonical `Location: /v1/orders/{id}` header and the newly created entity representation.
* **`PUT` / `PATCH`**: Return HTTP `200 OK` with the modified entity, or HTTP `204 No Content` if minimal processing is explicitly requested.
* **`DELETE`**: Return HTTP `204 No Content` without payload upon successful deletion.

---

## 3. High-Assurance Error Formatting (RFC 9457 & Security Defense)

Never return HTTP `200 OK` for failed operations. Every failure must return an official RFC 9110 status code paired with an RFC 9457/7807 problem payload.

### RFC 9457 Error Contract Schema

```json
{
  "type": "https://api.domain.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "detail": "The payload provided contained 1 attribute violating domain rules.",
  "instance": "/v1/orders/ord_8f92a11b02c4",
  "trace_id": "req_01HPX7K0M8B2D5QZ87X6",
  "errors": [
    {
      "field": "quantity",
      "code": "MIN_VALUE",
      "message": "Must be an integer greater than 0."
    }
  ]
}
```

### Mandatory Error Attributes
* **`type` (URI)**: Absolute or relative URI categorizing the problem type.
* **`title` (string)**: Short, human-readable summary of the problem type (does not change between occurrences).
* **`status` (integer)**: Exact duplicate of the HTTP status code (enables client routing when transport headers are stripped).
* **`code` (string)**: Deterministic, machine-readable constant (e.g., `RESOURCE_NOT_FOUND`, `INVALID_CREDENTIALS`) enabling programmatic branching without regex string parsing.
* **`detail` (string)**: Specific explanation of this distinct problem instance.
* **`instance` (URI)**: Relative URI identifying the resource or endpoint path where the fault surfaced.
* **`trace_id` (string)**: Distributed request/correlation identifier (e.g., matching OpenTelemetry, GCP Cloud Trace, or `X-Flow-ID`) to cross-reference server logs without exposing internal state.
* **`errors` (array, optional)**: Field-level validation breakdown mapping specific attributes to validation constraints.

### Critical Security Rule: Prevent Information Leakage
* **Never Expose Internal Telemetry**: Stack traces, raw SQL queries, ORM exceptions, internal IP addresses, and filesystem paths are attack vectors.
* **5xx Sanitation**: Return generic descriptions to consumers on internal errors (`"detail": "An unexpected error occurred. Please contact support quoting trace_id."`) while persisting the complete error context, variables, and stack trace in internal secure logs.

---

## 4. Collection Pagination Design

List endpoints must never return unbounded collections. A query returning hundreds of thousands of rows causes database connection saturation and memory exhaustion.

### Pagination Strategy Comparison Matrix

| Pagination Type | Operational Mechanism | Best Suited For | Advantages | Critical Limitations & Bottlenecks |
| :--- | :--- | :--- | :--- | :--- |
| **Cursor-Based** | Opaque token encoding index seek boundary (e.g., base64-encoded `sort_val` + `id`). | Infinite feeds, mobile apps, real-time activity streams, datasets $>10{,}000$ rows. | $O(1)$ constant B-tree index seek performance; completely immune to duplicate/missed rows during concurrent mutations. | Cannot jump to arbitrary pages (e.g., "go to page 45"); bidirectional traversal requires complex cursor generation. |
| **Keyset / Anchor** | Transparent query filters exposing sort keys (`?created_after=2026-09-01&id_gt=...`). | High-performance public APIs, bulk synchronization, event pipelines. | Eliminates cursor decoding; direct index scan with transparent parameters. | Requires strict composite indexes matching sorting directions; leaks ordering semantics to client. |
| **Offset-Based** | Skip calculation: `OFFSET (page - 1) * limit`. | Small master data, internal administrative tables ($<10{,}000$ rows). | Simple to understand; enables random jumping across pages. | $O(N)$ query degradation at deep offsets (scans and discards $N$ rows); suffers from data drift under concurrent inserts/deletions. |

### Standard Cursor Pagination Response Schema

```json
{
  "data": [
    { "id": "ord_101", "created_at": "2026-09-27T18:00:00Z" },
    { "id": "ord_100", "created_at": "2026-09-27T17:59:00Z" }
  ],
  "meta": {
    "limit": 20,
    "next_cursor": "ZXlKaGJHY2lPaUpTVXpVeE5pSXNJblI1Y0NJNklrcFhWQ0o5...",
    "has_more": true
  },
  "links": {
    "self": "https://api.domain.com/v1/orders?cursor=eyJhbGciOi...",
    "next": "https://api.domain.com/v1/orders?cursor=ZXlKaGJHY2lPaU..."
  }
}
```

* **Tie-Breaker Rule**: The cursor must encode both the sort key (e.g., `created_at`) and a unique tie-breaker (e.g., `id`) to ensure deterministic seek execution and avoid pagination drift across records sharing identical timestamps.
* **Avoid `total_count`**: Never execute expensive `SELECT COUNT(*)` queries on large, frequently mutated datasets. Use `has_more` indicators calculated by requesting `limit + 1` rows.

---

## 5. Architectural Selection Diagnostic

Ask these questions before choosing a response format:

1. **Who is consuming the payload?**
   - *Public/Partner Integrations*: Use Response Envelopes or Direct Resources paired with RFC 9457 and OpenAPI 3.1 documentation.
   - *Mobile Frontends with Limited Bandwidth*: Use Cursor Pagination, support field selection (`?fields=id,status`), and avoid deep over-fetching.

2. **What is the dataset profile and write frequency?**
   - *Frequently Mutated / Real-time Streams*: Mandate **Cursor-Based Pagination** to eliminate offset drift.
   - *Static Reference Tables (<1,000 items)*: Offset-based pagination or unpaginated caching via `ETag` and `If-None-Match` is acceptable.

3. **How are errors diagnosed across teams?**
   - Ensure every 4xx and 5xx response incorporates a unique, correlation-ready `trace_id` mapped directly to backend monitoring spans.

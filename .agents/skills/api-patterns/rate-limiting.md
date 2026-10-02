---
name: rate-limiting-principles
description: Standards for API rate limiting, throttling, and resource allocation. Defends against volumetric attacks, brute-force abuse, and Denial of Wallet (OWASP API4/API6) using tiered limits, modern headers, and gateway controls.
when_to_use: "Mandatory when architecting, configuring, testing, or auditing API endpoints, reverse proxies, and gateways against volumetric load, resource consumption, or business logic automation."
allowed-tools: Read, Write, Edit
version: 3.0.0
priority: CRITICAL
---

# API Rate Limiting & Resource Protection Principles

> Protect backend computing, memory, downstream budgets, and business workflows from abuse, volumetric denial-of-service, and resource exhaustion. Rate limiting is not an afterthought; it is an architectural control across the API lifecycle.

---

## 1. Why Rate Limit? (Threat & Vulnerability Surface)

Unbounded endpoints open systems to catastrophic failures across technical and economic layers:

```text
Threat Vectors Mitigated:
├── OWASP API4:2023 (Unrestricted Resource Consumption)
│   ├── Exhaustion of compute, memory, disk I/O, and database connection pools
│   └── "Denial of Wallet" (runaway bills from paid downstream APIs: SMS, LLM tokens, email)
├── OWASP API2:2023 (Broken Authentication)
│   └── Automated brute-force attacks and credential stuffing against auth endpoints
├── OWASP API6:2023 (Unrestricted Access to Sensitive Business Flows)
│   └── Automated abuse of business logic (seat scalping, voucher hoarding, rapid checkout)
└── Quality of Service (QoS) & Fair Share
    └── Preventing a single rogue consumer from degrading performance for all tenants
```

---

## 2. Multi-Tiered Granularity (Defense in Depth)

Never rely solely on a single global perimeter limit. Enforce rate limiting simultaneously across multiple dimensions:

| Layer / Dimension | Identifier Strategy | Primary Mitigation | Example Ceiling |
| :--- | :--- | :--- | :--- |
| **Global / Edge Gateway** | Ingress IP address / Subnet CIDR | Volumetric DDoS and broad network layer flooding. | $10{,}000$ req / min |
| **Anonymous / IP-Level** | Client public IP (validated upstream) | Scraping, unauthenticated port-scanning, and endpoint fuzzing. | $60$ req / min |
| **Tenant / Account Tier** | `tenant_id` / API Key / Client ID | Enforcing subscription SLAs and fair multi-tenant isolation. | Bronze: $1{,}000$ / hr<br>Enterprise: $50{,}000$ / hr |
| **User Identity** | JWT `sub` (authenticated user ID) | Account scraping, automated actions via legitimate tokens. | $600$ req / min |
| **High-Cost Endpoints** | Route path (`/search`, `/export`, `/ai/infer`) | Heavy database full-scans, LLM token consumption, PDF exports. | $10$ req / min |
| **Auth / Business Flows** | Route + IP/User (`/login`, `/reset-pwd`) | Brute-force guessing, password enumeration, OTP SMS cost attacks. | $5$ attempts / 15 min |

---

## 3. Algorithm Selection Matrix

| Algorithm | How It Works | Burst Tolerance | Accuracy / Memory Cost | Ideal Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Token Bucket** | Tokens accumulate at a constant fill rate up to capacity; each request consumes a token. | **High** (allows controlled bursts up to bucket capacity). | High accuracy; low memory footprint ($O(1)$ scalar counter + timestamp). | **Default for API Gateways**, multi-tier SaaS, and REST APIs. |
| **Leaky Bucket** | Requests enter a queue and leak out to processing at a strictly constant rate. | **None** (excess calls dropped or buffered immediately). | High; smooths out spiky traffic into continuous stream. | Ingestion pipelines, data synchronization, message brokers, and traffic shaping. |
| **Sliding Window Counter** | Blends request counts from the previous window and current elapsed percentage. | **Low / Smoothed** (prevents boundary spikes). | Balanced; low memory usage compared to log storage. | General-purpose strict rate caps without burst allowance. |
| **Sliding Window Log** | Stores precise timestamps for every incoming request in an in-memory sorted set (e.g., Redis `ZSET`). | **None** (strict boundary enforcement). | Extreme accuracy; **High memory cost** ($O(N)$ entries per client window). | Strict regulatory limits, financial payment validation, high-value operations. |
| **Fixed Window** | Increments a discrete counter per atomic time slot (e.g., 00:00–00:01). | **Vulnerable** (allows $2\times$ burst across window boundaries). | Low; trivial counter reset. | Basic internal throttling where edge boundary spikes are tolerable. |

---

## 4. Modern HTTP Response Headers

APIs should communicate throttling status using the standardized IETF specification (`draft-ietf-httpapi-ratelimit-headers`) or the legacy `X-RateLimit-*` trio for backwards compatibility:

### IETF Standardized Headers (Recommended)
```http
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 13
Retry-After: 30
```

* `RateLimit-Limit`: Maximum number of allowed requests in the active window.
* `RateLimit-Remaining`: Remaining request quota in the active timeframe.
* `RateLimit-Reset`: Time remaining in **seconds** until the current quota window resets.
* `Retry-After`: Required on `429 Too Many Requests`. Specifies the number of seconds the client must pause before retrying.

### Legacy Hop-by-Hop Convention (`X-RateLimit-*`)
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1774735200
```

*(Note: Legacy `X-RateLimit-Reset` commonly represents epoch timestamps in seconds, unlike the relative delta seconds used in IETF guidelines).*

---

## 5. Standard Rejection & Error Formatting (RFC 9457)

Never return a raw string or HTTP `200 OK` when exceeding limits. Use HTTP `429 Too Many Requests` accompanied by an RFC 9457 Problem Details payload:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 30
RateLimit-Limit: 60
RateLimit-Remaining: 0
RateLimit-Reset: 30

{
  "type": "https://api.domain.com/errors/rate-limit-exceeded",
  "title": "Too Many Requests",
  "status": 429,
  "code": "RATE_LIMIT_EXCEEDED",
  "detail": "Rate limit quota exceeded for key 'usr_98a72'. Try again in 30 seconds.",
  "instance": "/v1/exports/daily-report",
  "trace_id": "req_01HPX7K0M8B2D5QZ87X6"
}
```

---

## 6. Implementation & Operational Security Rules

1. **Centralize at Gateway Level (Avoid Service Sprawl):**
   Implement rate limiting in the API Gateway or reverse proxy (e.g., Traefik, Kong, Cloud Armor, Envoy) instead of re-implementing custom logic within discrete microservices.

2. **Prevent Proxy Header Spoofing:**
   When rate limiting by IP, never trust client-supplied headers like `X-Forwarded-For` or `Client-IP` blindly. Configure the gateway to strip or overwrite `X-Forwarded-For` using only trusted reverse-proxy addresses to prevent trivial IP rotation bypasses.

3. **Use Distributed State Stores (Redis / Memcached):**
   In autoscaling architectures, maintain bucket counters in centralized, high-speed in-memory caches using atomic operations (e.g., Redis `EVAL` with Lua or `MULTI`/`EXEC`) to prevent race conditions during concurrent requests.

4. **Enforce Downstream Spending Caps:**
   For pay-per-use endpoints (SMS verification, biometric scanning, LLM completions), pair technical request-per-minute limits with hard monetary quotas and real-time budget alerts to prevent Denial of Wallet incidents.

5. **Log Unexpected 4xx Anomalies:**
   A sharp rise in `429 Too Many Requests` from specific token pools or subnets indicates automated credential enumeration, scraping, or active reconnaissance. Feed these metrics into runtime anomaly detection systems.

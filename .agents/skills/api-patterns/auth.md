---
name: authentication-patterns
description: Production-grade authentication and identity architecture standards. Enforces OAuth 2.1 PKCE for public/mobile clients, stateless JWT lifecycle management, hardware-backed token security (Android Keystore / iOS Keychain), mTLS zero-trust communication, Passkeys (FIDO2/WebAuthn), and protection against OWASP API2:2023.
when_to_use: "Mandatory when architecting, implementing, auditing, or reviewing authentication flows, token handling, session lifecycles, and cryptographic credential persistence across mobile, web, and microservices."
allowed-tools: Read, Write, Edit
version: 3.0.0
priority: CRITICAL
---

# Authentication & Identity Architecture Principles

> Authentication verifies identity; authorization establishes access boundaries. Broken Authentication (API2:2023) ranks as the second most critical API security threat. Never implement bespoke cryptography, never store unprotected credentials in client storage, and always enforce deterministic token validation on every request.

---

## 1. Architectural Pattern Selection Matrix

| Pattern / Protocol | Primary Client & Architecture | Strengths & Security Guarantees | Limitations & Critical Constraints |
| :--- | :--- | :--- | :--- |
| **OAuth 2.1 + PKCE** | Native Mobile (Android/iOS), Single Page Apps (SPAs), third-party delegated access. | RFC 7636 / RFC 8252 compliance; removes vulnerable legacy flows (Implicit Grant, Resource Owner Password Credentials). | Requires authorization server infrastructure and strict redirect URI matching. |
| **JWT (Stateless Bearer)** | High-concurrency APIs, distributed microservices, Serverless Edge. | Self-contained claims; eliminates per-request database lookups at the service gateway. | Revocation complexity; vulnerable to `alg: none`, algorithm confusion, and local token theft. |
| **Encrypted Sessions (Stateful)** | Server-Rendered Web Apps (SSR / MVC), administrative portals. | Instant server-side revocation on logout; protected against client-side script inspection via `HttpOnly`. | Requires shared distributed storage (e.g., Redis session cluster) across horizontally scaled nodes. |
| **mTLS (Mutual TLS)** | Zero-trust microservice-to-microservice meshes, enterprise banking. | Cryptographic client and server mutual identity verification at the transport layer; immune to token interception. | Certificate lifecycle management and rotation overhead; unsuitable for direct browser clients. |
| **API Keys (Hashed)** | Backend-to-backend automation, server-to-server integrations. | Simple integration; straightforward rate limiting per key. | Long-lived credentials lacking user context; prone to leakage if embedded in client binaries or query strings. |
| **Passkeys (FIDO2 / WebAuthn)** | Modern phishing-resistant passwordless authentication. | Asymmetric key-pairs backed by hardware authenticator (Secure Enclave / TPM); immune to credential stuffing. | Requires fallback recovery flows and WebAuthn browser/OS support. |

---

## 2. OAuth 2.1 & Mobile Client Architecture (RFC 8252 & RFC 7636)

Native mobile applications are classified as **Public Clients** under RFC 6749 because they cannot securely embed client secrets within distributed binaries.

```text
[ Mobile Client (Public) ]                 [ Authorization Server ]              [ Resource API ]
│                                           │                                  │
│ 1. Generate code_verifier                 │                                  │
│    code_challenge = Base64URL(SHA256(v))  │                                  │
├──────────────────────────────────────────>│                                  │
│    Auth Request + code_challenge          │                                  │
│                                           │                                  │
│ 2. User Authenticates & Grants Consent    │                                  │
│<──────────────────────────────────────────┤                                  │
│    Authorization Code                     │                                  │
│                                           │                                  │
│ 3. POST /token + code_verifier            │                                  │
├──────────────────────────────────────────>│                                  │
│    (Server verifies SHA256(v) == chal)    │                                  │
│                                           │                                  │
│ 4. Access Token (JWT) + Refresh Token     │                                  │
│<──────────────────────────────────────────┤                                  │
│                                                                              │
│ 5. API Request (Authorization: Bearer <token>)                               │
├─────────────────────────────────────────────────────────────────────────────>│
```

### Mandated OAuth 2.1 Rules:
1. **Mandatory PKCE**: Use Authorization Code Flow with Proof Key for Code Exchange (PKCE) for every client interaction:
   $$\text{Code\_Challenge} = \text{Base64URL-Encode}(\text{SHA-256}(\text{Code\_Verifier}))$$
2. **Eliminated Grant Types**: Completely disable Implicit Grant (`response_type=token`) and Resource Owner Password Credentials (ROPC).
3. **Exact Redirect URIs**: Enforce 100% exact string matching on redirect URIs; reject partial wildcards and dynamic subdomains.
4. **Header Transmission Only**: Transmit tokens strictly via the HTTP `Authorization: Bearer <token>` header. **Never accept tokens in URL query strings** to prevent leakage into CDN logs, browser histories, and proxy caches.

---

## 3. JWT Lifecycle & Hardening Guidelines

Stateless JSON Web Tokens must enforce strict temporal windows and cryptographic verification on every request:

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "auth-key-2026-prod-01"
  },
  "payload": {
    "iss": "https://auth.domain.com",
    "sub": "usr_99f2c81a",
    "aud": "https://api.domain.com",
    "exp": 1776000900,
    "nbf": 1776000000,
    "iat": 1776000000,
    "jti": "jwt_cl82b1002a",
    "app_metadata": {
      "tenant_id": "ten_44a11b",
      "role": "account_admin"
    }
  }
}
```

### Core Verification & Lifetime Rules:
* **Short-Lived Access Tokens**: Limit access token lifespans to **15–60 minutes**. Pair with rotating refresh tokens for continuous session persistence.
* **Explicit Algorithm Enforcement**: Hardcode and enforce the expected signature algorithm (`RS256`, `ES256`, or `EdDSA`) in backend verification logic. Reject the `alg: "none"` header mutation and block symmetric HMAC evaluation against asymmetric public keys (algorithm confusion).
* **Structural Claims Validation**: Validate all standard claims on every incoming request: `iss` (issuer), `aud` (audience), `exp` (expiration), `nbf` (not before), and `iat` (issued at).
* **Sliding Refresh Token Rotation**:
  - Presenting a refresh token yields a new Access/Refresh token pair and immediately invalidates the previous refresh token.
  - If an expired or previously consumed refresh token is presented again, flag a **token reuse attack** and instantly revoke all active tokens belonging to that token family.
* **Identity Source Separation**:
  - Derive authorization decisions exclusively from trusted, server-minted `app_metadata` or database lookups.
  - **Never use user-mutable claims (`user_metadata`) for authorization or RLS decisions**.

---

## 4. Hardware-Backed Client Token Storage

Tokens stored insecurely in client runtimes are vulnerable to theft via memory dumps, root exploits, and backup extractions (OWASP MASVS-STORAGE-1, MASVS-CRYPTO-2):

| Platform | Insecure Storage (FORBIDDEN) | Mandated Secure Hardware Storage |
| :--- | :--- | :--- |
| **Android** | Plain `SharedPreferences`, SQLite databases without encryption, raw files. | **Android Keystore System** with hardware isolation:<br>• Enforce StrongBox backing: `setIsStrongBoxBacked(true)`.<br>• For sensitive credentials, bind to biometrics: `setUserAuthenticationRequired(true)`. |
| **iOS** | `UserDefaults`, unencrypted CoreData, `.plist` files. | **Keychain Services** backed by the **Secure Enclave Processor (SEP)**:<br>• Enforce accessibility: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.<br>• Bind to LocalAuthentication (`kSecAccessControlBiometryAny`). |
| **Web Browser** | `localStorage`, `sessionStorage`, global JS window scope. | **`HttpOnly; Secure; SameSite=Strict` (or `Lax`) Cookies** to mitigate Cross-Site Scripting (XSS) extraction. |

---

## 5. Machine-to-Machine & API Key Architecture

For server-to-server integrations where user interaction is absent:

* **Cryptographic Storage**: Store API keys using salted, collision-resistant cryptographic hashes (e.g., SHA-256 or Argon2id); never persist plaintext keys in database tables.
* **Prefix & Truncation Display**: Format keys with identifiable prefixes and checksums (e.g., `sk_live_9f8a...`) to simplify automated secret scanning in repositories. Only display the key once upon initial generation; show only the last 4 characters subsequently.
* **Granular Scoping & Rotation**: Bind API keys to granular resource scopes and IP allowlists; enforce automated rotation windows.
* **Header Placement**: Always pass API keys via custom headers (`X-API-Key` or `Authorization: Bearer <key>`), never inside URL query parameters.

---

## 6. Verification & Security Testing Checklist (OWASP API2 / MASVS-AUTH)

- [ ] **Algorithm Rigidity**: Verification rejects tokens signed with `alg: "none"` or mismatched symmetric algorithms.
- [ ] **Expiration Enforcement**: Requests presenting expired tokens (`exp < currentTime`) return HTTP `401 Unauthorized`.
- [ ] **PKCE Protection**: Mobile and SPA client flows require `code_challenge` and `code_verifier` pairs.
- [ ] **Hardware Keystore Backing**: Mobile tokens are stored in Android Keystore (StrongBox) or iOS Keychain (Secure Enclave).
- [ ] **Anti-Brute Force Controls**: Rate limiting and progressive lockouts are active on `/auth/login`, `/auth/refresh`, and password reset endpoints.
- [ ] **Server-Side Revocation**: Invoking logout marks the token's `jti` in a fast-revocation blocklist or terminates the session family immediately.
- [ ] **Zero Secrets in URLs**: All tokens, authorization codes, and API keys are transmitted in headers or POST bodies, completely absent from URL paths or query strings.

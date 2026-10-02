---
name: api-patterns
description: API design principles and decision-making. REST vs GraphQL vs tRPC selection, response formats, versioning, pagination.
when_to_use: "When designing REST/GraphQL/tRPC APIs, defining response formats, versioning, pagination, or API authentication. NOT for UI/frontend work."
allowed-tools: Read, Write, Edit, Glob, Grep
version: 1.0.0
---

# API Patterns

> API design principles and decision-making.
> **Learn to THINK, not copy fixed patterns.**

## 🎯 Selective Reading Rule

**Read ONLY files relevant to the request!** Check the content map, find what you need.

---

## 📑 Content Map

| File | Description | When to Read |
|------|-------------|--------------|
| `api-style.md` | Framework de decisión y matriz comparativa: REST (OpenAPI 3.1), GraphQL, tRPC, gRPC, WebSockets y AsyncAPI | Selección de protocolos de comunicación y arquitectura híbrida |
| `rest.md` | Resource naming, HTTP methods, status codes | Designing REST API |
| `response.md` | Sobres de éxito, contratos de error RFC 9457/7807, cursores O(1) y prevención de fuga de datos | Estructura de respuestas y errores |
| `graphql.md` | Diseño de esquemas, Relay Connections, DataLoaders, límites de profundidad/coste, seguridad por campo y federación | Arquitectura GraphQL y BFF |
| `trpc.md` | Contratos RPC end-to-end, Parse Don't Validate, middleware BOLA/BFLA, cursores y DataLoaders | Full-stack TS & monorepos RPC |
| `versioning.md` | URI/Header/Query versioning | API evolution planning |
| `auth.md` | OAuth 2.1 PKCE, ciclo de vida JWT, almacenamiento seguro en hardware (Keystore/Keychain), mTLS y Passkeys | Selección de autenticación y seguridad de credenciales |
| `rate-limiting.md` | Algoritmos (Token Bucket, Sliding Window), granularidad multinivel, cabeceras IETF y mitigación Denial of Wallet (API4/API6) | Protección contra sobreconsumo y DDoS |
| `documentation.md` | OpenAPI 3.1 Contract-First, portales de desarrollador (TTFC < 5m), llms.txt para agentes AI, catálogo RFC 9457 y CI anti-drift | Documentación viva y Developer Experience (DX) |
| `security-testing.md` | OWASP API Security Top 10 (2023/2026), pruebas adversarias BOLA/BOPLA, OAuth 2.1 PKCE y CI DAST/SAST | Auditorías y penetration testing de APIs |

---

## 🔗 Related Skills

| Need | Skill |
|------|-------|
| API implementation | `@[skills/nodejs-best-practices]` |
| Data structure | `@[skills/database-design]` |
| Security details | `@[skills/vulnerability-scanner]` |

---

## ✅ Decision Checklist

Before designing an API:

- [ ] **Asked user about API consumers?**
- [ ] **Chosen API style for THIS context?** (REST/GraphQL/tRPC)
- [ ] **Defined consistent response format?**
- [ ] **Planned versioning strategy?**
- [ ] **Considered authentication needs?**
- [ ] **Planned rate limiting?**
- [ ] **Documentation approach defined?**

---

## ❌ Anti-Patterns

**DON'T:**
- Default to REST for everything
- Use verbs in REST endpoints (/getUsers)
- Return inconsistent response formats
- Expose internal errors to clients
- Skip rate limiting

**DO:**
- Choose API style based on context
- Ask about client requirements
- Document thoroughly
- Use appropriate status codes

---

## Script

| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/api_validator.py` | API endpoint validation | `python scripts/api_validator.py <project_path>` |


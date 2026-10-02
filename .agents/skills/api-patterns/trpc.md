# tRPC & End-to-End Type Safety Principles

> High-velocity, zero-drift RPC contracts for full-stack TypeScript systems — eliminating serialization boilerplate while enforcing boundary parsing and zero-trust security.

---

## 1. When to Use & Protocol Selection

tRPC bypasses traditional REST schema generation by inferring types directly from server router definitions to client caller proxies. However, protocol selection must match consumers and boundary constraints:

```text
What is your client environment & system boundary?
│
├── TypeScript Full-Stack Monorepo (Next.js / Turborepo / TanStack Start)
│   ├── Internal web/desktop clients (React, Vue, Svelte) → ✅ tRPC (Optimal DX & Zero Codegen)
│   └── Shared Native Mobile (React Native / Expo in monorepo) → ✅ tRPC Client Proxy
│
├── Mixed Ecosystem / Public API / Heterogeneous Clients
│   ├── Native Mobile (Kotlin / Swift) outside monorepo → ❌ REST (OpenAPI 3.1) or GraphQL
│   ├── Public Partner Integrations & Webhooks → ❌ REST with RFC 9457 & OpenAPI
│   ├── Low-latency internal microservices (<10ms) → ❌ gRPC / Protocol Buffers
│   └── Dual requirement (Internal tRPC + Public REST) → ⚠️ tRPC + OpenAPI adapter or oRPC
```

### Context Evaluation

| Criteria | ✅ Best Fit (tRPC) | ❌ Poor Fit (Choose REST / GraphQL / gRPC) |
| :--- | :--- | :--- |
| **Language Stack** | TypeScript across both client and server within a monorepo workspace. | Polyglot backends (Go, Python, Rust) or native mobile teams consuming standalone endpoints. |
| **Contract Lifecycle** | Fast internal product iteration; client and server deploy simultaneously. | Versioned public APIs requiring strict lifecycle/deprecation policies (`Sunset` headers). |
| **Tooling Overhead** | Zero-codegen desired; instant IDE type checking and autocomplete across packages. | Strict requirements for automated SDK generation in 5+ languages or Postman/Swagger imports. |
| **Network Geometry** | Coupled web frontend and serverless BFF (Backend-For-Frontend). | Service-to-service distributed microservice meshes (prefer gRPC or AsyncAPI events). |

---

## 2. Core Architectural Principles & Boundary Security

### 1. "Parse, Don't Validate" at the Ingress Boundary
TypeScript static types are erased at runtime; raw HTTP parameters remain completely untrusted.
* **Mandatory Input Parsing**: Every public and protected procedure must enforce runtime schema parsing (e.g., Zod, ArkType, Valibot) on inputs.
* **Reject Loose Types**: Never accept naked `z.any()` or unvalidated primitives that cause primitive obsession downstream. Convert primitive IDs into branded or validated domain values early (`z.string().uuid()` $\rightarrow$ `TenantId`).

```typescript
// Procedure boundary enforcing parse-don't-validate
export const updateOrderProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid().brand<'OrderId'>(), // Branded Value Type
      status: z.enum(['PENDING', 'PROCESSING', 'DELIVERED']),
      metadata: z.record(z.string()).optional(),
    }).strict() // Mitigates API3: BOPLA / Mass Assignment
  )
  .mutation(async ({ input, ctx }) => {
    // input is guaranteed valid and strongly typed; zero defensive null-checks needed downstream
    return ctx.orderService.updateStatus(input.orderId, input.status);
  });
```

### 2. Context Isolation & Zero-Trust Middleware

Avoid handling authorization checks ad-hoc inside resolver logic. Enforce access policies via reusable, chained tRPC middleware:

* **Deny-by-Default (API1: BOLA & API5: BFLA)**: Create scoped base procedures (`publicProcedure`, `protectedProcedure`, `tenantAdminProcedure`).
* **InitPlan / Database-Aligned Context**: Populate the execution context (`ctx`) with authenticated session identifiers (e.g., `user.id`, `tenant.id`) extracted securely from verified JWTs or session cookies.

```typescript
// Reusable authorization middleware pattern
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication session required.',
    });
  }
  return next({
    ctx: {
      user: ctx.session.user, // Narrowed from User | null to User
    },
  });
});
```

### 3. Functional Core Separation (Clean Boundaries)

* **Procedures are Shell Adapters**: Procedures belong strictly to the **Imperative Shell**. They receive requests, execute context middleware, trigger boundary parsing, and delegate immediately to pure functional core algorithms or domain services.
* **Zero Business Logic in Resolvers**: Never write calculation algorithms, accounting balance math, or multi-step domain flows directly inside the `.query()` or `.mutation()` handler.

---

## 3. Query Performance & Data Transfer Standards

### Deterministic Keyset Cursor Pagination

Offset-based pagination introduces $O(N)$ query degradation and data drift during concurrent writes. Design infinite collection procedures with deterministic cursor tokens:

```typescript
export const listDocumentsProcedure = protectedProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(20),
      cursor: z.object({
        createdAt: z.string().datetime(),
        id: z.string().uuid(),
      }).nullish(), // Deterministic tie-breaker cursor
    })
  )
  .query(async ({ input, ctx }) => {
    const items = await ctx.db.document.findMany({
      take: input.limit + 1, // Fetch limit + 1 to detect hasNextPage
      where: {
        tenantId: ctx.user.tenantId,
        ...(input.cursor
          ? {
              OR: [
                { createdAt: { lt: new Date(input.cursor.createdAt) } },
                {
                  createdAt: new Date(input.cursor.createdAt),
                  id: { lt: input.cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    let nextCursor: typeof input.cursor | undefined = undefined;
    if (items.length > input.limit) {
      const nextItem = items.pop();
      nextCursor = { createdAt: nextItem!.createdAt.toISOString(), id: nextItem!.id };
    }

    return { items, nextCursor };
  });
```

### Batching & N+1 Prevention

* **HTTP Batch Link**: Configure `httpBatchLink` on the client to combine individual procedure requests initiated within the same execution frame into a single HTTP round-trip.
* **Backend DataLoaders**: When procedures aggregate data across relational boundaries, use DataLoader instances scoped to the request context to batch independent database queries into unified `WHERE IN (...)` operations.

---

## 4. Integration Architecture Patterns

```text
Modern Integration Archetypes:
├── 1. Next.js App Router & RSC
│   ├── Server Components → Invoke procedures directly via `appRouter.createCaller(ctx)` (Zero HTTP round-trip)
│   └── Client Components → Standard `@trpc/tanstack-react-query` hooks (`useQuery`, `useMutation`)
│
├── 2. Monorepo Separation (Turborepo / Nx)
│   ├── /packages/api → Root router, procedures, and boundary schemas
│   ├── /apps/web → Consumes `AppRouter` type interface without server code leakage
│   └── /apps/mobile (Expo) → Direct typed client consuming `/packages/api`
│
└── 3. Hybrid Public Bridge (OpenAPI Alignment)
    └── Opt-in procedures exposed via `@trpc/openapi` or migration to `oRPC` for OAS 3.1 + Swagger specs
```

---

## 5. Diagnostic Evaluation Checklist

Before introducing or maintaining a tRPC router:

1. **Consumer Scope**: Are all consumers written in TypeScript within the shared monorepo? *(If third parties or Swift/Kotlin apps need access, evaluate OpenAPI-first REST instead)*.
2. **Schema Leakage**: Does the client package import *only* `type AppRouter = typeof appRouter`? *(Never import server implementations, secrets, or database drivers into frontend bundles)*.
3. **Mass Assignment (BOPLA)**: Are mutation inputs constrained with `.strict()` or explicit object shapes to prevent unintended field persistence?
4. **Pagination Profile**: Do large collection endpoints utilize cursor seeks with unique tie-breaker attributes rather than `skip`/`offset`?

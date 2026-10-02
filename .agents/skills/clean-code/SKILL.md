---
name: clean-code
description: Pragmatic, high-assurance coding standards — concise, direct, zero over-engineering, boundary parsing, functional core isolation, and deterministic testing.
when_to_use: "Always active for ALL code writing and refactoring. Enforces concise coding, immutability, parse-don't-validate, the 5-layer testing pyramid, and verified script validation."
allowed-tools: Read, Write, Edit, Bash
version: 3.0.0
priority: CRITICAL
---

# Clean Code — Pragmatic & High-Assurance AI Standards

> **CRITICAL SKILL** — Be **concise, direct, solution-focused**, and write deterministic code that fails at compile-time rather than runtime.

---

## 1. Core Engineering Principles

| Principle | Technical Mandate |
|:---|:---|
| **SRP** | Single Responsibility — Each class/module has exactly one reason to change. Separate data access from domain logic. |
| **DRY** | Don't Repeat Yourself — Abstract domain patterns; keep boundary DTOs distinct from internal types. |
| **KISS & YAGNI** | Implement the simplest deterministic solution that satisfies requirements. Never build speculative abstractions. |
| **FCIS** | **Functional Core, Imperative Shell** — Isolate all business logic and calculations in pure, side-effect-free functions. Keep I/O, framework SDKs, and network calls in the outer Shell. |
| **Parse, Don't Validate** | Push data checking to system boundaries. Parse loose payloads (JSON, maps, strings) into strongly typed Value Objects with smart constructors. Make illegal states unrepresentable. |
| **Boy Scout Rule** | Leave every file cleaner, better typed, and more resilient than you found it. |

---

## 2. Naming & Type Modeling Standards

| Category | Standard | Correct Example | Anti-Pattern |
|:---|:---|:---|:---|
| **Variables** | Reveal intent without needing comments. | `activeUserCount` | `n`, `data`, `temp` |
| **Functions** | Verb + Noun; reflects side effects or purity. | `calculateTotal()`, `fetchOrderById()` | `user()`, `process()` |
| **Booleans** | Interrogative prefix; never nullable. | `isActive`, `hasAccess`, `canEdit` | `active`, `flag`, `isNullableBoolean` |
| **Constants** | SCREAMING_SNAKE for real compile-time constants. | `MAX_RETRY_COUNT` | `maxRetries`, `m_retries` |
| **Domain Types** | Specific Domain Primitives / Value Classes (kill Primitive Obsession). | `UserId`, `PositiveAmount`, `EmailAddress` | Raw `string`, generic `number`, naked `UUID` |
| **UI Events** | `on` + [Action] + [Subject] format. | `onOrderSubmitted`, `onSearchQueryChanged` | `handleClick`, `doUpdate` |

> **Rule:** If a variable or method requires a comment to explain its purpose, rename it immediately.

---

## 3. Function & Implementation Rules

* **Size & Scope:** Keep functions between 5 and 20 lines; enforce a single level of abstraction per scope.
* **Parameter Budget:** Maximum 3 parameters. If more are needed, compose them into a domain-specific parameter object or Value Class.
* **Determinism & Immutability:** 
  * Avoid input mutation; return fresh immutable data structures.
  * **Strictly prohibit IEEE 754 float/double primitives** for financial, inventory, or cumulative math. Use scaled integers (`Int64`) or arbitrary precision types (`BigDecimal` / `Decimal`).
  * If floats are mandatory for analytical compute, replace strict `A == B` with an epsilon tolerance threshold:
    $$\lvert A - B \rvert \le \epsilon \cdot \max(\lvert A \rvert, \lvert B \rvert, 1.0)$$
* **Framework Hygiene:** Domain logic and calculations must have zero imports from UI frameworks (React, Jetpack Compose, SwiftUI) or cloud/client SDKs (Firebase, AWS, HTTP clients).

---

## 4. Code Structure & Defensive Boundaries

```text
[ External Untrusted World (API, DB, UI Input) ]
│
▼ (Boundary Parsing: Parse, Don't Validate)
┌────────────────────────────────────────────────────────┐
│  Smart Constructors / DTOs (Strip bad states)          │
└────────────────────────────────────────────────────────┘
│
▼ (Validated Pure Value Types)
┌────────────────────────────────────────────────────────┐
│  Functional Core (Pure Calculations & Domain Invariants)│
└────────────────────────────────────────────────────────┘
│
▼ (Execution Intent)
┌────────────────────────────────────────────────────────┐
│  Imperative Shell (DB Persistence, HTTP/RPC, Framework)│
└────────────────────────────────────────────────────────┘
```

* **Guard Clauses:** Handle edge cases and failures early; avoid nesting beyond 2 levels deep.
* **Parse at Boundaries:** Validate and transform external inputs immediately upon ingress (`UnvalidatedPayload` $\rightarrow$ `ValidDomainObject`). Once inside the domain core, eliminate redundant defensive checks.
* **Colocation:** Keep types, pure functions, and their dedicated unit tests close to the feature modules.

---

## 5. Mobile & API Clean Code Requirements

* **API Endpoints:** Adhere to OpenAPI 3.1 specifications. Use nouns for resources (`/orders`), RFC 7807 for problem details, and deterministic cursor seek tokens for pagination (`startAfter` / keyset seeks).
* **State Management (UI):** Enforce Unidirectional Data Flow (UDF). Expose immutable state flows (e.g., `StateFlow` with lifecycle awareness); dispatch interactions via explicit lambdas.
* **Offline-First Storage:** Local databases (Room, SQLite) must serve as the Single Source of Truth (SSOT). Domain layers observe data from local persistence, never from raw asynchronous network calls.

---

## 6. Testing Strategy & Quality Gates (Mobile Pyramid)

Maintain tests across the 5 distinct layers; do not lean solely on end-to-end integration:

```text
              / \
             / E2E \         Physical / Virtual Target Devices (<5%)
            /-------\
           / App Lifecycle \ Android/iOS Subsystem & OS Lifecycle Tests
          /-----------------\
         / Feature / UseCase \ Integration of ViewModels + UseCases + Repositories
        /---------------------\
       / Component / Snapshot  \ Isolated Compose / SwiftUI / DOM UI Render Tests
      /-------------------------\
     / Host-Pure Unit Tests      \ Pure JVM/Host FCIS Tests (>70%, <5ms per test)
    /-----------------------------\
```

* **Property-Based Testing (PBT):** For calculation algorithms and parser engines, run generative tests (Kotest / SwiftCheck) to verify invariants like idempotence and reversibility across arbitrary inputs.
* **Quality Metrics:**
  * Host Unit Test coverage $>95\%$ on the functional core.
  * Local test execution $<10$ minutes total runtime in CI pipelines.
  * $100\%$ pass rate required before merge authorization.

---

## 7. Anti-Patterns (STRICTLY PROHIBITED)

| ❌ Forbidden Pattern | ✅ Clean Code Replacement |
|:---|:---|
| Explaining code with inline comments | Refactor variables/functions to be self-explanatory. |
| Using `float`/`double` for monetary values | Use scaled `Int64` or `BigDecimal`. |
| Importing Frameworks into Domain Layer | Pure native language models; inject interfaces. |
| Re-validating data deep inside internal helpers | Parse into restricted types at the system boundary. |
| Defensive null checks everywhere (`val != null`) | Non-nullable types, smart constructors, or Option/Result types. |
| Generating factories/helpers for single use-cases | Inline the code directly; avoid premature abstraction. |
| Wildcard imports or wide catch-all exception blocks | Explicit, typed imports and explicit domain error hierarchies. |

---

## 8. Impact Analysis Before ANY File Mutation

Before altering existing code, perform an explicit impact check:

| Evaluation Check | Critical Reason |
|:---|:---|
| **What modules depend on this symbol?** | Avoid downstream runtime and compile failures. |
| **Does this change the public contract?** | Update schemas, DTOs, and interfaces in lockstep. |
| **Which tests cover this boundary?** | Update or execute corresponding unit and contract tests. |
| **Is this file shared across platforms or layers?** | Prevent leaking platform-specific imports into shared code. |

> 🔴 **Rule:** Modify the target source file AND all dependent files/tests in the **same execution cycle**. Never leave uncompiled references or broken imports.

---

## 9. Verification Scripts & Automation Protocol

> 🔴 **CRITICAL:** Each specialized agent runs **only** its assigned verification scripts upon task completion.

### Agent to Script Mapping Matrix

| Agent Role | Verification Domain | Execution Command |
|:---|:---|:---|
| **frontend-specialist** | UX & Interaction Audit | `python .agents/skills/frontend-design/scripts/ux_audit.py .` |
| **frontend-specialist** | Accessibility (A11y) Check | `python .agents/skills/frontend-design/scripts/accessibility_checker.py .` |
| **backend-specialist** | OpenAPI & Contract Validation | `python .agents/skills/api-patterns/scripts/api_validator.py .` |
| **mobile-developer** | Mobile Quality & Layout Audit | `python .agents/skills/mobile-design/scripts/mobile_audit.py .` |
| **database-architect** | Schema & RLS Policy Check | `python .agents/skills/database-design/scripts/schema_validator.py .` |
| **security-auditor** | SAST & Vulnerability Scanning | `python .agents/skills/vulnerability-scanner/scripts/security_scan.py .` |
| **performance-optimizer** | Profiling & Lighthouse Benchmark | `python .agents/skills/performance-profiling/scripts/lighthouse_audit.py <target>` |
| **test-engineer** | Unit & Property-Based Test Runner | `python .agents/skills/testing-patterns/scripts/test_runner.py .` |
| **Any Agent** | Static Lint & Formatting Check | `python .agents/skills/lint-and-validate/scripts/lint_runner.py .` |
| **Any Agent** | Strict Type Checking & Coverage | `python .agents/skills/lint-and-validate/scripts/type_coverage.py .` |

---

### Output Handling Protocol (READ $\rightarrow$ SUMMARIZE $\rightarrow$ ASK)

When executing an automated validation script:
1. **Run the script** capturing stdout and stderr.
2. **Parse and classify** the output into Errors, Warnings, and Passes.
3. **Present the exact structured summary** to the user:

```markdown
## Script Execution Results: [script_name.py]

### ❌ Errors Identified (X items)
- [File:Line] Precise description of failure

### ⚠️ Warnings (Y items)
- [File:Line] Precise warning or performance hint

### ✅ Passed Verifications (Z items)
- Specific check succeeded

**Awaiting instruction: Should I proceed with resolving the identified errors?**
```

4. **Await explicit user confirmation** prior to applying automatic fixes.
5. **Re-run the verification script** after code modification to certify resolution.

> 🔴 **STRICT ENFORCEMENT:** Suppressing script outputs, silently ignoring reported errors, or auto-fixing without confirmation constitutes an immediate task failure.

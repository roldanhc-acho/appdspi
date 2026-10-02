---
name: webapp-testing
description: Web application & browser E2E testing principles. Enforces the testing pyramid, Playwright deterministic automation, design system token alignment, API contract & security verification (OWASP API Top 10), and strict CI script execution governance.
when_to_use: "When authoring or executing Playwright browser suites, conducting deep web/PWA audits, validating critical user journeys, or running /test automated CI validation."
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
version: 3.0.0
priority: CRITICAL
---

# Web Application Testing & Adversarial Quality Assurance

> Discover, isolate, and verify everything. Leave no route, critical user journey, or authorization boundary unverified. Validate user behavior rather than implementation details, and let small, deterministic tests bear the computational load of your CI/CD pipeline.

---

## 1. Runtime Automation Scripts

Execute these standardized scripts via the project test harness:

| Script Target | Primary Verification | Invocation Syntax |
| :--- | :--- | :--- |
| `scripts/playwright_runner.py` | Headless browser execution against user paths | `python scripts/playwright_runner.py <url>` |
| `scripts/playwright_runner.py` | Visual regression & layout capture | `python scripts/playwright_runner.py <url> --screenshot` |
| `scripts/playwright_runner.py` | WCAG / A11y tree & contrast audit | `python scripts/playwright_runner.py <url> --a11y` |
| `scripts/api_validator.py` | Contract & OpenAPI 3.1 conformance | `python scripts/api_validator.py <url>` |

**Prerequisites:** Ensure browser runtimes are provisioned:
```bash
pip install playwright && playwright install chromium firefox webkit
```

---

## 2. Deep Audit & Discovery Methodology

Never begin writing end-to-end tests without first establishing a complete map of the attack surface and application routes:

### 1. Discovery Phase

* **Route Mapping:** Scan client routers (`app/`, `pages/`, `src/routes/`, React Router, TanStack Router) to extract every accessible public, protected, and administrative URL path.
* **API Inventory & Schema Discovery (API9):** Grep endpoints across services and cross-reference with OpenAPI 3.1/GraphQL schemas. Identify uncatalogued, legacy, or shadow routes.
* **Interaction Inventory:** Map primary user flows (checkout, authentication, onboarding, state mutation) against their required permission tiers.

### 2. Systematic Audit Execution

```text
[ 1. Map ] ──> Extract complete inventory of web routes & API endpoints
     │
     ▼
[ 2. Scan ] ──> Verify HTTP status codes, security headers, & initial render
     │
     ▼
[ 3. Seam Test ] ──> Verify component isolation & contract integration
     │
     ▼
[ 4. E2E Journey ] ──> Automate critical business-value user workflows
```

---

## 3. Web Testing Pyramid Strategy

An unbalanced test suite leads to slow pipelines and flaky builds. Distribute automated checks according to the testing pyramid:

```text
           / \
          /   \         E2E Tests (~10%)
         / E2E \        Critical user workflows & browser fidelity
        /-------\
       /         \      Integration & Contract Tests (~20%)
      / Integrat. \     API contracts, auth matrices, DB seams
     /-------------\
    /   Component   \   Component & Snapshot Tests (Many)
   /   / Snapshot    \  Isolated UI states, token & transition validation
  /-------------------\
 /     Unit Tests      \ Host-pure Unit Tests (~70%)
/      (FCIS Core)      \ Pure logic, calculations, boundary parsers (<5ms)
-------------------------
```

### Layer Allocation Guidelines

* **Unit Tests (Base ~70%):** Validate pure business logic, calculations, string parsers, and state transitions in milliseconds without spinning up headless browsers.
* **Integration Tests (Middle ~20%):** Verify interaction across boundaries—database containers, API HTTP client responses, and state stores.
* **E2E Tests (Top ~10%):** Restrict expensive browser tests to core business journeys (e.g., User Signs Up $\rightarrow$ Adds to Cart $\rightarrow$ Checks Out).

---

## 4. Playwright Implementation Standards

### 1. Robust Selectors & User-Facing Locators

Avoid testing implementation details (CSS classes, internal tags, fragile XPath). Prioritize locators that reflect user perception:

1. `page.getByRole('button', { name: /submit/i })` (Best for accessibility & resilience)
2. `page.getByLabel('Email Address')`
3. `page.getByTestId('order-confirmation-id')` (Use `data-testid` for dynamic or non-textual data)
4. *Forbidden:* `page.locator('div > div.btn-primary:nth-child(2)')` (Brittle, causes flaky suites)

### 2. Eliminating Flakiness via Deterministic Synchronization

* **Never Hardcode Timeouts:** Strictly ban `page.waitForTimeout(5000)` or manual `sleep()` calls. Rely on Playwright's built-in web-first assertions which poll automatically until conditions are met:

```typescript
// Automatic polling until visible and assertion passes
await expect(page.getByRole('alert')).toBeVisible();
await expect(page.getByTestId('balance-display')).toHaveText('$1,250.00');
```

* **State Isolation:** Each test must run in a dedicated browser context with a clean state. Seed test data via backend APIs or database containers before running tests; never rely on artifacts left by previous tests.

### 3. Transition & Design Token Verification

When testing dynamic interfaces built with design systems (such as Material 3):

* **Wait for Animation Convergence:** If elements transition colors, container sizes, or opacity, ensure transitions finish before evaluating visual assertions (e.g., allow token `--m3e-duration-short` [150ms] to settle).
* **Assert on Tokens, Not Static Pixels:** Assert semantic states and CSS variables (e.g., `--secondary-container`) rather than hardcoded hex codes.

---

## 5. Visual Regression Testing

Visual testing catches unintentional styling shifts across viewport breakpoints:

| Use Case | Priority | Strategy |
| :--- | :--- | :--- |
| **Design System Components** | High | Render components across themes (Light/Dark) and token sets. |
| **Responsive Breakpoints** | High | Assert layouts across mobile (360dp), tablet (600dp), and desktop (840dp+). |
| **Marketing / Static Layouts** | Medium | Pixel diffing against committed baseline screenshots. |
| **Dynamic Data Views** | Low | Mask dynamic timestamps, transaction IDs, or live feeds using Playwright's `mask` option to prevent false positives. |

---

## 6. Integration, Security & API Verification (OWASP API Top 10)

Browser tests must be paired with automated contract and adversarial API assertions:

* **Contract Conformance:** Validate API responses against OpenAPI 3.1 specifications (JSON Schema 2020-12). Reject unexpected fields to mitigate API3:2023 (Broken Object Property Level Authorization).
* **Multi-Role Matrix Replays (API1: BOLA):** Test authenticated routes with distinct user sessions. Capture a resource URL using User A's session, replay using User B's token, and ensure the server responds with HTTP 403 or 404.
* **Error Envelope Validation (RFC 9457 / RFC 7807):** Ensure 4xx/5xx responses return structured problem details with machine-readable codes and non-leaking trace IDs, while keeping internal stack traces redacted.

---

## 7. Configuration & CI/CD Pipeline Standards

Configure `playwright.config.ts` for deterministic CI execution:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // Flake detection via retries
  workers: process.env.CI ? 1 : undefined, // Deterministic sequential runs in CI
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry', // Capture DOM, network, and actions on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 15'] } },
  ],
});
```

---

## 8. Anti-Patterns & Operational Rules

| ❌ Anti-Pattern | ✅ Mandated Solution |
| :--- | :--- |
| Hardcoding `page.waitForTimeout()` | Use Playwright web-first assertions with auto-waiting. |
| Asserting on volatile CSS selectors | Target `getByRole`, semantic accessibility labels, or `data-testid`. |
| Running entire test suites via slow E2E tests | Shift logic down to host unit tests; reserve E2E for critical paths. |
| Testing against shared, mutable staging DBs | Spin up ephemeral database containers or mock external third parties. |
| Concealing script execution outputs | Parse output, summarize clearly, and await confirmation before fixing. |

---

## 9. Verification Scripts Execution Protocol (READ $\rightarrow$ SUMMARIZE $\rightarrow$ ASK)

When executing web automation and validation scripts:

1. **Run the script** and capture complete terminal stdout and stderr.
2. **Classify findings** into Errors, Warnings, and Passed tests.
3. **Present the results using this standard summary:**

```markdown
## Script Execution Results: [script_name.py]

### ❌ Errors Identified (X items)
- [Route/File:Line] Description of failed assertion or broken flow

### ⚠️ Warnings (Y items)
- [Route/File:Line] Latency notice, layout shift, or deprecation

### ✅ Passed Checks (Z items)
- Verified journeys and responsive layouts

**Awaiting instruction: Should I proceed with addressing the identified issues?**
```

4. **Await explicit user confirmation** before refactoring or applying code fixes.
5. **Re-run the verification suite** after modifications to confirm all tests pass cleanly.

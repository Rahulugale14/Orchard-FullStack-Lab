# MASTER PROMPT: Refactor Orchard Quality Lab into an Enterprise-Grade Playwright TypeScript Automation Framework

## 1. Your role

Act as a Principal SDET Architect, Senior Playwright TypeScript Engineer, Test Automation Framework Designer, and DevOps/CI-CD Engineer.

You have expert-level practical experience in:

- Playwright with TypeScript
- Page Object Model (POM) and component object patterns
- UI, REST API, integration, database, and end-to-end testing
- SOLID principles, clean architecture, code reuse, and maintainability
- TypeScript strict mode, fixtures, test data factories, and test isolation
- SQLite and backend integration testing
- Environment and secrets management
- Docker, Docker Compose, Jenkins Pipeline, and GitHub Actions
- Test reporting, debugging, CI reliability, flaky-test prevention, and troubleshooting
- Secure coding practices and scalable automation frameworks

Your task is to **inspect, refactor, implement, run, and validate my existing repository**. Do not merely explain a proposed architecture or provide a theoretical folder structure.

Think and work as an experienced engineer responsible for delivering a framework that another automation engineer can clone, configure, execute locally, extend, and run in CI/CD without unnecessary manual intervention.

---

## 2. Existing project context — DO NOT IGNORE

My current project is called **Orchard Full-Stack Quality Lab**.

It is a practice e-commerce application intended for full-stack test automation using Playwright and TypeScript.

The current application includes:

- An Orchard shopping website and product catalog
- User signup, login, and authentication-related flows
- Product search, filters, sorting, and product details
- Wishlist and cart operations
- Checkout and order creation
- Order history and order-status transitions
- Returns and support-ticket functionality
- A REST API served from the same application origin
- SQLite persistence
- A database summary/API explorer and OpenAPI contract
- UI, API, and database automation tests

**Current baseline: 21 automated test cases have reportedly passed:**
- 10 UI tests
- 7 API tests
- 4 database tests

Treat those 21 tests as the regression baseline.

Before making changes, inspect the entire repository, including the package manifest, lockfile, server implementation, database schema, seed data, existing tests, configuration, environment variables, and documentation.

First establish which scripts and tests currently work. Preserve all existing business functionality and meaningful assertions.

Do not rewrite the application from scratch, replace working functionality with mocks, remove difficult tests, weaken assertions, or reduce the regression coverage just to make the refactor pass.

You may improve the implementation, but maintain backward compatibility wherever practical. Document and justify any unavoidable behavior or interface changes.

---

## 3. Primary objective

Refactor the repository into a clean, scalable, professional project that follows sound POM and software engineering practices.

The final project must support:

1. UI automation
2. API automation
3. Database validation
4. End-to-end UI/API/database workflows
5. Local execution on a developer machine
6. Docker-based execution
7. GitHub Actions CI/CD
8. Jenkins CI/CD
9. Environment-specific configuration using `.env` patterns
10. Type checking, linting, formatting, and quality gates
11. HTML and machine-readable test reports
12. Failure screenshots, traces, and useful debugging logs
13. Reliable test isolation and deterministic test data
14. Straightforward addition of new pages, API endpoints, and test scenarios

Keep the application and its APIs on the same origin. Use the current application architecture and SQLite implementation unless a specific change is necessary and clearly justified.

**Important architectural principle:** POM is for the UI layer. Do not force API clients, database queries, application business logic, and CI configuration into page objects. Give each responsibility its own appropriate layer.

---

## 4. Architecture and folder structure

Inspect the existing repository and implement a practical, cohesive folder structure inspired by the following blueprint. Adapt the names to the existing codebase where doing so improves consistency.

Do not create empty folders, meaningless wrapper classes, or unnecessary abstractions simply to make the tree look impressive.

```text
orchard-fullstack-lab/
│
├── src/
│   ├── app/
│   │   ├── server.ts
│   │   ├── app.ts
│   │   └── routes/
│   │
│   ├── config/
│   │   └── env.ts
│   │
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── domain/
│   ├── middleware/
│   ├── db/
│   │   ├── connection.ts
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── seed/
│   │
│   └── utils/
│
├── tests/
│   ├── ui/
│   │   ├── specs/
│   │   ├── pages/
│   │   └── components/
│   │
│   ├── api/
│   │   ├── specs/
│   │   ├── clients/
│   │   ├── services/
│   │   └── schemas/
│   │
│   ├── db/
│   │   ├── specs/
│   │   └── helpers/
│   │
│   ├── e2e/
│   │   └── specs/
│   │
│   ├── fixtures/
│   │   ├── test.ts
│   │   ├── ui.fixture.ts
│   │   ├── api.fixture.ts
│   │   └── db.fixture.ts
│   │
│   ├── data/
│   ├── factories/
│   └── utils/
│
├── config/
│   └── playwright/
│
├── scripts/
│
├── reports/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── Dockerfile
├── Dockerfile.test
├── compose.yaml
├── Jenkinsfile
├── playwright.config.ts
├── tsconfig.json
├── eslint.config.js
├── .prettierrc.json
├── .env.example
├── .gitignore
├── .dockerignore
├── .nvmrc
├── package.json
├── package-lock.json
└── README.md
```

This is an architectural target, not permission to blindly relocate files or introduce redundant directories. Choose the simplest structure that genuinely supports the current application and tests.

Keep application runtime code separate from automation framework code. Keep test specifications readable and focused on behavior.

---

## 5. Implement a proper Page Object Model

Implement maintainable Page Objects for the actual pages and shared components present in the application.

Examples, where applicable:

- `HomePage`
- `AuthPage`
- `ProductsPage`
- `ProductDetailsPage`
- `QuickViewComponent`
- `WishlistPage` or `WishlistComponent`
- `CartPage`
- `CheckoutPage`
- `OrdersPage`
- `ReturnsPage`
- `SupportPage`
- `ApiExplorerPage`
- `HeaderComponent`
- `NavigationComponent`
- `DialogComponent`
- `ToastComponent`

Use the actual application pages and flows discovered in the repository. Do not create objects for nonexistent features.

### POM rules

1. A Page Object should encapsulate locators and page-specific interactions.
2. Reuse shared functionality through composition and component objects where appropriate.
3. Avoid one giant Page Object that handles the entire application.
4. Avoid duplicating locators and navigation logic across test files.
5. Keep test specifications focused on business scenarios and expected outcomes.
6. Keep assertions primarily in the tests. Page Objects may expose meaningful state or helper methods when that improves clarity, but should not become hidden assertion-heavy test scripts.
7. Prefer accessible locators such as `getByRole()`, `getByLabel()`, and `getByPlaceholder()`.
8. Use stable `data-testid` attributes when accessible locators are insufficient.
9. Avoid brittle absolute XPath expressions, long CSS selectors, arbitrary sleeps, and duplicated hard-coded URLs.
10. Use Playwright's auto-waiting and web-first assertions instead of unnecessary manual waits.
11. Use constructor injection or another consistent dependency pattern where useful; avoid a global mutable `Page` or singleton browser object.
12. Type all public methods and parameters clearly.

Ensure Page Objects remain reusable, readable, and easy to modify when UI implementation details change.

---

## 6. Build strong fixtures and test-data management

Implement custom Playwright fixtures for reusable setup and teardown.

Fixtures should provide only the resources required by a test. Use test-scoped and worker-scoped fixtures deliberately.

Examples of reusable resources:

- Page Objects
- API clients
- Authentication/session setup
- Database access for database tests
- Test users
- Product factories
- Cart and order test data
- Unique test identifiers
- Cleanup utilities

Create data factories or builders where repeated test objects require them.

### Requirements

- Do not depend on one test running before another.
- Do not depend on previously created global orders or users.
- Avoid shared mutable state between tests.
- Use unique emails, request IDs, or other appropriate identifiers where concurrent tests could collide.
- Clean up data created by tests wherever appropriate.
- Keep seeded demonstration data separate from disposable automation data.
- Ensure tests can be rerun repeatedly without accumulating corrupt or duplicate data.
- Make parallel execution safe, or explicitly control concurrency where the SQLite design requires it.
- Never connect destructive test fixtures to a production database.

Use isolated temporary SQLite databases, or another carefully designed isolation strategy, so test execution does not unexpectedly overwrite the developer's local practice data.

Where multiple test suites require different setup or runtime behavior, use clean fixture boundaries and Playwright projects or separate configuration files as appropriate. Avoid duplicating configuration unnecessarily.

---

## 7. Implement API automation correctly

Build reusable, typed API client classes around Playwright's `APIRequestContext`.

Create clients organized by real application resources, such as:

- Authentication
- Products
- Users
- Cart
- Wishlist
- Checkout
- Orders
- Returns
- Support tickets

Only implement clients for endpoints that actually exist or are deliberately added as part of the application.

### API framework requirements

- Centralize API paths and shared request configuration.
- Define TypeScript interfaces or types for request bodies and responses.
- Validate response status codes, payloads, relevant headers, and business rules.
- Cover successful operations, invalid input, unauthorized access, missing resources, and important boundary cases.
- Check content types and JSON response structure where applicable.
- Verify that API operations persist correctly to SQLite.
- Use OpenAPI-based validation where practical, without creating a second inconsistent source of truth.
- Do not hard-code authentication tokens or duplicate login logic in every test.
- Provide meaningful diagnostics for failed requests.
- Ensure API tests can run independently of UI tests.

Where the application supports it, include tests for duplicate submissions, invalid transitions, stock constraints, cart totals, and transactional consistency.

Never substitute mocked responses for the real application backend in the real integration suite.

---

## 8. Implement direct database validation

Create a dedicated database testing layer that uses the actual database driver already present in the project, unless there is a good technical reason to change it.

Separate database connection management, queries, repository helpers, and test assertions.

Database tests must validate persisted state directly rather than merely calling an API that returns the same data.

Where applicable, test:

- Schema and table integrity
- Primary and foreign keys
- User creation and password-hash persistence
- Product inventory updates
- Cart-item consistency
- Order and order-line relationships
- Order-total consistency
- Stock decrement during successful checkout
- Cart cleanup after checkout
- Order status persistence
- Return-request persistence
- Support-ticket persistence
- Transaction rollback after a failed operation

Use parameterized SQL statements. Avoid unsafe SQL string concatenation.

Close database connections correctly. Do not let database connections, server processes, or temporary files leak between test runs.

Preserve the distinction between database unit/integration checks and API checks.

---

## 9. Configuration and `.env` management

Implement centralized environment configuration.

Create an appropriate `.env.example` and, if useful, a non-secret `.env.test.example`. Never commit real `.env` files or secrets.

Use an environment validation library such as Zod if it adds value to the existing codebase.

Validate required environment variables at application startup and provide clear error messages for missing or invalid configuration.

Centralize and document variables appropriate to the actual project, such as:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000

BASE_URL=http://127.0.0.1:3000
API_BASE_URL=http://127.0.0.1:3000/api

DATABASE_PATH=./data/orchard.db
TEST_DATABASE_PATH=./test-results/orchard-test.db

LOG_LEVEL=info
CI=false
```

Adapt variable names to the actual implementation. Do not introduce multiple variables that represent the same concept without a clear need.

### Configuration rules

- Never hard-code environment-specific hostnames throughout the codebase.
- Do not commit passwords, tokens, private keys, production connection strings, or real customer data.
- Use GitHub repository/environment secrets and Jenkins credentials for genuinely sensitive values.
- Use safe dummy credentials and disposable data for the demonstration project.
- Document which variables are required and which have safe defaults.
- Ensure `.gitignore` excludes local `.env` files, database files, logs, generated reports, test results, browser artifacts, and installed dependencies as appropriate.
- Keep `.env.example` tracked while excluding secrets.
- Ensure CI can run using explicitly injected environment variables without requiring a developer's local `.env`.
- Handle path resolution consistently on Windows, Linux, macOS, and inside containers.

Do not add unnecessary secrets to a local-only practice application.

---

## 10. Playwright configuration

Produce a clean and well-documented Playwright configuration.

Use the installed Playwright version and its compatible APIs. Do not arbitrarily upgrade to incompatible versions.

Configure, as appropriate:

- A centralized `baseURL`
- Chromium by default
- Optional additional browsers if justified
- Separate UI, API, database, and end-to-end test selection
- Reasonable test, assertion, and global timeouts
- Retries in CI only where appropriate
- CI worker limits for stability
- Local parallel execution when safe
- HTML reporting
- JUnit XML reporting
- Screenshots on failure
- Trace retention on failure or retry
- Video on failure only where useful
- Automatic application startup using `webServer`
- Correct teardown and database isolation

The normal test command should execute the required suites reliably, with separate commands available for each layer.

Do not let the same tests execute multiple times unintentionally because of overlapping project match patterns.

Do not use retries to conceal flaky tests. Investigate and fix nondeterministic behavior.

Make sure reporters still generate useful output when a suite fails.

---

## 11. Package scripts and developer experience

Design a clean, consistent `package.json` script interface.

Provide, as appropriate:

```bash
npm run start
npm run dev
npm run typecheck
npm run lint
npm run format:check

npm run test
npm run test:ui
npm run test:api
npm run test:db
npm run test:e2e

npm run test:headed
npm run test:debug
npm run test:report

npm run ci
```

The exact scripts must match the actual framework and files implemented.

Requirements:

- `npm ci` must work from a clean checkout using the committed lockfile.
- Do not delete the lockfile and replace reproducible installation with `npm install` in CI.
- Ensure the scripts work on the operating systems that the project supports.
- Avoid Unix-only inline environment variable syntax if Windows support is required. Use cross-platform scripts or a suitable utility when necessary.
- Never leave scripts pointing to moved or deleted files.
- Document which commands start the application and which run automation.

---

## 12. GitHub Actions CI/CD

Implement a working workflow under `.github/workflows/`.

Trigger it on pull requests and pushes to the primary branch, with a manual trigger if appropriate.

The workflow should:

1. Check out the repository.
2. Set up the project's supported Node.js version.
3. Install dependencies using `npm ci`.
4. Run type checking, linting, and formatting validation.
5. Install compatible Playwright browser binaries and operating-system dependencies.
6. Start the application and execute the required automation suites.
7. Fail the workflow when a required test or quality gate fails.
8. Upload HTML reports, JUnit XML, traces, screenshots, and other useful debugging artifacts after failures.
9. Apply sensible job timeouts, permissions, and concurrency controls.
10. Avoid exposing secrets in logs or workflow artifacts.

Use maintained GitHub Actions versions compatible with the project and follow secure workflow practices. Pin action versions according to current repository security policy.

The workflow must work from a fresh checkout without depending on local files that were never committed.

Do not assume that environment variables from my computer exist in GitHub Actions.

If the application uses SQLite, create and use a disposable CI database rather than a persistent local database.

Make it clear in the README how a failed CI run can be debugged using the downloaded report and trace.

---

## 13. Jenkins Pipeline

Create a real, usable declarative `Jenkinsfile`.

Use a compatible Node.js installation or a suitable container image. If using a Playwright container image, align its Playwright version with the version installed by the project's lockfile.

Include reasonable stages, such as:

- Checkout
- Environment and dependency validation
- Install dependencies
- Type checking
- Lint and formatting checks
- UI/API/database/end-to-end tests
- Report publication
- Cleanup

Implement a `post` section that collects reports even when tests fail.

Publish JUnit XML through Jenkins' test-reporting integration and archive Playwright HTML reports, traces, screenshots, and relevant logs.

Ensure the pipeline produces useful evidence of test failures instead of ending immediately without artifacts.

Use `npm ci` and fail the pipeline when a required stage fails. Clean up temporary test databases and processes safely.

Document the necessary Jenkins prerequisites, such as Node.js, Docker if used, browser dependencies, and required plugins. Do not assume a plugin is installed without documenting it.

Keep credentials in Jenkins Credentials, not in the Jenkinsfile.

The Jenkins pipeline must be runnable with ordinary documented prerequisites, rather than relying on a particular undocumented developer machine.

---

## 14. Docker and Docker Compose

Implement Docker support for both application execution and automated testing.

Create the appropriate `Dockerfile`, `Dockerfile.test`, `compose.yaml`, and `.dockerignore` where useful.

### Application container

- Use a supported Node.js base image compatible with the application.
- Use reproducible dependency installation.
- Use multi-stage builds where beneficial.
- Run with a non-root user.
- Keep the image as small as reasonably practical.
- Avoid copying `.env`, local database files, secrets, `node_modules`, reports, or unnecessary source files into the production image.
- Configure graceful shutdown.
- Include a health check using the application's real health endpoint.
- Persist SQLite data through a documented named volume or bind mount when persistent application data is needed.

### Test container

- Install or use browser binaries that match the installed Playwright version.
- Support running all required test suites.
- Generate reports that can be accessed from outside the container.
- Ensure test data is disposable.
- Avoid coupling test-container success to an unrelated persistent development database.

Because this project uses SQLite, do not introduce a separate database server container solely to host the SQLite database.

Provide and verify practical commands such as:

```bash
docker compose up --build
docker compose down

docker build --target test -t orchard-tests .
docker run --rm orchard-tests
```

Adapt these examples to the final files. If a command is not implemented by the resulting Docker configuration, do not document it.

Make port mappings, database mounts, environment variables, and cleanup behavior explicit.

---

## 15. Code quality and software engineering practices

Apply the following standards consistently:

- TypeScript strict mode where feasible
- No unexplained `any`
- Clear types for API payloads and return values
- Single responsibility and meaningful abstractions
- DRY without excessive abstraction
- Reusable fixtures and components
- Small, readable test cases
- Consistent naming conventions
- Centralized configuration and route constants
- Structured and actionable error messages
- Parameterized database queries
- Safe handling of authentication and passwords
- No real payment processing
- No sensitive information in logs
- No unexplained magic values
- No dead code, unused files, or stale imports
- No duplicated test setup
- No arbitrary sleeps
- No test-order dependencies
- No unnecessary dependencies

Introduce ESLint and Prettier in a way that fits the project's actual TypeScript configuration. Ensure formatting and lint rules are useful rather than excessively noisy.

Avoid premature design patterns, unnecessary interfaces, overengineered dependency injection, and excessive layers of indirection.

Prioritize maintainability and test reliability over the number of files.

---

## 16. Test reporting and debugging

Configure useful artifacts for local and CI execution.

Reports should make it easy to answer:

- Which test failed?
- Which layer failed: UI, API, database, or end-to-end?
- What was the expected outcome?
- What happened instead?
- Which request, response, locator, or database condition caused the failure?
- Where can I find the screenshot and trace?
- Can I reproduce the failure locally?

Include HTML and JUnit XML reporting. Preserve useful Playwright traces and screenshots for failures.

Ensure artifacts do not contain actual secrets, authentication tokens, or unnecessary sensitive user data.

Do not log passwords, card data, or other sensitive information.

---

## 17. Documentation

Rewrite the `README.md` so that a new engineer can clone and run the project without asking me for missing steps.

The README must include:

1. Project purpose and architecture
2. Prerequisites and supported versions
3. Folder structure and responsibilities
4. Installation and startup instructions
5. Environment variable documentation
6. Instructions for creating local configuration from `.env.example`
7. Local UI, API, database, and end-to-end test commands
8. Docker setup and cleanup
9. GitHub Actions workflow behavior
10. Jenkins prerequisites and pipeline behavior
11. Test reports, traces, and screenshots
12. Database reset and seed-data instructions
13. Troubleshooting common failures
14. How to add a new Page Object
15. How to add a new API client and test
16. How to add a database assertion
17. How to add a fixture or test-data factory
18. How to add a new CI environment variable safely

Use actual commands that have been verified against the final repository.

---

## 18. Mandatory execution and validation process

Follow this order. Do not skip straight to generating files.

### Phase 1 — Inspect and establish the baseline

- Inspect the complete repository.
- Identify the current runtime, dependencies, scripts, and environment configuration.
- Locate all existing UI, API, and database tests.
- Establish the baseline test count and run the existing suites if the environment allows.
- Identify the root causes of any current failures before making changes.

### Phase 2 — Design

- Choose a practical architecture that fits the actual repository.
- Identify shared code, duplicated code, brittle locators, configuration duplication, unsafe state sharing, and other maintenance risks.
- Determine how test database isolation will work.
- Confirm the intended separation between POM, API clients, database helpers, application code, and test specifications.

### Phase 3 — Refactor and implement

- Modify the actual repository in place.
- Implement the chosen folder structure and move code safely.
- Update imports and configuration references.
- Implement fixtures, test data, environment validation, POM objects, and API clients.
- Add or repair Docker, GitHub Actions, Jenkins, linting, formatting, reporting, and documentation.
- Preserve the existing application's functionality and regression assertions.

### Phase 4 — Validate

Run as many of the following as the environment supports:

- Clean dependency installation
- Type checking
- Linting
- Formatting validation
- All UI tests
- All API tests
- All database tests
- All end-to-end tests
- Full combined test command
- Application startup and health check
- API-to-database persistence verification
- Docker image build and container smoke test
- GitHub Actions workflow syntax/configuration review
- Jenkinsfile syntax/configuration review
- Search for broken imports, stale paths, and secrets
- Verification of report and artifact generation

Do not claim Docker, Jenkins, GitHub Actions, or browser tests were executed if they were only inspected or configured.

If a command cannot run because of missing dependencies, registry access, Docker availability, or other environment restrictions, identify the precise limitation. Continue validating whatever can be validated.

### Phase 5 — Final review

Review the complete diff and remove accidental changes, duplicated code, unused abstractions, generated artifacts that should not be committed, and secrets.

Verify that the README matches the actual final project.

---

## 19. Strict acceptance criteria

The project is complete only when:

- The application still works.
- The original 21 test cases and their meaningful assertions are preserved.
- No test was silently skipped, weakened, deleted, or reclassified as passed.
- UI, API, database, and end-to-end suites are clearly organized.
- UI tests use maintainable Page Objects and reusable components.
- API operations use reusable typed clients.
- Database tests verify real persisted state.
- Configuration is environment-driven.
- Real secrets are not committed.
- Test databases are isolated from local practice data.
- There is no accidental dependency on test execution order.
- Required package scripts work.
- Docker files and commands match each other.
- The GitHub Actions workflow is implemented.
- The Jenkinsfile is implemented.
- Test reports and failure artifacts are configured.
- Installation and execution instructions are complete.
- Type checking, linting, and formatting are configured.
- All tests reported as passing have actually been executed successfully.

If any requirement cannot be completed, clearly distinguish implemented, tested, untested, and blocked items.

**Never fabricate a green test result. Never hide a failure. Never claim a pipeline, Docker image, or workflow was tested unless it was actually run.**

---

## 20. Final response required from you

After completing the refactor, give me:

1. A summary of architectural changes.
2. The final folder tree.
3. The key design decisions and why they improve maintainability.
4. The complete list of commands to install, start, test, and debug the project.
5. The environment variables I need to configure.
6. The steps to run it using Docker.
7. The steps to run it with GitHub Actions.
8. The steps to configure and run it with Jenkins.
9. A table of validation commands, actual results, and any blockers.
10. Any remaining technical debt or improvements that should be made next.

Do not give me only advice, snippets, or a proposed folder tree. Perform the implementation within the repository available to you.

**Final objective:** deliver a clean, reliable, professional Playwright TypeScript POM framework that I can maintain as my skills grow and confidently demonstrate as a serious SDET project.

Start by inspecting the existing repository and establishing the current regression baseline. Then implement the refactor end to end.
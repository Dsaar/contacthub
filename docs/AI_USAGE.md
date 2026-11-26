# AI usage

Codex implemented this foundation from the user's assignment prompt, ran the checks recorded in [Testing](TESTING.md), and prepared the Git commit. Verification described here was performed by the agent.

## Assignment prompt (summary)

Build the foundation of ContactHub for a Wix Developer Relations Expert job interview home assignment. The eventual external dashboard must connect to a real Wix site using API key authentication and the Wix Contacts V4 REST API. Users will retrieve, search, create, edit, and delete contacts. Stop at the foundation and wait for an explicit request before starting Wix integration.

The user specified the following deliverables.

- Inspect the working directory and initialize Git if needed. Use npm workspaces with a React, TypeScript, Vite, and Tailwind CSS client and a Node.js, Express, and TypeScript server. Use Zod, dotenv, and Vitest. Enable strict TypeScript and select current stable, mutually compatible dependencies.
- Display “ContactHub - Wix Contacts Manager”. Serve JSON from `GET /api/health` with exactly `{"status":"ok","service":"contacthub-api"}`. Bind the frontend and backend to localhost on ports 5173 and 3000 respectively. Proxy frontend requests to `/api` to the backend in development.
- Provide root scripts for development, build, lint, typecheck, and testing. Ignore dependencies, build outputs, logs, coverage, and environment files. Track the example with blank `WIX_API_KEY` and `WIX_SITE_ID` fields and `PORT=3000`. Keep real credentials out of the project and frontend.
- Add a README covering the objective, architecture, prerequisites, and setup. Create `docs/AI_USAGE.md`, `docs/TESTING.md`, and `docs/screenshots/`. Document the prompt and decisions honestly. Claim only tests and verification actually performed.
- Add an automated health endpoint test. Run build, lint, typecheck, and tests, fixing failures. Review the Git diff and check tracked files for sensitive information. Commit with the message `chore: initialize ContactHub project foundation`.
- Defer the Wix API integration and all contact CRUD. Exclude a database, OAuth, Wix SDK, webhooks, and mock contact data. Wix will be the single source of truth.
- Report the files created, architecture, installed dependencies, startup commands, verification results, commit hash, assumptions, limitations, and unresolved issues.

## Implementation decisions

- The directory contained an empty Git repository on `main`, which the project reused.
- Node 24 supports running erasable TypeScript directly in watch mode. The server's build emits standard ES modules with JavaScript import paths. Direct dependency versions are pinned and the root lockfile covers both workspaces. Node type definitions follow the runtime's major version.
- Vite's React and Tailwind plugins handle the browser build. The UI is a single heading matching the requested text. Using the explicit loopback address `127.0.0.1` on both sides keeps the proxy independent of IPv4/IPv6 hostname resolution.
- Express route definitions live separately from startup. Vitest exercises the same app over HTTP on an ephemeral port without requiring either development server. Native fetch supplies the HTTP client.
- Zod validates the backend port. The example reserves the two future Wix configuration names. No runtime code reads Wix credentials or calls Wix in this stage.
- Concurrently starts and stops both development processes. Oxlint checks TypeScript and TSX with warnings treated as failures. The screenshot directory contains a Git placeholder so a fresh clone includes it.

## Stage 2 assignment prompt (summary)

Continue the committed foundation with a server-side Wix REST client and the first read-only contacts route. Follow the four linked official REST references and the supplied anonymized response. Keep existing architecture and the health test. Defer search, contact mutations, the frontend dashboard, storage, OAuth, and webhooks.

The user requested workspace-independent dotenv and Zod configuration for the API key, site ID, and port, plus a useful error when Wix settings are missing. Use native fetch, the raw key and site header, and a timeout. Preserve useful status and request ID information for Wix errors. Protect credentials and private contact data, and leave the user's actual environment file untouched.

Expose paged contact queries at `GET /api/contacts` using `POST /contacts/v4/contacts/query`. Validate limit and offset locally with defaults of 10 and 0 and a local limit cap of 100. Support sparse and extensible Wix responses. Preserve ID and revision and select only the dashboard's personal, company, timestamp, and membership fields.

Use fictional contacts and dummy credentials to test request construction, pagination, sparse and empty results, configuration, upstream errors, timeout, malformed responses, and leakage. Preserve the independent verification supplied with the prompt. Update setup, curl examples, authentication references, troubleshooting, and testing records. Run tests, lint, typecheck, and build, review the diff, and commit as `feat: implement Wix API client and contacts query`.

### AI-generated implementation

Codex wrote the config loader, transport, schemas, mapping, route, and tests. The environment path is relative to the server module so source and compiled startup resolve the same file. Only startup loads dotenv. The tests disable Vite environment-file discovery, stub the credential variables, and replace outgoing fetch. They exercise Express over loopback.

The transport keeps its origin fixed, declines redirects, and applies the deadline to both fetch and response consumption. Public errors are assembled from fixed messages and bounded diagnostic fields. The service accepts unknown Wix fields and explicitly selects browser-visible data. An absent revision stays null. Membership is based on the member ID in the supplied verified example. The testing record distinguishes the user's independent observations from Codex's automated checks.

## Stage 3 assignment prompt (summary)

Extend commit `b08136e` with individual GET, POST, PATCH and DELETE through the official Wix Contacts V4 REST API. Retain health, pagination, the existing architecture, all 35 tests and the normalized public contact model. Verify methods, bodies, responses, field masks, duplicate detection, revision handling and documented errors. Allow partial edits and explicit clears of six fields while preserving unrelated data. Guard member email changes, protected deletions, and merged source IDs. Validate inputs, origins, content types and size. Keep secrets server-side and do not inspect the real environment file.

Use dummy fixtures and mock all Wix calls. Leave the existing member/contributor contact alone. Add safe independent verification commands and document the user-supplied live query results separately from the pending live CRUD work. Run the four project checks, review the Git diff, commit the stage, and stop at the backend.

### AI-generated implementation and verification

Codex extended the contacts service, router and existing transport. The Wix reference was consulted in its REST sections. The update schema lists `info`, `revision` and optional duplicate control. The implementation selects fields in the PATCH body, without adding an undocumented mask. Email and phone edits use a full preflight read, retain writable secondary details and send the caller's original revision. A preflight revision mismatch stops the write. The documented upstream 409 codes distinguish a concurrent edit from a duplicate. GET may resolve a merged source. Mutations require an exact target ID.

Application choices include GUID validation, common phone formatting and extensions, explicit JSON null for clearing, a 16 KiB JSON limit, local Host/Origin checks, and no mutation retries. Member protections use the existing member ID signal and Wix's definitive rejection codes. No private upstream payloads are included in public errors. The README documents remaining limits on identity, clearing and public deployment.

Codex wrote the mocked HTTP tests and disposable-contact shell procedure. The shell procedure was exercised against a mocked transport only. The user independently verified the previous live query stage. Independent live CRUD verification is pending. See [Testing](TESTING.md).

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

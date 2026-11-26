# Foundation verification

Codex ran the following checks on November 26, 2026, using Node.js 24.22.3 and npm 11.19.1.

| Check | Observed result |
| --- | --- |
| `npm ci` with offline cache, strict peers, and strict engines | Lockfile installation succeeded. npm reported an install-script advisory for the optional macOS dependency fsevents. |
| `npm run build` | Vite generated client HTML, JavaScript, and CSS. TypeScript emitted the Express server. |
| `npm run lint` | Oxlint exited successfully with warnings treated as failures. |
| `npm run typecheck` | Browser code, Vite configuration, server code, and test passed their strict TypeScript checks. |
| `npm test` | One test file and one HTTP test passed. |

## Automated health test

`server/test/health.test.ts` starts the Express app on an available loopback port and sends a real HTTP GET to `/api/health`. It asserts status 200, a JSON content type, and the exact body `{"status":"ok","service":"contacthub-api"}`. The test closes its listener on exit.

The first run in the restricted sandbox failed at socket creation with `EPERM`. The same test passed when rerun with loopback access.

## Development smoke check

Codex started both servers using the root `npm run dev` script. HTTP requests to `/api/health` on ports 3000 and 5173 both returned 200 and the expected JSON. A request to `/` on port 5173 returned 200 with the expected page title, and the transformed React entry module contained the placeholder text. The servers were stopped after the check.

The frontend checks covered HTTP delivery and module content. Browser rendering and independent human review were outside this verification. Wix integration and contact workflows are deferred.

## Stage 2 independent verification supplied by the user

The user reported running Node.js 24.22.3 and npm 11.19.1 locally. The React placeholder rendered. Both the direct health endpoint on port 3000 and the Vite-proxied health endpoint on port 5173 returned HTTP 200. An earlier run with Node.js 22.15.0 encountered `ERR_UNKNOWN_FILE_EXTENSION`. Running `nvm install`, `nvm use`, and `npm ci` resolved the issue.

The user also reported a separate direct curl request to the live Wix API that returned HTTP 200 with one contact. The prompt supplied an anonymized response structure. This check predates the ContactHub contacts route.

## Stage 2 automated checks

Vitest exercises the real Express routes over loopback while replacing the outbound Wix fetch with a mock. Tests provide fictional contact details and dummy credentials. Vitest environment-file discovery is disabled. The original health endpoint test is retained.

The suite covers URL, method, headers, body, pagination defaults and bounds, empty and sparse contacts, field selection, missing configuration, Wix HTTP errors, network failure, deadline expiry, malformed JSON and response shapes, and sanitized error output. The timeout test shortens the native signal's deadline and verifies the production code requested ten seconds.

Codex ran the final checks on Node.js 24.22.3 and npm 11.19.1.

| Command or check | Observed result |
| --- | --- |
| `npm test` | 35 tests passed across 2 files, including the original health test. |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed for both workspaces after correcting test assertions on JSON values typed as unknown. |
| `npm run build` | Vite bundled the client and TypeScript compiled the server. |
| Configuration lookup | In a temporary directory with a dummy server environment file, the source and compiled loaders both resolved identical settings from root and server working directories. |

## Pending live verification

An independent end-to-end call through the new ContactHub route to the real site is pending. With the documented server settings and both development servers running, use the local curl examples in the README. Check status, contact IDs and revisions, the selected dashboard fields and page metadata privately. The automated suite does not call the live Wix API.

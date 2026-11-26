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

## Stage 2 live query verification completed independently

The user reported HTTP 200 for health and for the local contacts query with real Wix data, including through the Vite proxy. A limit of 1 worked. Offset 1 returned an empty list. Both `limit=abc` and `limit=101` returned HTTP 400. The site contained one member/contributor contact. No private contact data was recorded.

## Stage 3 automated verification

Codex ran the following checks with Node 24. The two original test files were preserved. The new suite exercises Express over loopback, with fictional fixtures and all outbound Wix fetch calls mocked. Tests disable dotenv file discovery and do not start the credential-loading entry point.

| Check | Result |
| --- | --- |
| `npm test` | 109 passed in 3 files, comprising the previous 35 and 74 new tests |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed in both workspaces |
| `npm run build` | Passed for the client bundle and compiled server |
| Manual verification script | Bash syntax passed. Codex exercised the script against the compiled Express app on a temporary loopback port with a disposable in-memory Wix mock. It completed its create, GET, PATCH, DELETE and final 404 assertions. |

Coverage includes exact Wix methods, headers and request bodies, optional fields, lengths, GUIDs, revisions, JSON parsing, duplicate and stale-revision codes, field clearing and list preservation, member and billing restrictions, merged IDs, malformed success results, upstream failures and credential-safe errors. HTTP tests include accepted same-origin writes, rejected foreign Origin/Host and cross-site requests, size limits, and media types. One initial header test failed because the fetch client controlled a header. The final test sends the intended wire headers with Node's HTTP client.

## Stage 3 independent verification pending

Live individual retrieval and live mutations through ContactHub remain unverified. The README gives commands for an independent run using only a newly created disposable contact. Wix's actual normalization of cleared text, primary reassignment, generated list item IDs, and permission configuration should also be checked on disposable data as relevant. Codex made no live Wix calls during this stage.

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

## Independent live backend verification — November 26, 2026

The user ran `scripts/verify-live-crud.sh` against the actual Wix site and reported a successful create, retrieve, update, and delete lifecycle. The separate local API observations below were supplied by the user. Contact IDs, request IDs, contact values, and credentials are omitted.

| Operation | Independently observed |
| --- | --- |
| POST a disposable contact | HTTP 201, revision 1 |
| GET by ID | HTTP 200 |
| PATCH first name and job title | HTTP 200, revision 2. Last name, email, phone, and company were preserved. |
| PATCH with stale revision 1 | HTTP 409, `REVISION_CONFLICT` |
| POST invalid email | HTTP 400, `INVALID_INPUT` |
| POST an existing email | HTTP 409, `DUPLICATE_CONTACT`. Upstream status and a Wix request ID were present. |
| DELETE the disposable contact | HTTP 204 |
| GET after deletion | HTTP 404, `WIX_NOT_FOUND` |

The user also observed an internationally formatted input returned as a national-format phone. Raw metadata for that transaction was not supplied. The later human browser check also covered the native Wix dashboard.

## Stage 4 automated checks

Codex ran the root commands with Node 24.22.3 and npm 11.19.1.

| Check | Result |
| --- | --- |
| `npm test` | 141 passed in five files. The client ran 22 tests and the server ran 119, including the previous 109. |
| `npm run lint` | Passed with warnings treated as failures. |
| `npm run typecheck` | Passed for both workspaces, including client tests. |
| `npm run build` | Vite bundled the dashboard and TypeScript compiled the Express service. |

React Testing Library and jsdom tests mock the local application API. They cover list and optional fields, details, empty/loading/refresh/error states, delayed results, field search, paging with unknown totals, create validation and duplicate failure, edit payloads and deliberate clears, conflict review, member restrictions, deletion failure and confirmation, and recovery from the last row disappearing. API-client tests exercise relative URLs, JSON and 204 handling, malformed mutation confirmations and diagnostics. Backend HTTP tests mock outgoing Wix fetch and check all six filter mappings, invalid search inputs, and phone metadata. The test configurations disable environment-file discovery.

### Actual browser rendering with mocked data

Codex used Playwright with headless Chrome 158.0.8127.37 and the production client bundle on an isolated loopback static server. All application API requests were intercepted and answered with four fictional contacts. External network requests were blocked. The browser exercised desktop and mobile rendering, scoped search, details, member email protection, native dialog Tab/Escape behavior and focus restoration. There were no page exceptions, no horizontal overflow at widths of 320, 390, 768 or 1280 pixels, and zero mutation requests. The screenshots show fictional fixtures. [Desktop](screenshots/dashboard-desktop-mocked.png) · [Mobile](screenshots/dashboard-mobile-mocked.png)

### Live checks at the end of stage 4

The user subsequently confirmed that the browser retrieved live contacts and reported the write failure investigated below. First-name search and the native dashboard were verified in the subsequent human retest below. The raw phone metadata from that transaction is still unknown. The README includes a disposable-contact procedure.

## Dashboard write failure through the Vite proxy

**Independent discovery.** The user retrieved real Wix contacts in Chrome. Submitting Add Contact returned HTTP 403 with the message “Use the local ContactHub origin for writes.” Both `http://localhost:5173` and `http://127.0.0.1:5173` reproduced the failure. Direct curl CRUD on port 3000 had previously succeeded. DevTools on the numeric address showed a matching browser Host and Origin, the local page Referer, JSON content type, Fetch Metadata values `same-origin` and `cors`, and a JSON response with `X-Powered-By: Express`.

**Isolated reproduction before the fix.** Codex ran the installed Vite 8.3.8 development proxy and the actual Express app on separate temporary loopback sockets. Node's HTTP client sent the reported browser headers for each local authority. Only the proxy destination was pointed at the isolated backend. The test imported the Express app directly, disabled Vite environment-file discovery, and replaced the Wix transport's fetch with a mock. Both POSTs returned `403 ORIGIN_REJECTED` with zero Wix calls.

| Header | Input to Vite | Express received before fix |
| --- | --- | --- |
| Host | `localhost:5173` or `127.0.0.1:5173` | `127.0.0.1:55513` for both in the capture. Port 55513 was the isolated backend port. The configured development target uses port 3000. |
| Origin | `http://` plus the original Host | Same value as input |
| Referer | Original page URL ending in `/` | Same value as input |
| Content-Type | `application/json` | Same value as input |
| Sec-Fetch-Site / Sec-Fetch-Mode | `same-origin` / `cors` | Same values as input |
| Forwarded / X-Forwarded-Host, -Port, -Proto, -For | Absent | Absent |

Vite expands a string proxy target to an object with `changeOrigin: true`. The contacts middleware accepts a local Host, then requires a supplied Origin to equal `http://` plus that Host. Rewriting the port made that comparison fail. GET bypasses the write guard. Direct curl with a local Host may omit Origin.

**Fix and regression results.** The client proxy uses the same target with explicit `changeOrigin: false`. Express now receives the original frontend Host and matching Origin. Its Host allowlist, exact Origin comparison, and cross-site rejection still apply. CORS and forwarded-header trust settings were left intact.

The two positive integration cases failed on the rewritten Host before the fix. After the fix, all 11 new tests passed. Each local address completed POST (201), PATCH (200), and DELETE (204) through Vite. A direct local curl POST with no Origin returned 201. External, lookalike, null, malformed, wrong-port, mismatched local origins and cross-site requests returned 403 before Wix. The suite uses the client proxy rule and substitutes only the isolated destination, so restoring the original shorthand reproduces the regression.

At commit `81a8466`, `npm test` passed 152 tests (22 frontend and 130 backend/integration). Lint, typecheck and build passed. The proxy tests used browser-shaped HTTP requests and mocked Wix.

## Independent human retest after the proxy fix

The user confirmed the live browser workflow on both `http://localhost:5173` and `http://127.0.0.1:5173`. The following observations come from the user's testing and screenshots of the submitted dashboard.

| Workflow | Human observation |
| --- | --- |
| Directory | Live contacts rendered with Wix connected. The native Wix Contacts dashboard showed five contacts, consistent with ContactHub at that stage. |
| Create and edit | The Add form opened, creation succeeded, and the created contacts appeared in Wix's native dashboard. The Edit form opened and the company changed from `Example` to `Example2`. |
| Search and duplicates | First-name search returned the expected result. A duplicate contact was rejected. |
| Delete | The site-member row showed a protected deletion control. A disposable contact had an explicit confirmation dialog and was successfully deleted. |
| Mobile | The directory rendered in its responsive mobile layout. |

The two tracked screenshots show fictional fixtures from the earlier AI-run browser check. The user's live screenshots are summarized here without personal contact data.

## Audit remediation verification

The independent AI code review reproduced phone-entry collisions, inconsistent primary selection, an ambiguous phone-only delete prompt, and actionable stale rows after deletion. It identified the read-route Host check and upstream ID gaps by inspecting the implementation and fixtures. Codex ran the remediation checks on November 27, 2026 with Node 24.22.3 and npm 11.19.1.

| Command | Result |
| --- | --- |
| `npm test` | 174 passed in six files, including all 152 baseline cases. The client passed 29 and the backend/integration suite passed 145. |
| `npm run lint` | Passed with warnings treated as failures. |
| `npm run typecheck` | Passed for both workspaces and their tests. |
| `npm run build` | Vite built the client and TypeScript compiled the Express server. |

The 22 new regression cases cover the following behavior.

- Real Vite-to-Express list and detail reads work on both local hostnames. The original POST, PATCH and DELETE proxy tests still run. Direct contact reads with an untrusted Host stop before the mocked Wix call.
- Directory, editor, and details views select the primary entry when two countries share a national phone string. HTTP tests inspect the outgoing PATCH for sparse summaries, replacement, removal, retained secondary metadata, and refused ambiguous writes.
- Phone-only and same-name contacts have distinguishable accessible actions and delete confirmations. Successful create, edit, and delete remain visible as successful when the directory refresh fails. Old row actions disappear. A failed delete retains the row.
- A malformed upstream contact GUID produces a controlled response. Successful fixtures use fictional GUIDs.

## Independent human verification of the remediation

The user tested the remediation against their live Wix site and reported that all manual checks passed.

| Check | Human-reported result |
| --- | --- |
| Connectivity and retrieval | The dashboard connected on both `localhost` and `127.0.0.1`. A normal contact retrieval returned HTTP 200. |
| Phone-only identity | The user created a phone-only contact. Its deletion confirmation identified it by its phone number. |
| Updates and clears | Contact information and phone updates succeeded. The user cleared the optional company, job title, and phone fields and verified that the existing name and email were preserved. |
| Request protections | An untrusted Host returned HTTP 403 with `ORIGIN_REJECTED`. A separate request with an untrusted Origin also returned HTTP 403 with `ORIGIN_REJECTED`. |
| Cleanup | The user deleted the disposable contact. The existing site member remained untouched. |

The automated tests above cover international entries with matching national digits and ambiguous primary selection. The live report covers the specific updates and clears in this table. Broader international collisions and Wix's choice of a new primary among remaining numbers are outside that report.

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

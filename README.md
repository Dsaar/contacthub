# ContactHub

ContactHub is an external contacts dashboard for a Wix Developer Relations Expert interview assignment. The current stage provides a read-only, paginated contacts API and the React placeholder. Wix owns the contact records.

## Run locally

Use Node.js 24.12 or later in the 24.x line and npm 11 or later. From the repository root, select the project runtime before installing dependencies.

```sh
nvm install
nvm use
npm ci
```

On first setup, create the server configuration file. The command preserves any existing file.

```sh
cp -n server/.env.example server/.env
```

Set these values privately in `server/.env` or in the server process environment. Existing process variables take precedence. Restart the API after changing the settings.

| Variable | Purpose |
| --- | --- |
| `WIX_API_KEY` | A Wix API key with **Read Contacts** permission for the target site |
| `WIX_SITE_ID` | The target site's ID |
| `PORT` | Express port, default 3000. The supplied Vite proxy targets 3000. |

```sh
npm run dev
```

Open [ContactHub](http://127.0.0.1:5173). Both development servers bind to IPv4 loopback. Ctrl+C stops both. The health route works with blank Wix settings.

## Request flow and authentication

1. The browser or curl sends a local GET. Vite on port 5173 proxies `/api` to Express on port 3000. Direct calls to port 3000 also work.
2. Express validates the query. `limit` defaults to 10 and accepts 1–100. The cap of 100 is a ContactHub choice. `offset` defaults to 0 and accepts nonnegative 32-bit integers. Supply each parameter at most once.
3. The contacts service sends `{"query":{"paging":{"limit":10,"offset":0}}}` for the default page. The transport uses native fetch to POST to `https://www.wixapis.com/contacts/v4/contacts/query`. It puts the raw API key directly in `Authorization` (no Bearer prefix), selects the site with `wix-site-id`, and sends JSON. The timeout is 10 seconds. Credentials stay in the server process. [REST authentication](https://dev.wix.com/docs/api-reference/articles/rest-authentication/rest-api-authentication) · [API keys](https://dev.wix.com/docs/api-reference/articles/authentication/about-api-keys)
4. Zod validates the result and the service selects the dashboard fields. The local JSON response has `contacts` and `pagingMetadata`. [Query Contacts REST reference](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/query-contacts) · [Contact V4 object](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/contact-object)

Each contact includes its ID, revision, first and last names, primary email and phone, lists of emails and phones, company, job title, creation and update times, and `isSiteMember`. Missing scalar details are `null` and missing lists are empty. A true member flag means Wix supplied a member ID. The response omits private member details and extended fields.

Paging includes the requested limit, offset, count, total, `tooManyToCount`, and `hasNext`. An unavailable total is `null`. If Wix omits `hasNext`, ContactHub derives it from a known total or returns `null` when there is insufficient information.

## Local curl examples

```sh
curl -i http://127.0.0.1:3000/api/health
curl -i 'http://127.0.0.1:3000/api/contacts?limit=10&offset=0'
curl -i 'http://127.0.0.1:5173/api/contacts?limit=10&offset=10'
```

The contacts commands use the site's live data when credentials are configured. For a shareable status check that keeps the response body out of the terminal, discard the body.

```sh
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' 'http://127.0.0.1:5173/api/contacts?limit=1'
```

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `ERR_UNKNOWN_FILE_EXTENSION` for a `.ts` file | The server runs TypeScript directly in development. The assignment's initial local run used Node 22.15.0. From the root run `nvm install`, `nvm use`, and `npm ci`, then restart. The independently verified runtime was Node 24.22.3 with npm 11.19.1. |
| `503 WIX_CONFIG` | Set both Wix variables in the server environment and restart the API. |
| `400 INVALID_PAGINATION` or `WIX_BAD_REQUEST` | Check the limit and offset. The former error is local validation. The latter records an upstream rejection. |
| `401 WIX_UNAUTHORIZED` or `403 WIX_FORBIDDEN` | Verify the key, site ID, and the key's Read Contacts permission for that site. |
| `404 WIX_NOT_FOUND` | Check the configured site and Wix resource path. |
| `429 WIX_RATE_LIMIT` | Wait before retrying. |
| `502` or `504` | Check connectivity for `WIX_NETWORK`, and retry later for a Wix server error or timeout. For `WIX_INVALID_RESPONSE`, check the REST contract. Share the error code, upstream status, and request ID when available. |

## Repository commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and Express with file watching |
| `npm run build` | Bundle the client to `client/dist/` and compile the server to `server/dist/` |
| `npm run lint` | Run Oxlint |
| `npm run typecheck` | Run strict TypeScript checks for both workspaces |
| `npm test` | Run Vitest over loopback with mocked Wix responses |

Implementation decisions and verification records are in [AI usage](docs/AI_USAGE.md) and [Testing](docs/TESTING.md).

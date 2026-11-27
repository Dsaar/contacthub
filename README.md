# ContactHub

ContactHub is an external contacts dashboard for a Wix Developer Relations Expert interview assignment. The React dashboard lists, searches, creates, edits, and deletes contacts through a local Express API. Wix owns the contact records.

## Run locally

Use Node.js 24.15 or later in the 24.x line and npm 11 or later. Clone the repository and install its locked dependencies. The `nvm` commands select the project's Node version. If you already have a compatible runtime, proceed directly to `npm ci` from the repository root.

```sh
git clone https://github.com/Dsaar/contacthub.git
cd contacthub
nvm install
nvm use
npm ci
```

On first setup, create the server configuration file. The command preserves any existing file.

```sh
cp -n server/.env.example server/.env
```

1. Sign in as an owner or co-owner of the Wix account that owns your test site. Open **Account Settings → API Keys**, choose **Generate API Key**, and give the key a recognizable name. [API Keys Manager](https://manage.wix.com/account/api-keys) · [Managing Wix API keys](https://support.wix.com/en/article/managing-your-wix-api-keys) · [Account requirements](https://dev.wix.com/docs/api-reference/articles/authentication/about-api-keys)
2. Under site access, choose **Specific sites** and select only your test site. Under site permissions, select **Wix Contacts & Members**. The REST references list **Read Contacts** for query/get, **Manage Contacts** for create/update, and **Manage Contacts** and **Manage Members** for delete. These are the operation-level permissions covered by the category. [Generate a site-restricted key](https://dev.wix.com/docs/go-headless/authentication/admin/generate-an-api-key) · [Query](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/query-contacts) · [Create](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/create-contact) · [Update](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/update-contact) · [Delete](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/delete-contact)
3. Choose **Generate Key**, complete Wix's verification, and copy the token while it is displayed. Open the selected site's dashboard and copy the ID immediately after `/dashboard/` in its URL. [Wix site ID instructions](https://dev.wix.com/docs/go-headless/authentication/admin/generate-an-api-key)
4. Before entering either value, check the ignore rule and Git index from the repository root. The first command should print `server/.env` and the second should print nothing.

```sh
git check-ignore server/.env
git ls-files -- server/.env
```

Set these values privately in `server/.env` or in the server process environment. Existing process variables take precedence. Restart the API after changing the settings.

| Variable | Purpose |
| --- | --- |
| `WIX_API_KEY` | A server API key scoped to the target site and operations. Check Read Contacts for reads, Manage Contacts for writes, and the additional Manage Members scope listed on Delete Contact. |
| `WIX_SITE_ID` | The target site's ID |
| `PORT` | Express port, default 3000. The supplied Vite proxy targets 3000. |

```sh
npm run dev
```

Open [ContactHub](http://127.0.0.1:5173). Both development servers bind to IPv4 loopback. Ctrl+C stops both. The health route works with blank Wix settings.

For automated verification, run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. Tests use fictional data and mocked Wix requests. With the local servers running, the following command checks live read access and prints only the HTTP status.

```sh
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' 'http://127.0.0.1:5173/api/contacts?limit=1'
```

Expect HTTP 200. For a live write check on your selected test site, run `bash scripts/verify-live-crud.sh` in a second terminal with Node 24, Bash, curl, and jq. It creates, edits, and deletes a disposable contact. [Procedure and safeguards](#independent-live-crud-check)

## Using the dashboard

A contact is a CRM record and can exist with only a name, email, or phone. A site member has a membership account linked to a contact. ContactHub edits CRM details. Member login email changes belong to the Members API, and Wix protects linked member contacts from deletion. [Contacts and members](https://support.wix.com/en/article/site-members-understanding-the-differences-between-contacts-members-and-subscribers) · [Get Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/get-contact)

Open the directory to see contact names, primary email and phone, company, job title, and member status. Select a name to see all available emails and phone numbers. On narrow screens each table row becomes a labeled card. Desktop and mobile examples use fictional browser fixtures. [Desktop preview](docs/screenshots/dashboard-desktop-mocked.png) · [Mobile preview](docs/screenshots/dashboard-mobile-mocked.png)

The integration indicator reflects the directory request to Wix. It shows loading during a request, connected after success, disconnected for missing credentials, rejected credentials or an unreachable local API, and failed for other request errors. Refresh retries a read. The global count uses the unfiltered total. The footer describes the current query. Unknown totals display as unavailable. Pages contain 10, 25, or 50 contacts. When both the total and next-page flag are unknown, a full page permits probing the next page. An empty page returns the user to a valid offset.

**Search** starts 300 ms after typing stops. Pick first name, last name, primary email, primary phone, company, or job title. For example, `GET /api/contacts?field=company&q=Ac&limit=10&offset=0` sends `query.filter = {"info.company":{"$startsWith":"Ac"}}` to Wix alongside paging. Wix filters the site's contacts before pagination. Changing the term or field resets the offset. Matching is a prefix on one field. Full-name phrases spanning fields, arbitrary substrings, and secondary email/phone searches are outside this search contract. Wix controls matching and case behavior. [Wix Query Contacts, supported REST filters](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/query-contacts)

**Add and edit** accept first name, last name, email, phone, company, and job title. Creation needs at least a name, email, or phone. The editor fetches the latest individual record and sends only changed fields plus the original revision. Clearing a populated field sends JSON null. On a revision conflict, the draft stays open. Choose **Load latest version**, compare your edits with the displayed Wix values, acknowledge review, and save explicitly. For members, email editing is disabled and the field is excluded from PATCH.

**Delete** requires confirmation using the selected name and available primary email and phone. A phone-only contact is identified by its number. A lock explains the member restriction. The server still checks Wix's other deletion restrictions. Mutation errors keep the dialog open. Confirmed changes invalidate the displayed page and count. If reloading fails, the success notice remains alongside the directory error. Refresh retries the read. Error details include the safe upstream request ID when available. A timeout can leave the outcome of a write unknown. Refresh and check the contact before repeating it.

### Phone representation

The directory retains the original `primaryPhone` and `phones` display strings. `phoneDetails` carries each displayable entry in collection order, including the national string, country code, Wix-generated E.164 value, tag, and resolved primary flag. Missing metadata stays null. The directory and editor use the resolved primary entry's E.164 value when supplied. Details show both entries when two countries share the same national digits. A summary-only number can be displayed. Editing an existing number requires a safely identifiable collection entry. The independent backend check observed national formatting after international input. The metadata for that live transaction was unavailable. [Contact V4 object](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/contact-object)

### Frontend architecture

`client/src/api.ts` uses relative same-origin `/api` requests and handles JSON results, structured errors, and empty DELETE responses. `types.ts` defines the browser contracts. `useDirectory.ts` owns query state, paging, counts, request cancellation, and refresh. `App.tsx` assembles the page. `Directory.tsx`, `ContactEditor.tsx`, and `ContactDialogs.tsx` handle rows, forms, details, and confirmation. `ui.tsx` supplies native modal dialogs and accessible error feedback. React holds draft and contact data in memory. The Wix key stays in Express.

### Independent browser check

1. Start both workspaces with the commands above and open the local dashboard. Verify the integration indicator, count, detail view, page size, and a known field prefix. Clear the search to restore the list.
2. Create a **new fictional contact with a unique email and a phone number**. Open its details, edit its job title, refresh, and confirm that its email and phone were preserved.
3. To check concurrency, open that contact's editor in two tabs. Save in the first tab, then try a different edit in the second. Confirm that the draft survives and that saving requires loading and reviewing the latest version.
4. Try the list on a narrow screen. Use Tab and Escape in a dialog and check that focus returns to its trigger. Finally, open Delete for the disposable contact, verify its identifying details and confirm deletion.

## List requests and authentication

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
| `401 WIX_UNAUTHORIZED` or `403 WIX_FORBIDDEN` | Verify the key, site ID, and permissions listed on the reference for the operation. |
| `404 WIX_NOT_FOUND` | Check the configured site and Wix resource path. |
| `429 WIX_RATE_LIMIT` | Wait before retrying. |
| `502` or `504` | Check connectivity for `WIX_NETWORK`, and check the current state after a Wix server error or timeout before repeating a write. For `WIX_INVALID_RESPONSE`, check the REST contract. Share the error code, upstream status, and request ID when available. |

## Repository commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and Express with file watching |
| `npm run build` | Bundle the client to `client/dist/` and compile the server to `server/dist/` |
| `npm run lint` | Run Oxlint |
| `npm run typecheck` | Run strict TypeScript checks for both workspaces |
| `npm test` | Run the frontend DOM and API-client tests plus the backend HTTP suite with mocked Wix responses |

Implementation decisions and verification records are in [AI usage](docs/AI_USAGE.md) and [Testing](docs/TESTING.md).

## Backend API contracts

| Local endpoint | Input | Success |
| --- | --- | --- |
| `GET /api/health` | None | 200: `{"status":"ok","service":"contacthub-api"}` |
| `GET /api/contacts` | Optional `limit`, `offset`, `q`, and `field` | 200: `{"contacts":[…],"pagingMetadata":{…}}` |
| `GET /api/contacts/:id` | Contact GUID | 200: `{"contact":{…}}`. A merged source can resolve to its target. |
| `POST /api/contacts` | JSON with one or more identity fields and optional company/job title | 201: `{"contact":{…}}` with the assigned ID and revision |
| `PATCH /api/contacts/:id` | JSON with the caller's `revision` and at least one editable field | 200: `{"contact":{…}}` with the new revision |
| `DELETE /api/contacts/:id` | Contact GUID, empty body | 204 with an empty body after Wix confirms deletion |

Create accepts exactly six field names. Each provided value must be a nonblank string. Wix requires at least a first name, last name, email, or phone. The Wix maximum lengths are 1,000 for each name, company and job title, 320 for email, and 50 for phone. ContactHub trims input, validates email syntax, and accepts Unicode names. Its phone rule allows digits, an optional leading plus, spaces, parentheses, dots, hyphens, and a numeric extension. These format checks are application choices.

Example local create body:

```json
{"firstName":"Alex","lastName":"Demo","email":"alex.demo@example.com","phone":"+12025550174","company":"ContactHub Demo","jobTitle":"Test Engineer"}
```

Example response for create, get or update, using fictional values:

```json
{
  "contact": {
    "id": "00000000-0000-4000-8000-000000000001", "revision": 1,
    "firstName": "Alex", "lastName": "Demo",
    "primaryEmail": "alex.demo@example.com", "emails": ["alex.demo@example.com"],
    "primaryPhone": "+12025550174", "phones": ["+12025550174"],
    "phoneDetails": [{"phone":"+12025550174","countryCode":null,"e164Phone":null,"tag":null,"primary":true}],
    "company": "ContactHub Demo", "jobTitle": "Test Engineer", "isSiteMember": false,
    "createdDate": "2026-01-01T12:00:00Z", "updatedDate": "2026-01-01T12:00:00Z"
  }
}
```

### Wix request mapping

For the create example, the server sends `POST /contacts/v4/contacts` with this body. Keeping `allowDuplicates` false enables Wix's normal duplicate checks, including phone when email is absent. [Create Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/create-contact)

```json
{
  "info": {
    "name": {"first":"Alex","last":"Demo"},
    "emails": {"items":[{"email":"alex.demo@example.com","primary":true}]},
    "phones": {"items":[{"phone":"+12025550174","primary":true}]},
    "company": "ContactHub Demo", "jobTitle": "Test Engineer"
  },
  "allowDuplicates": false
}
```

PATCH accepts the same six fields and requires a nonnegative int32 `revision`. Omission preserves a field. Explicit JSON `null` requests a clear. Empty strings, extra properties, and revision-only updates are rejected. For example, local `{"revision":1,"lastName":"Revised","jobTitle":null}` produces the following body for `PATCH /contacts/v4/contacts/{contactId}`. The current V4 REST schema and curl example supply the changed properties through `info` and the revision at the top level. They specify no separate field-mask parameter. [Update Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/update-contact)

```json
{"info":{"name":{"last":"Revised"},"jobTitle":""},"revision":1,"allowDuplicates":false}
```

Clearing a name component, company, or job title sends an empty string for that property. Changing email or phone rebuilds only that collection from a fresh full GET. The primary is identified by its flag or its unique match with the primary summary. The request preserves the other entries, their order, tags, primary flags and phone country codes. Only writable item properties are submitted. For a clear, the outgoing collection omits the primary entry and contains an empty array if it was the sole entry. Wix may select a remaining entry as primary. An ambiguous list yields a local conflict. Wix can reject clearing the last identifying detail. [Contact object](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/contact-object)

Mocked HTTP tests verify the outgoing empty strings, rebuilt arrays, and preservation of unrelated entries. In independent live testing, the user cleared company, job title, and phone and verified that the existing name and email were preserved. Wix's choice of a new primary among remaining numbers is outside the reported live coverage. [Live verification record](docs/TESTING.md#independent-human-verification-of-the-remediation)

### Revision and member protection

Before PATCH or DELETE the server gets the specified contact. It stops if Wix reports a merge or returns a different ID. On PATCH it compares the read revision with the caller's revision, then forwards exactly the caller's revision so Wix can detect an intervening update. Neither step retries the write. DELETE has no upstream revision parameter and always targets the originally requested ID. [Get Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/get-contact) · [Update Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/update-contact)

For a known member, ContactHub refuses DELETE and any PATCH containing `email`. A false member flag indicates the GET supplied no member ID. Wix still decides whether the contact belongs to a Wix user, member or active billing subscription and may refuse deletion. ContactHub leaves accounts and subscriptions alone. [Delete Contact](https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/delete-contact)

### Errors and local security

All contact responses use `Cache-Control: no-store`. Errors use `{"error":{"code":"…","message":"…"}}` and include `upstreamStatus` and a safe `requestId` when available. A locally detected conflict has no upstream rejection status.

| HTTP | Meaning |
| --- | --- |
| 400, 413, 415 | Invalid ID, fields, pagination, JSON, size, or content type |
| 403 `ORIGIN_REJECTED` | Untrusted contact request Host, or a rejected mutation Origin or cross-site browser request |
| 404 `WIX_NOT_FOUND` | Resource missing at Wix |
| 409 `REVISION_CONFLICT` | Preflight detected a newer revision or Wix returned 409 `CONTACT_ALREADY_CHANGED`. Refresh and review edits. |
| 409 `DUPLICATE_CONTACT` | Wix returned 409 `DUPLICATE_CONTACT_EXISTS`. Other 409s retain the generic `WIX_CONFLICT`. |
| 409 `MERGED_CONTACT` or `AMBIGUOUS_PRIMARY` | Requested ID resolves elsewhere or the primary entry cannot be safely selected |
| 428 `MEMBER_EMAIL_RESTRICTED` | Local member guard or Wix `CANNOT_UPDATE_MEMBER_EMAIL` |
| 428 `PROTECTED_CONTACT` | Local member guard or Wix `CANNOT_DELETE_MEMBER`, `CANNOT_DELETE_MEMBER_OWNER_OR_CONTRIBUTOR`, or `CANNOT_DELETE_CONTACT_WITH_BILLING_SUBSCRIPTION` |
| Other upstream failures | See Troubleshooting above. Unknown 428s use `WIX_PRECONDITION`. After an ambiguous write failure, inspect Wix before trying again. |

This demo binds to loopback. Every contact route checks Host against the local allowlist. Browser writes also check the supplied HTTP Origin and reject cross-site Fetch Metadata. Local command-line clients may omit Origin. POST and PATCH require uncompressed JSON up to 16 KiB. DELETE takes no body. Public deployment requires dashboard user authentication and per-operation authorization. Possession of the server's Wix key only identifies the integration.

## Independent live CRUD check

The following commands use actual site data **only when you run them**. The script creates a disposable contact with a unique fictional email. It takes its ID exclusively from the successful create response, reads it back, verifies the ID, email and member flag, patches the job title using the returned revision, and verifies those safeguards again before deleting. It expects HTTP 204 followed by a GET returning 404. It never selects a contact from the contact list.

From the repository root in the first terminal:

```sh
nvm use
npm ci
npm run dev
```

In a second terminal, with Node 24, Bash, curl and jq available:

```sh
nvm use
bash scripts/verify-live-crud.sh
```

A failed check stops the script. If it printed a fixture ID, inspect that specific contact privately before deciding on cleanup. Keep the site's existing member/contributor contact out of manual testing. The stage's mocked tests and live-verification status are recorded in [Testing](docs/TESTING.md).

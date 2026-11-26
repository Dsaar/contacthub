# ContactHub

ContactHub is an external contacts dashboard for a Wix Developer Relations Expert interview assignment. The planned dashboard will retrieve, search, create, edit, and delete a real site's contacts through the Wix Contacts V4 REST API using API key authentication. Wix will own the contact records.

This foundation delivers the React placeholder and a working Express health endpoint. Contact operations and Wix authentication are reserved for a later stage.

## Run locally

Use Node.js 24.12 or later in the 24.x line and npm 11 or later. With nvm installed, run `nvm install` from the repository root to select the version in `.nvmrc`. Then run these commands from the root.

```sh
npm ci
npm run dev
```

Open [ContactHub](http://127.0.0.1:5173). Both development servers bind to IPv4 loopback. Ctrl+C stops both.

## Architecture

- **client/** contains the React and TypeScript entry point. Vite serves the page on port 5173 and compiles Tailwind CSS. During development Vite forwards requests beginning with `/api` to the Express server on port 3000.
- **server/** contains the Express app and its startup code. The startup module loads the server workspace's optional `.env` file with dotenv and validates `PORT` with Zod. The app module defines the routes so the HTTP test can start its own listener.
- **Repository root** contains the npm workspace scripts, shared strict TypeScript settings, and a single lockfile for reproducible installs.

To check the full request path with both servers running, use the frontend port.

```sh
curl http://127.0.0.1:5173/api/health
```

A healthy server returns HTTP 200 with this body.

```json
{"status":"ok","service":"contacthub-api"}
```

The health endpoint uses no credentials. For local server configuration, optionally run `cp server/.env.example server/.env` on first setup. Leave the Wix fields empty for this stage. Keep credential values in the server environment. The development proxy expects the backend on port 3000.

## Repository commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and Express together with file watching |
| `npm run build` | Bundle the client to `client/dist/` and compile the server to `server/dist/` |
| `npm run lint` | Run Oxlint on the client, Vite config, server, and test |
| `npm run typecheck` | Check browser, build configuration, server, and test types |
| `npm test` | Run the Vitest HTTP test once |

The assignment brief and implementation decisions are in [AI usage](docs/AI_USAGE.md). Executed checks and their scope are in [Testing](docs/TESTING.md).

import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { createServer as createHttpServer, request, type Server } from 'node:http'
import { devNull } from 'node:os'
import { text } from 'node:stream/consumers'
import { promisify } from 'node:util'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import clientConfig from '../../client/vite.config.ts'
import { app } from '../src/app.ts'

const id = '00000000-0000-4000-8000-000000000001'
const contact = { id, revision: 1, info: { name: { first: 'Example' } } }
const wix = vi.fn<typeof fetch>()
let proxy: ViteDevServer
let ingress: { host?: string, origin?: string }
const backend = createHttpServer((req, res) => {
  ingress = { host: req.headers.host, origin: req.headers.origin }
  app(req, res)
})

function port(server: Pick<Server, 'address'>) {
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener')
  return address.port
}

beforeAll(async () => {
  backend.listen(0, '127.0.0.1')
  await once(backend, 'listening')
  const target = 'http://127.0.0.1:' + port(backend)
  const rule = clientConfig.server?.proxy?.['/api']
  if (!rule) throw new Error('Missing client /api development proxy')
  // Replace only the destination. Keeping the real rule's shorthand/object form
  // matters because Vite supplies different Host defaults for the two forms.
  proxy = await createViteServer({
    configFile: false, envDir: false, logLevel: 'silent', appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: {
      host: '127.0.0.1', port: 0, hmr: false,
      proxy: { '/api': typeof rule === 'string' ? target : { ...rule, target } },
    },
  })
  await proxy.listen()
})

afterAll(async () => {
  try { await proxy?.close() }
  finally { if (backend.listening) await backend[Symbol.asyncDispose]() }
})

beforeEach(() => {
  vi.stubEnv('WIX_API_KEY', 'dummy-proxy-test-key')
  vi.stubEnv('WIX_SITE_ID', 'dummy-proxy-test-site')
  vi.stubGlobal('fetch', wix.mockReset())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function throughProxy(host: string, method: string, body?: unknown, headers?: Record<string, string>,
  path = '/api/contacts' + (method === 'POST' ? '' : '/' + id)) {
  // The socket is isolated from any running development servers. The HTTP
  // authority and browser metadata on the wire use the documented frontend port.
  const req = request({
    hostname: '127.0.0.1', port: port(proxy.httpServer!), method,
    path,
    headers: {
      host, origin: 'http://' + host, referer: 'http://' + host + '/',
      'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers,
    },
  })
  const received = once(req, 'response')
  req.end(JSON.stringify(body))
  const [res] = await received
  const raw = await text(res)
  return { status: res.statusCode, body: raw ? JSON.parse(raw) : undefined }
}

it.each(['localhost:5173', '127.0.0.1:5173'])('forwards same-origin POST, PATCH and DELETE for %s', async host => {
  wix.mockResolvedValueOnce(Response.json({ contact }))
  const created = await throughProxy(host, 'POST', { firstName: 'Example' })
  expect(ingress).toEqual({ host, origin: 'http://' + host })
  expect(created.status).toBe(201)
  expect(created.body.contact.id).toBe(id)

  wix.mockResolvedValueOnce(Response.json({ contact }))
    .mockResolvedValueOnce(Response.json({ contact: { ...contact, revision: 2 } }))
  const updated = await throughProxy(host, 'PATCH', { revision: 1, company: 'Example' })
  expect(updated.status).toBe(200)
  expect(updated.body.contact.revision).toBe(2)

  wix.mockResolvedValueOnce(Response.json({ contact })).mockResolvedValueOnce(Response.json({}))
  expect(await throughProxy(host, 'DELETE')).toEqual({ status: 204, body: undefined })
  expect(wix.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET', 'PATCH', 'GET', 'DELETE'])
})

it.each(['localhost:5173', '127.0.0.1:5173'])('forwards list and detail reads for %s', async host => {
  wix.mockResolvedValueOnce(Response.json({ contacts: [contact], pagingMetadata: { count: 1 } }))
    .mockResolvedValueOnce(Response.json({ contact }))
  const list = await throughProxy(host, 'GET', undefined, {}, '/api/contacts')
  expect(list.status).toBe(200)
  expect(list.body.contacts[0].id).toBe(id)
  expect(ingress.host).toBe(host)
  const detail = await throughProxy(host, 'GET')
  expect(detail.status).toBe(200)
  expect(detail.body.contact.id).toBe(id)
  expect(wix.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET'])
})

it.each([
  'https://example.invalid', 'http://localhost.example.invalid:5173', 'null',
  'invalid-origin', 'http://localhost:5173/', 'http://localhost:3000', 'http://127.0.0.1:5173',
])('rejects an untrusted or mismatched Origin through Vite: %s', async origin => {
  const response = await throughProxy('localhost:5173', 'POST', { firstName: 'Example' }, { origin })
  expect(response.status).toBe(403)
  expect(response.body.error.code).toBe('ORIGIN_REJECTED')
  expect(wix).not.toHaveBeenCalled()
})

it('keeps the cross-site guard on the proxy path', async () => {
  const response = await throughProxy('localhost:5173', 'DELETE', undefined, { 'sec-fetch-site': 'cross-site' })
  expect(response.status).toBe(403)
  expect(response.body.error.code).toBe('ORIGIN_REJECTED')
  expect(wix).not.toHaveBeenCalled()
})

it('still accepts a direct loopback curl POST without Origin', async () => {
  wix.mockResolvedValueOnce(Response.json({ contact }))
  const { stdout } = await promisify(execFile)('curl', [
    '-q', '--noproxy', '*', '--silent', '--show-error', '--max-time', '5',
    '-H', 'Content-Type: application/json', '--data', '{"firstName":"Example"}',
    '-o', devNull, '-w', '%{http_code}', `http://127.0.0.1:${port(backend)}/api/contacts`,
  ])
  expect(stdout).toBe('201')
  expect(ingress.origin).toBeUndefined()
  expect(wix).toHaveBeenCalledOnce()
})

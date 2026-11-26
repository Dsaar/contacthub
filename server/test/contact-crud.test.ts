import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { text } from 'node:stream/consumers'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { app } from '../src/app.ts'

const id = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const contact = { id, revision: 2, info: { name: { first: 'Alex', last: 'Demo' } } }
const api = 'https://www.wixapis.com/contacts/v4/contacts'
const key = 'dummy-crud-test-key'
const site = 'dummy-crud-test-site'
const problemId = '1234.test-id'
const localFetch = globalThis.fetch
const wix = vi.fn<typeof fetch>()
let origin: string

beforeAll(async () => {
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')
  origin = `http://127.0.0.1:${address.port}`
  return () => server[Symbol.asyncDispose]()
})

beforeEach(() => {
  vi.stubEnv('WIX_API_KEY', key)
  vi.stubEnv('WIX_SITE_ID', site)
  vi.stubGlobal('fetch', wix.mockReset())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function call(method: string, body?: unknown, path = method === 'POST' ? '' : '/' + id) {
  return localFetch(origin + '/api/contacts' + path, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}

function reply(data: unknown) {
  wix.mockResolvedValueOnce(Response.json(data))
}

function failure(status: number, code: string) {
  wix.mockResolvedValueOnce(Response.json({
    message: key, details: { applicationError: { code, data: { site, email: 'hidden@example.invalid' } } },
  }, { status, headers: { 'x-wix-request-id': problemId } }))
}

function expectRequest(index: number, method: string, url: string, body?: unknown) {
  const [actual, options] = wix.mock.calls[index]!
  expect(String(actual)).toBe(url)
  expect(options).toMatchObject({ method, redirect: 'manual', headers: {
    Authorization: key, 'wix-site-id': site, 'Content-Type': 'application/json',
  } })
  expect(options?.body ? JSON.parse(String(options.body)) : undefined).toEqual(body)
}

async function expectError(response: Response, status: number, code: string, upstreamStatus?: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('no-store')
  const raw = await response.text()
  for (const value of [key, site, 'hidden@example.invalid']) expect(raw).not.toContain(value)
  expect(JSON.parse(raw)).toEqual({ error: {
    code, message: expect.any(String), ...(upstreamStatus === undefined ? {} : { upstreamStatus, requestId: problemId }),
  } })
}

it('gets and normalizes a contact, omitting private detail', async () => {
  reply({ contact: { ...contact, memberInfo: { memberId: 'private-member' } } })
  const response = await call('GET')
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ contact: {
    id, revision: 2, firstName: 'Alex', lastName: 'Demo', emails: [], phones: [],
    primaryEmail: null, primaryPhone: null, company: null, jobTitle: null,
    createdDate: null, updatedDate: null, isSiteMember: true,
  } })
  expectRequest(0, 'GET', api + '/' + id)
})

it.each(['GET', 'PATCH', 'DELETE'])('rejects invalid ID on %s', async method => {
  await expectError(await call(method, method === 'PATCH' ? { company: 'Demo', revision: 2 } : undefined,
    '/not-a-guid'), 400, 'INVALID_ID')
  expect(wix).not.toHaveBeenCalled()
})

it.each(['GET', 'PATCH', 'DELETE'])('returns missing contact on %s', async method => {
  failure(404, 'CONTACT_NOT_FOUND')
  await expectError(await call(method, method === 'PATCH' ? { company: 'Demo', revision: 2 } : undefined),
    404, 'WIX_NOT_FOUND', 404)
  expect(wix).toHaveBeenCalledTimes(1)
})

it('creates a contact with the exact V4 info body and duplicate checks', async () => {
  reply({ contact })
  const response = await call('POST', { firstName: '李', lastName: 'الحداد', email: 'demo@example.invalid',
    phone: '+44 (0)20 5555 0101 ext. 12', company: 'Demo Co', jobTitle: 'Engineer' })
  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({ contact: { id, revision: 2 } })
  expectRequest(0, 'POST', api, { allowDuplicates: false, info: {
    name: { first: '李', last: 'الحداد' }, company: 'Demo Co', jobTitle: 'Engineer',
    emails: { items: [{ email: 'demo@example.invalid', primary: true }] },
    phones: { items: [{ phone: '+44 (0)20 5555 0101 ext. 12', primary: true }] },
  } })
})

it('creates with only a last name', async () => {
  reply({ contact })
  expect((await call('POST', { lastName: 'Demo' })).status).toBe(201)
  expectRequest(0, 'POST', api, { info: { name: { last: 'Demo' } }, allowDuplicates: false })
})

it.each([
  {}, { company: 'Demo' }, { firstName: ' ' }, { email: 'invalid' }, { phone: '----' },
  { phone: '12345'.repeat(11) }, { firstName: 'a'.repeat(1001) }, { firstName: 'Demo', allowDuplicates: true },
  { lastName: null }, { phone: '555-1234', revision: 1 }, { email: 'a'.repeat(311) + '@example.com' },
])('rejects invalid create input', async body => {
  await expectError(await call('POST', body), 400, 'INVALID_INPUT')
  expect(wix).not.toHaveBeenCalled()
})

it.each([{}, { firstName: 'Demo' }, { revision: 2 }, { revision: -1, company: 'Demo' },
  { revision: '2', phone: null }, { revision: 2.1, phone: null }, { revision: 2147483648, email: null },
  { revision: 2, id: otherId }, { revision: 2, jobTitle: '' }, { revision: 2, email: 'bad' }])(
  'rejects invalid patch input before even reading Wix', async body => {
    await expectError(await call('PATCH', body), 400, 'INVALID_INPUT')
    expect(wix).not.toHaveBeenCalled()
  },
)

const detailed = { ...contact, info: {
  ...contact.info, labelKeys: { items: ['private-label'] }, extendedFields: { items: { private: true } },
  emails: { items: [
    { email: 'other@example.invalid', tag: 'HOME' },
    { email: 'old@example.invalid', primary: true, tag: 'WORK', id: 'read-only' },
  ] },
  phones: { items: [
    { phone: '5550101', tag: 'WORK', countryCode: 'US', primary: false },
    { phone: '5550102', tag: 'HOME', countryCode: 'US', primary: true, e164Phone: '+15550102' },
  ] },
} }

it('updates selected scalars and retains writable details and order of additional entries', async () => {
  reply({ contact: detailed })
  reply({ contact: { ...contact, revision: 3 } })
  const response = await call('PATCH', { revision: 2, lastName: 'New', email: 'new@example.invalid', phone: '5550103' })
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ contact: { id, revision: 3 } })
  expectRequest(0, 'GET', api + '/' + id)
  expectRequest(1, 'PATCH', api + '/' + id, { revision: 2, allowDuplicates: false, info: {
    name: { last: 'New' }, emails: { items: [
      { email: 'other@example.invalid', tag: 'HOME' }, { email: 'new@example.invalid', primary: true, tag: 'WORK' },
    ] }, phones: { items: [
      { phone: '5550101', tag: 'WORK', countryCode: 'US', primary: false },
      { phone: '5550103', tag: 'HOME', countryCode: 'US', primary: true },
    ] },
  } })
})

it('uses null to clear individual scalar fields and remove only primary entries', async () => {
  reply({ contact: detailed })
  reply({ contact: { ...contact, revision: 3 } })
  const response = await call('PATCH', { revision: 2, firstName: null, lastName: null, company: null,
    jobTitle: null, email: null, phone: null })
  expect(response.status).toBe(200)
  expectRequest(1, 'PATCH', api + '/' + id, { revision: 2, allowDuplicates: false, info: {
    name: { first: '', last: '' }, company: '', jobTitle: '',
    emails: { items: [{ email: 'other@example.invalid', tag: 'HOME' }] },
    phones: { items: [{ phone: '5550101', tag: 'WORK', countryCode: 'US', primary: false }] },
  } })
})

it('can clear the only email by matching the primary summary', async () => {
  reply({ contact: { ...contact, primaryInfo: { email: 'demo@example.invalid' },
    info: { emails: { items: [{ email: 'demo@example.invalid' }] } } } })
  reply({ contact: { ...contact, revision: 3 } })
  expect((await call('PATCH', { revision: 2, email: null })).status).toBe(200)
  expectRequest(1, 'PATCH', api + '/' + id, { revision: 2, allowDuplicates: false, info: { emails: { items: [] } } })
})

it('declines an ambiguous primary without risking the list', async () => {
  reply({ contact: { ...detailed, primaryInfo: { email: 'unknown@example.invalid' } } })
  await expectError(await call('PATCH', { revision: 2, email: null }), 409, 'AMBIGUOUS_PRIMARY')
  expect(wix).toHaveBeenCalledTimes(1)
})

it('rejects a locally detected stale revision without substituting a newer one', async () => {
  reply({ contact })
  await expectError(await call('PATCH', { revision: 1, company: 'Demo' }), 409, 'REVISION_CONFLICT')
  expect(wix).toHaveBeenCalledTimes(1)
})

it.each([
  ['POST', 409, 'DUPLICATE_CONTACT_EXISTS', 'DUPLICATE_CONTACT'],
  ['POST', 409, 'CONTACT_ID_ALREADY_EXISTS', 'WIX_CONFLICT'],
  ['PATCH', 409, 'CONTACT_ALREADY_CHANGED', 'REVISION_CONFLICT'],
  ['PATCH', 409, 'DUPLICATE_CONTACT_EXISTS', 'DUPLICATE_CONTACT'],
  ['PATCH', 428, 'CANNOT_UPDATE_MEMBER_EMAIL', 'MEMBER_EMAIL_RESTRICTED'],
  ['PATCH', 404, 'CONTACT_NOT_FOUND', 'WIX_NOT_FOUND'],
  ['DELETE', 428, 'CANNOT_DELETE_MEMBER_OWNER_OR_CONTRIBUTOR', 'PROTECTED_CONTACT'],
  ['DELETE', 428, 'CANNOT_DELETE_CONTACT_WITH_BILLING_SUBSCRIPTION', 'PROTECTED_CONTACT'],
  ['DELETE', 428, 'CANNOT_DELETE_MEMBER', 'PROTECTED_CONTACT'],
  ['DELETE', 428, 'UNKNOWN', 'WIX_PRECONDITION'],
  ['DELETE', 500, 'UNKNOWN', 'WIX_SERVER_ERROR'],
  ['DELETE', 404, 'CONTACT_NOT_FOUND', 'WIX_NOT_FOUND'],
  ['POST', 401, 'UNKNOWN', 'WIX_UNAUTHORIZED'],
  ['POST', 403, 'UNKNOWN', 'WIX_FORBIDDEN'],
] as const)('distinguishes %s upstream %i %s', async (method, status, upstreamCode, code) => {
  if (method !== 'POST') reply({ contact })
  failure(status, upstreamCode)
  const body = method === 'POST' ? { firstName: 'Demo' } : method === 'PATCH' ? { revision: 2, email: null } : undefined
  await expectError(await call(method, body), status === 500 ? 502 : status, code, status)
  expect(wix).toHaveBeenCalledTimes(method === 'POST' ? 1 : 2)
})

it.each(['PATCH', 'DELETE'])('blocks %s on a known member for the protected operation', async method => {
  reply({ contact: { ...contact, memberInfo: { memberId: 'dummy-member' } } })
  await expectError(await call(method, method === 'PATCH' ? { revision: 2, email: null } : undefined),
    428, method === 'PATCH' ? 'MEMBER_EMAIL_RESTRICTED' : 'PROTECTED_CONTACT')
  expect(wix).toHaveBeenCalledTimes(1)
})

it.each(['PATCH', 'DELETE'])('blocks merged sources on %s even without a MERGED hint', async method => {
  reply({ contact: { ...contact, id: otherId } })
  await expectError(await call(method, method === 'PATCH' ? { revision: 2, company: 'Demo' } : undefined),
    409, 'MERGED_CONTACT')
  expect(wix).toHaveBeenCalledTimes(1)
})

it('also respects an explicit MERGED response type', async () => {
  reply({ contact, responseType: 'MERGED' })
  await expectError(await call('DELETE'), 409, 'MERGED_CONTACT')
  expect(wix).toHaveBeenCalledTimes(1)
})

it.each([200, 204])('accepts Wix delete success %i and returns an empty 204', async status => {
  reply({ contact })
  wix.mockResolvedValueOnce(status === 200 ? Response.json({}) : new Response(null, { status }))
  const response = await call('DELETE')
  expectRequest(1, 'DELETE', api + '/' + id)
  expect(response.status).toBe(204)
  expect(await response.text()).toBe('')
})

it.each(['POST', 'DELETE', 'PATCH'])('rejects malformed success on %s', async method => {
  if (method !== 'POST') reply({ contact })
  wix.mockResolvedValueOnce(Response.json({ error: key }, { headers: { 'x-wix-request-id': problemId } }))
  const body = method === 'POST' ? { firstName: 'Alex' } : method === 'PATCH' ? { revision: 2, company: 'Demo' } : undefined
  await expectError(await call(method, body), 502, 'WIX_INVALID_RESPONSE', 200)
})

it.each(['network', 'timeout'])('never retries creation after %s failure', async kind => {
  wix.mockRejectedValueOnce(kind === 'timeout' ? new DOMException(key, 'TimeoutError') : new TypeError(key))
  await expectError(await call('POST', { firstName: 'Alex' }), kind === 'timeout' ? 504 : 502,
    kind === 'timeout' ? 'WIX_TIMEOUT' : 'WIX_NETWORK')
  expect(wix).toHaveBeenCalledTimes(1)
})

it.each([
  ['POST', { origin: 'https://example.invalid' }], ['PATCH', { origin: 'null' }],
  ['DELETE', { 'sec-fetch-site': 'cross-site' }], ['DELETE', { host: 'example.invalid:3000' }],
] as const)('rejects untrusted %s writes before Wix', async (method, headers) => {
  // Native fetch controls some HTTP headers itself. Send the specified wire headers verbatim.
  const request = httpRequest(origin + '/api/contacts' + (method === 'POST' ? '' : '/' + id), { method, headers })
  const received = once(request, 'response')
  request.end()
  const [response] = await received
  expect(response.statusCode).toBe(403)
  expect(JSON.parse(await text(response)).error.code).toBe('ORIGIN_REJECTED')
  expect(wix).not.toHaveBeenCalled()
})

it('allows a same-origin browser write', async () => {
  reply({ contact })
  const response = await localFetch(origin + '/api/contacts', {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{"firstName":"Alex"}',
  })
  expect(response.status).toBe(201)
})

it.each([
  ['application/json', '{', 400, 'INVALID_JSON'],
  ['text/plain', '{}', 415, 'JSON_REQUIRED'],
  ['application/json', JSON.stringify({ firstName: 'a'.repeat(17000) }), 413, 'BODY_TOO_LARGE'],
] as const)('requires small valid JSON bodies', async (type, body, status, code) => {
  const response = await localFetch(origin + '/api/contacts', { method: 'POST', headers: { 'content-type': type }, body })
  await expectError(response, status, code)
  expect(wix).not.toHaveBeenCalled()
})

it('does not report deletion on an unconfirmed 202', async () => {
  reply({ contact })
  wix.mockResolvedValueOnce(Response.json({}, { status: 202, headers: { 'x-wix-request-id': problemId } }))
  await expectError(await call('DELETE'), 502, 'WIX_INVALID_RESPONSE', 202)
})

it('read-only GET may return a merged target', async () => {
  reply({ contact: { ...contact, id: otherId }, responseType: 'MERGED' })
  expect(await (await call('GET')).json()).toMatchObject({ contact: { id: otherId } })
})

it.each([{ id: otherId, revision: 3 }, { id, revision: 2 }])('rejects an unexpected PATCH result', async result => {
  reply({ contact })
  wix.mockResolvedValueOnce(Response.json({ contact: result }, { headers: { 'x-wix-request-id': problemId } }))
  await expectError(await call('PATCH', { revision: 2, company: 'Demo' }), 502, 'WIX_INVALID_RESPONSE', 200)
})

it('changes company without sending communication lists or other fields', async () => {
  reply({ contact: detailed })
  reply({ contact: { ...contact, revision: 3 } })
  expect((await call('PATCH', { revision: 2, company: 'Sample Co' })).status).toBe(200)
  expectRequest(1, 'PATCH', api + '/' + id, { info: { company: 'Sample Co' }, revision: 2, allowDuplicates: false })
})

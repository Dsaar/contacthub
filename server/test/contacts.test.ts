import { once } from 'node:events'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { app } from '../src/app.ts'

const dummyKey = 'dummy-key-for-tests'
const dummySite = 'dummy-site-for-tests'
const privateText = 'private-fixture@example.invalid'
const requestId = '1760000000.000-test-id'
const id = '00000000-0000-4000-8000-000000000001'
const secondId = '00000000-0000-4000-8000-000000000002'
const localFetch = globalThis.fetch
const wixFetch = vi.fn<typeof fetch>()
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
  vi.stubEnv('WIX_API_KEY', dummyKey)
  vi.stubEnv('WIX_SITE_ID', dummySite)
  wixFetch.mockReset()
  vi.stubGlobal('fetch', wixFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function getContacts(query = '') {
  return localFetch(`${origin}/api/contacts${query}`)
}

const emptyPage = { contacts: [], pagingMetadata: { count: 0, total: 0 } }

it('queries the Wix REST endpoint and returns only dashboard fields', async () => {
  const date = '2026-01-01T00:00:00Z'
  wixFetch.mockResolvedValue(Response.json({
    contacts: [{
      id, revision: 4, createdDate: date, updatedDate: date,
      primaryInfo: { email: 'primary@example.invalid', phone: '+15550100001' },
      info: {
        name: { first: 'Casey', last: 'Example' }, company: 'Example Co', jobTitle: 'Designer',
        emails: { items: [{ email: 'primary@example.invalid', tag: 'WORK', primary: true }] },
        phones: { items: [{ phone: '+15550100001' }, { phone: '+15550100002' }, { tag: 'WORK' }] },
        extendedFields: { private: privateText }, birthdate: '1980-01-01',
      },
      memberInfo: { memberId: 'private-member-id', status: 'ACTIVE' }, futureField: 42,
    }],
    pagingMetadata: { offset: 20, count: 1, total: 21, tooManyToCount: false, hasNext: false, extra: 1 },
  }))
  const response = await getContacts('?limit=100&offset=20')
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({
    contacts: [{
      id, revision: 4, firstName: 'Casey', lastName: 'Example',
      primaryEmail: 'primary@example.invalid', primaryPhone: '+15550100001',
      emails: ['primary@example.invalid'], phones: ['+15550100001', '+15550100002'],
      phoneDetails: [
        {phone:'+15550100001', primary:true, tag:null, countryCode:null, e164Phone:null},
        {phone:'+15550100002', primary:false, tag:null, countryCode:null, e164Phone:null},
      ],
      company: 'Example Co', jobTitle: 'Designer', createdDate: date, updatedDate: date, isSiteMember: true,
    }],
    pagingMetadata: { offset: 20, limit: 100, count: 1, total: 21, tooManyToCount: false, hasNext: false },
  })
  expect(wixFetch).toHaveBeenCalledTimes(1)
  const [url, options] = wixFetch.mock.calls[0]!
  expect(String(url)).toBe('https://www.wixapis.com/contacts/v4/contacts/query')
  expect(options?.method).toBe('POST')
  expect(options?.redirect).toBe('manual')
  expect(options?.headers).toEqual({
    Authorization: dummyKey, 'wix-site-id': dummySite, 'Content-Type': 'application/json',
  })
  expect(JSON.parse(String(options?.body))).toEqual({ query: { paging: { limit: 100, offset: 20 } } })
})

it('applies default pagination and accepts an empty result', async () => {
  wixFetch.mockResolvedValue(Response.json(emptyPage))
  const response = await getContacts()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    contacts: [], pagingMetadata: { count: 0, offset: 0, limit: 10, total: 0, tooManyToCount: null, hasNext: false },
  })
  expect(JSON.parse(String(wixFetch.mock.calls[0]?.[1]?.body))).toEqual({ query: { paging: { limit: 10, offset: 0 } } })
})

it('handles sparse contacts, secondary detail lists and unknown totals', async () => {
  wixFetch.mockResolvedValue(Response.json({
    contacts: [
      { id },
      { id: secondId, info: {
        emails: { items: [{ email: 'listed@example.invalid', primary: true }] },
        phones: { items: [{ phone: '+15550100001', primary: true }] },
      } },
    ],
    pagingMetadata: { tooManyToCount: true, total: 0 },
  }))
  const response = await getContacts('?offset=4')
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body).toEqual({
    contacts: [{
      id, revision: null, firstName: null, lastName: null, primaryEmail: null, primaryPhone: null,
      emails: [], phones: [], company: null, jobTitle: null, createdDate: null, updatedDate: null, isSiteMember: false,
    }, expect.objectContaining({ primaryEmail: 'listed@example.invalid', primaryPhone: '+15550100001' })],
    pagingMetadata: { count: 2, offset: 4, limit: 10, total: null, tooManyToCount: true, hasNext: null },
  })
})

it.each(['limit=0', 'limit=101', 'limit=', 'limit=1.5', 'limit=1&limit=2', 'limit=1e1',
  'offset=-1', 'offset=2147483648', 'offset=three', 'offset[]=2', 'search=Casey'])(
  'rejects invalid query %s before calling Wix', async query => {
    const response = await getContacts('?' + query)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_PAGINATION' } })
    expect(wixFetch).not.toHaveBeenCalled()
  },
)

it.each(['WIX_API_KEY', 'WIX_SITE_ID'])('keeps health available when %s is missing', async key => {
  vi.stubEnv(key, '')
  expect((await localFetch(origin + '/api/health')).status).toBe(200)
  const response = await getContacts()
  expect(response.status).toBe(503)
  expect(await response.json()).toMatchObject({ error: { code: 'WIX_CONFIG' } })
  expect(wixFetch).not.toHaveBeenCalled()
})

it.each([
  [400, 400, 'WIX_BAD_REQUEST'], [401, 401, 'WIX_UNAUTHORIZED'], [403, 403, 'WIX_FORBIDDEN'],
  [404, 404, 'WIX_NOT_FOUND'], [429, 429, 'WIX_RATE_LIMIT'], [503, 502, 'WIX_SERVER_ERROR'],
  [302, 502, 'WIX_INVALID_RESPONSE'],
] as const)('sanitizes Wix HTTP %i', async (upstreamStatus, localStatus, code) => {
  wixFetch.mockResolvedValue(new Response(privateText + dummyKey + dummySite, {
    status: upstreamStatus, headers: { 'x-wix-request-id': requestId, 'x-private': dummyKey },
  }))
  const response = await getContacts()
  expect(response.status).toBe(localStatus)
  const raw = await response.text()
  for (const value of [dummyKey, dummySite, privateText, 'x-private']) expect(raw).not.toContain(value)
  expect(JSON.parse(raw)).toEqual({ error: { code, message: expect.any(String), upstreamStatus, requestId } })
})

it.each([dummyKey, dummySite, privateText])('omits unsafe request IDs', async id => {
  wixFetch.mockResolvedValue(new Response(null, { status: 401, headers: { 'wix-request-id': id } }))
  const response = await getContacts()
  expect(await response.json()).not.toHaveProperty('error.requestId')
})

it('sanitizes a network failure', async () => {
  wixFetch.mockRejectedValue(new TypeError(dummyKey + privateText))
  const response = await getContacts()
  expect(response.status).toBe(502)
  const raw = await response.text()
  expect(raw).not.toContain(dummyKey)
  expect(raw).not.toContain(privateText)
  expect(JSON.parse(raw).error.code).toBe('WIX_NETWORK')
})

it('aborts a pending Wix request when the deadline expires', async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  const deadline = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => timeout(5))
  wixFetch.mockImplementation(async (_url, options) => {
    const signal = options!.signal!
    await once(signal, 'abort')
    throw signal.reason
  })
  const response = await getContacts()
  expect(deadline).toHaveBeenCalledWith(10_000)
  expect(response.status).toBe(504)
  expect(await response.json()).toMatchObject({ error: { code: 'WIX_TIMEOUT' } })
})

it.each(['not json', '{}', '{"contacts":[]}', '{"contacts":{},"pagingMetadata":{}}',
  '{"contacts":[{"id":"not-a-guid"}],"pagingMetadata":{}}',
  '{"contacts":[{"revision":1}],"pagingMetadata":{}}', '{"contacts":[],"pagingMetadata":{"total":"many"}}'])(
  'rejects malformed upstream data', async raw => {
    wixFetch.mockResolvedValue(new Response(raw, { headers: { 'wix-request-id': requestId } }))
    const response = await getContacts()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: {
      code: 'WIX_INVALID_RESPONSE', message: expect.any(String), upstreamStatus: 200, requestId,
    } })
  },
)

it.each([
  ['firstName', 'info.name.first'], ['lastName', 'info.name.last'], ['email', 'primaryInfo.email'],
  ['phone', 'primaryInfo.phone'], ['company', 'info.company'], ['jobTitle', 'info.jobTitle'],
])('sends the %s prefix filter to Wix before paging', async (field, path) => {
  wixFetch.mockResolvedValue(Response.json(emptyPage))
  expect((await getContacts('?q=Example&field=' + field + '&limit=25&offset=50')).status).toBe(200)
  expect(JSON.parse(String(wixFetch.mock.calls[0]?.[1]?.body))).toEqual({
    query: { paging: { limit:25, offset:50 }, filter: { [path!]: { $startsWith:'Example' } } },
  })
})

it('keeps Wix-provided phone metadata without inferring a calling code', async () => {
  wixFetch.mockResolvedValue(Response.json({contacts:[{
    id, primaryInfo:{phone:'202-555-0123'}, primaryPhone:{countryCode:'US',e164Phone:'+12025550123'},
    info:{phones:{items:[{phone:'202-555-0123',primary:true},{phone:'555-0102',countryCode:'CA'},{phone:'555-0103'}]}},
  }], pagingMetadata:{count:1}}))
  const response = await getContacts()
  expect(await response.json()).toMatchObject({contacts:[{primaryPhone:'202-555-0123',phones:['202-555-0123','555-0102','555-0103'],
    phoneDetails: [
      {phone:'202-555-0123',countryCode:'US',e164Phone:'+12025550123',primary:true},
      {phone:'555-0102',countryCode:'CA',e164Phone:null,primary:false},
      {phone:'555-0103',countryCode:null,e164Phone:null,primary:false},
    ]}]})
})

it.each(['field=unsupported&q=foo', 'q=a&q=b', 'q=' + 'x'.repeat(321)])('rejects unsupported search parameters', async query => {
  expect((await getContacts('?' + query)).status).toBe(400)
  expect(wixFetch).not.toHaveBeenCalled()
})

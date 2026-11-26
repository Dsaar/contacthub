import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../src/api'
afterEach(() => vi.unstubAllGlobals())
it('uses relative URLs, encodes search, and handles JSON, 204 and structured errors', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ status: 'ok', service: 'contacthub-api' }))
    .mockResolvedValueOnce(Response.json({ contacts: [], pagingMetadata: {} }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: 'WIX_NOT_FOUND', message: 'Missing', requestId: 'test-req', upstreamStatus: 404 } },
        { status: 404 },
      ),
    )
  vi.stubGlobal('fetch', fetch)
  expect((await api.health()).status).toBe('ok')
  await api.list({ q: 'A & B', field: 'company', limit: 25, offset: 0 })
  expect(fetch.mock.calls[1]?.[0]).toBe('/api/contacts?limit=25&offset=0&field=company&q=A+%26+B')
  expect(await api.remove('fictional')).toBeUndefined()
  await expect(api.get('fictional')).rejects.toMatchObject({
    code: 'WIX_NOT_FOUND',
    requestId: 'test-req',
    upstreamStatus: 404,
  })
})

it('does not confirm a mutation on a malformed success envelope', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})))
  await expect(api.create({ firstName: 'Example' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
})

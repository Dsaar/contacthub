import { once } from 'node:events'
import { expect, it } from 'vitest'
import { app } from '../src/app.ts'

it('serves the health contract over HTTP', async () => {
  await using server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected a TCP address')

  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`)

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toMatch(/^application\/json\b/)
  expect(await response.json()).toStrictEqual({ status: 'ok', service: 'contacthub-api' })
})

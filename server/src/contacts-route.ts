import { json, Router, type ErrorRequestHandler, type Response } from 'express'
import { z } from 'zod'
import { contactId, createInput, updateInput } from './contact-input.ts'
import { createContact, deleteContact, getContact, queryContacts, searchFields, updateContact } from './contacts.ts'
import { WixError } from './wix.ts'

const decimal = z.string().regex(/^\d+$/).transform(Number)
const pagination = z.strictObject({
  q: z.string().trim().min(1).max(320).optional(),
  field: z.enum(Object.keys(searchFields) as (keyof typeof searchFields)[]).optional(),
  limit: decimal.pipe(z.int().min(1).max(100)).default(10),
  offset: decimal.pipe(z.int().nonnegative().max(2_147_483_647)).default(0),
})

export const contactsRouter = Router()
const parseBody = json({ limit: '16kb', inflate: false })

function reject(response: Response, status: number, code: string, message: string) {
  return response.status(status).json({ error: { code, message } })
}

contactsRouter.use((request, response, next) => {
  response.set('Cache-Control', 'no-store')
  if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return next()

  // Validate Host independently of Origin, including for non-browser clients.
  const host = request.get('host')
  const localHost = ['127.0.0.1', 'localhost'].some(name =>
    host === `${name}:${request.socket.localPort}` || host === `${name}:5173`)
  const origin = request.get('origin')
  if (!localHost || (origin !== undefined && origin !== `http://${host}`) ||
      request.get('sec-fetch-site') === 'cross-site') {
    return reject(response, 403, 'ORIGIN_REJECTED', 'Use the local ContactHub origin for writes.')
  }
  if (Object.keys(request.query).length) return reject(response, 400, 'INVALID_INPUT', 'Writes take no query parameters.')
  if (request.method === 'DELETE') {
    if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) !== 0) {
      return reject(response, 400, 'INVALID_INPUT', 'DELETE takes no request body.')
    }
    return next()
  }
  if (!request.is('application/json')) return reject(response, 415, 'JSON_REQUIRED', 'Send an application/json body.')
  return parseBody(request, response, next)
})

contactsRouter.param('id', (request, response, next, value: string) => {
  const parsed = contactId.safeParse(value)
  if (!parsed.success) return reject(response, 400, 'INVALID_ID', 'Supply a contact GUID.')
  request.params.id = parsed.data
  next()
})

contactsRouter.get('/', async (request, response) => {
  const paging = pagination.safeParse(request.query)
  if (!paging.success) return reject(response, 400, 'INVALID_PAGINATION',
    'Check limit (1–100), offset (0–2147483647), search text (1–320 characters), and search field.')
  const { limit, offset, q, field } = paging.data
  return response.json(await queryContacts({ limit, offset }, q, field))
})

contactsRouter.get('/:id', async (request, response) => {
  return response.json({ contact: await getContact(request.params.id) })
})

contactsRouter.post('/', async (request, response) => {
  const parsed = createInput.safeParse(request.body)
  if (!parsed.success) return reject(response, 400, 'INVALID_INPUT',
    'Supply valid contact fields including at least a name, email, or phone.')
  return response.status(201).json({ contact: await createContact(parsed.data) })
})

contactsRouter.patch('/:id', async (request, response) => {
  const parsed = updateInput.safeParse(request.body)
  if (!parsed.success) return reject(response, 400, 'INVALID_INPUT',
    'Supply a nonnegative integer revision and at least one valid contact field. Use null to clear a field.')
  return response.json({ contact: await updateContact(request.params.id, parsed.data) })
})

contactsRouter.delete('/:id', async (request, response) => {
  await deleteContact(request.params.id)
  return response.status(204).end()
})

const contactErrors: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof WixError) {
    const { code, message, upstreamStatus, requestId } = error
    return response.status(error.status).json({ error: { code, message, upstreamStatus, requestId } })
  }
  if (error instanceof URIError) return reject(response, 400, 'INVALID_ID', 'Supply a contact GUID.')
  if (error.type === 'entity.too.large') return reject(response, 413, 'BODY_TOO_LARGE', 'JSON exceeds 16 KiB.')
  if (error.status === 415) return reject(response, 415, 'JSON_REQUIRED', 'Send uncompressed UTF-8 JSON.')
  if (error.status === 400) return reject(response, 400, 'INVALID_JSON', 'Send a valid JSON object.')
  return reject(response, 500, 'INTERNAL_ERROR', 'Unable to complete the contact request.')
}
contactsRouter.use(contactErrors)

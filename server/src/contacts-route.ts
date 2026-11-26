import { Router } from 'express'
import { z } from 'zod'
import { queryContacts } from './contacts.ts'
import { WixError } from './wix.ts'

const decimal = z.string().regex(/^\d+$/).transform(Number)
const pagination = z.strictObject({
  limit: decimal.pipe(z.int().min(1).max(100)).default(10),
  offset: decimal.pipe(z.int().nonnegative().max(2_147_483_647)).default(0),
})

export const contactsRouter = Router()

contactsRouter.get('/', async (request, response) => {
  response.set('Cache-Control', 'no-store')
  const paging = pagination.safeParse(request.query)
  if (!paging.success) {
    return response.status(400).json({ error: {
      code: 'INVALID_PAGINATION',
      message: 'Use only limit (1–100) and offset (0–2147483647), each as a single decimal integer.',
    } })
  }
  try {
    return response.json(await queryContacts(paging.data))
  } catch (error) {
    if (error instanceof WixError) {
      const { code, message, upstreamStatus, requestId } = error
      return response.status(error.status).json({ error: { code, message, upstreamStatus, requestId } })
    }
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to query contacts.' } })
  }
})

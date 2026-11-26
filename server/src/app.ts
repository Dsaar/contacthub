import express from 'express'
import { contactsRouter } from './contacts-route.ts'

export const app = express()

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'contacthub-api' })
})

app.use('/api/contacts', contactsRouter)

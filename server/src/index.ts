import dotenv from 'dotenv'
import { z } from 'zod'
import { app } from './app.ts'

dotenv.config({ quiet: true })
const port = z.coerce.number().int().min(1).max(65535).default(3000).parse(process.env.PORT)
const host = '127.0.0.1'

app.listen(port, host, (error) => {
  if (error) throw error
  console.log(`ContactHub API listening at http://${host}:${port}`)
})

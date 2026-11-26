import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'

export function loadServerConfig() {
  // src/ and dist/ are both one level below the server workspace.
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
  const port = z.coerce.number().int().min(1).max(65535).default(3000).safeParse(process.env.PORT)
  if (!port.success) throw new Error('PORT must be an integer from 1 to 65535.')
  return { port: port.data }
}

const credentialsSchema = z.object({
  WIX_API_KEY: z.string().trim().regex(/^[!-~]+$/),
  WIX_SITE_ID: z.string().trim().regex(/^[!-~]+$/),
})

export function getWixCredentials() {
  const result = credentialsSchema.safeParse(process.env)
  return result.success ? result.data : undefined
}

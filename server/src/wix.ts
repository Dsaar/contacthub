import type { z } from 'zod'
import { getWixCredentials } from './config.ts'

const errors = {
  WIX_CONFIG: [503, 'Set WIX_API_KEY and WIX_SITE_ID in the server environment and restart the API.'],
  WIX_BAD_REQUEST: [400, 'Wix rejected the query. Check its paging parameters.'],
  WIX_UNAUTHORIZED: [401, 'Wix rejected authentication. Check the server API key and site ID.'],
  WIX_FORBIDDEN: [403, 'Check the API key’s Read Contacts permission and access to the selected site.'],
  WIX_NOT_FOUND: [404, 'Wix could not find the requested resource. Check the configured site and endpoint.'],
  WIX_RATE_LIMIT: [429, 'Wix rate-limited this request. Wait before retrying.'],
  WIX_SERVER_ERROR: [502, 'Wix reported a server error. Try again later.'],
  WIX_NETWORK: [502, 'Could not reach Wix or finish reading its response. Check connectivity and retry.'],
  WIX_TIMEOUT: [504, 'The request to Wix timed out. Try again.'],
  WIX_INVALID_RESPONSE: [502, 'Wix returned an unexpected response. Check the REST response contract.'],
} as const

type WixErrorCode = keyof typeof errors

export class WixError extends Error {
  readonly code: WixErrorCode
  readonly status: number
  readonly upstreamStatus?: number
  readonly requestId?: string

  constructor(code: WixErrorCode, upstreamStatus?: number, requestId?: string) {
    const [status, message] = errors[code]
    super(message)
    this.code = code
    this.status = status
    this.upstreamStatus = upstreamStatus
    this.requestId = requestId
  }
}

const httpErrors: Partial<Record<number, WixErrorCode>> = {
  400: 'WIX_BAD_REQUEST',
  401: 'WIX_UNAUTHORIZED',
  403: 'WIX_FORBIDDEN',
  404: 'WIX_NOT_FOUND',
  429: 'WIX_RATE_LIMIT',
}

export async function wixRequest<T>(
  path: string,
  method: string,
  body: unknown,
  responseSchema: z.ZodType<T>,
): Promise<T> {
  const credentials = getWixCredentials()
  if (!credentials) throw new WixError('WIX_CONFIG')

  const url = new URL(path, 'https://www.wixapis.com')
  if (url.origin !== 'https://www.wixapis.com') throw new Error('Expected a Wix API path.')

  const signal = AbortSignal.timeout(10_000)
  let upstreamStatus: number | undefined
  let requestId: string | undefined
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: credentials.WIX_API_KEY,
        'wix-site-id': credentials.WIX_SITE_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      redirect: 'manual',
      signal,
    })
    upstreamStatus = response.status
    const id = response.headers.get('x-wix-request-id') ?? response.headers.get('wix-request-id')
    if (id && /^[A-Za-z0-9._:-]{1,200}$/.test(id) &&
        !id.includes(credentials.WIX_API_KEY) && !id.includes(credentials.WIX_SITE_ID)) {
      requestId = id
    }
    if (!response.ok) {
      void response.body?.cancel().catch(() => {})
      const code = httpErrors[response.status] ??
        (response.status >= 500 ? 'WIX_SERVER_ERROR' : 'WIX_INVALID_RESPONSE')
      throw new WixError(code, upstreamStatus, requestId)
    }

    const result = responseSchema.safeParse(await response.json())
    if (!result.success) throw new WixError('WIX_INVALID_RESPONSE', upstreamStatus, requestId)
    return result.data
  } catch (error) {
    if (error instanceof WixError) throw error
    if (signal.aborted || (error instanceof Error && error.name === 'TimeoutError')) {
      throw new WixError('WIX_TIMEOUT', upstreamStatus, requestId)
    }
    if (error instanceof SyntaxError) throw new WixError('WIX_INVALID_RESPONSE', upstreamStatus, requestId)
    throw new WixError('WIX_NETWORK', upstreamStatus, requestId)
  }
}

import { z } from 'zod'
import { getWixCredentials } from './config.ts'

const errors = {
  DUPLICATE_CONTACT: [409, 'A contact with this email or phone already exists.'],
  REVISION_CONFLICT: [409, 'The contact changed. Refresh it and review your edits before retrying.'],
  MERGED_CONTACT: [409, 'This ID resolves to a merged contact. Review the current contact before editing.'],
  PROTECTED_CONTACT: [428, 'Wix protects this contact because of a member, Wix user, or billing subscription.'],
  MEMBER_EMAIL_RESTRICTED: [428, 'A site member’s primary email cannot be changed through Contacts.'],
  AMBIGUOUS_PRIMARY: [409, 'The primary entry cannot be safely edited. Review the contact details in Wix.'],
  WIX_CONFLICT: [409, 'Wix reported a contact conflict. Review the current contact before proceeding.'],
  WIX_PRECONDITION: [428, 'Wix requires a precondition for this operation. Review the contact in Wix.'],
  WIX_CONFIG: [503, 'Set WIX_API_KEY and WIX_SITE_ID in the server environment and restart the API.'],
  WIX_BAD_REQUEST: [400, 'Wix rejected the request. Check the supplied contact data or paging parameters.'],
  WIX_UNAUTHORIZED: [401, 'Wix rejected authentication. Check the server API key and site ID.'],
  WIX_FORBIDDEN: [403, 'Check the site access and the API key permissions for this operation.'],
  WIX_NOT_FOUND: [404, 'Wix could not find the requested resource. Check the configured site and endpoint.'],
  WIX_RATE_LIMIT: [429, 'Wix rate-limited this request. Wait before retrying.'],
  WIX_SERVER_ERROR: [502, 'Wix reported a server error. Verify the current state before repeating a write.'],
  WIX_NETWORK: [502, 'Could not reach Wix or finish reading its response. Check connectivity and verify the current state before repeating a write.'],
  WIX_TIMEOUT: [504, 'The request to Wix timed out. Check the current contact state before repeating a write.'],
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
  409: 'WIX_CONFLICT',
  428: 'WIX_PRECONDITION',
  429: 'WIX_RATE_LIMIT',
}

const errorEnvelope = z.object({ details: z.object({ applicationError: z.object({ code: z.string() }) }) })

async function classifyFailure(response: Response): Promise<WixErrorCode> {
  const { status } = response
  if (status === 409 || status === 428) {
    // Read only the documented discriminator. Never propagate Wix messages or data.
    const details = await response.json().catch(() => null)
    const parsed = errorEnvelope.safeParse(details)
    const code = parsed.success ? parsed.data.details.applicationError.code : ''
    if (status === 409 && code === 'CONTACT_ALREADY_CHANGED') return 'REVISION_CONFLICT'
    if (status === 409 && code === 'DUPLICATE_CONTACT_EXISTS') return 'DUPLICATE_CONTACT'
    if (status === 428 && code === 'CANNOT_UPDATE_MEMBER_EMAIL') return 'MEMBER_EMAIL_RESTRICTED'
    if (status === 428 && ['CANNOT_DELETE_MEMBER', 'CANNOT_DELETE_MEMBER_OWNER_OR_CONTRIBUTOR',
      'CANNOT_DELETE_CONTACT_WITH_BILLING_SUBSCRIPTION'].includes(code)) return 'PROTECTED_CONTACT'
  } else {
    void response.body?.cancel().catch(() => {})
  }
  return httpErrors[status] ?? (status >= 500 ? 'WIX_SERVER_ERROR' : 'WIX_INVALID_RESPONSE')
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
      const code = await classifyFailure(response)
      throw new WixError(code, upstreamStatus, requestId)
    }

    if (method === 'DELETE' && response.status !== 200 && response.status !== 204) {
      void response.body?.cancel().catch(() => {})
      throw new WixError('WIX_INVALID_RESPONSE', upstreamStatus, requestId)
    }
    const result = responseSchema.safeParse(response.status === 204 ? undefined : await response.json())
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

import type { Changes, Contact, Field, Page, Query } from './types'

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly upstreamStatus?: number,
  ) {
    super(message)
  }
}
export function asError(error: unknown) {
  return error instanceof ApiError
    ? error
    : new ApiError('NETWORK', 'Cannot reach ContactHub. Check that the local server is running and refresh.')
}
async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/' + path, {
    method,
    signal,
    cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204 && method === 'DELETE') return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const problem = data?.error
    throw new ApiError(
      problem?.code || 'HTTP_ERROR',
      problem?.message || 'The server could not complete this request. Refresh and check the server.',
      problem?.requestId,
      problem?.upstreamStatus,
    )
  }
  if (!data || method === 'DELETE')
    throw new ApiError(
      'INVALID_RESPONSE',
      'Unexpected server response. Refresh to check the latest contact data.',
    )
  return data as T
}
const pathFor = (id: string) => 'contacts/' + encodeURIComponent(id)
async function contactRequest(path: string, method: string, body?: unknown, signal?: AbortSignal) {
  const result = await request<{ contact: Contact }>(path, method, body, signal)
  if (!result.contact?.id || typeof result.contact.revision !== 'number') {
    throw new ApiError(
      'INVALID_RESPONSE',
      'ContactHub could not confirm the contact. Refresh the directory before trying again.',
    )
  }
  return result
}
export const api = {
  health: (signal?: AbortSignal) =>
    request<{ status: string; service: string }>('health', 'GET', undefined, signal),
  list(query: Query, signal?: AbortSignal) {
    const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
    if (query.q) {
      params.set('field', query.field)
      params.set('q', query.q)
    }
    return request<Page>('contacts?' + params, 'GET', undefined, signal)
  },
  get: (id: string, signal?: AbortSignal) => contactRequest(pathFor(id), 'GET', undefined, signal),
  create: (body: Partial<Record<Field, string>>) => contactRequest('contacts', 'POST', body),
  update: (id: string, body: Changes & { revision: number }) => contactRequest(pathFor(id), 'PATCH', body),
  remove: (id: string) => request<void>(pathFor(id), 'DELETE'),
}

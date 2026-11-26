import { useEffect, useState } from 'react'
import { api, asError, type ApiError } from './api'
import type { Field, Page, Query } from './types'

const initial: Query = { q: '', field: 'firstName', limit: 10, offset: 0 }

export function useDirectory() {
  const [query, setQuery] = useState<Query>(initial)
  const [term, setTerm] = useState('')
  const [field, setField] = useState<Field>('firstName')
  const [cycle, setCycle] = useState(0)
  const [result, setResult] = useState<{ query: Query; page: Page } | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [checked, setChecked] = useState<Date | null>(null)
  const [emptyBoundary, setEmptyBoundary] = useState<{ query: Query; cycle: number } | null>(null)
  const pendingSearch = query.q !== term.trim() || query.field !== field
  useEffect(() => {
    const handle = setTimeout(
      () =>
        setQuery((old) =>
          old.q === term.trim() && old.field === field ? old : { ...old, field, q: term.trim(), offset: 0 },
        ),
      300,
    )
    return () => clearTimeout(handle)
  }, [term, field])

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    setBusy(true)
    setError(null)
    api
      .list(query, signal)
      .then((page) => {
        if (signal.aborted) return
        const meta = page.pagingMetadata
        if (!query.q) setTotal(meta.tooManyToCount ? null : meta.total)
        setChecked(new Date())
        if (!page.contacts.length && query.offset > 0) {
          setEmptyBoundary({ query, cycle })
          const last =
            meta.total === null || meta.tooManyToCount
              ? query.offset - query.limit
              : Math.floor(Math.max(0, meta.total - 1) / query.limit) * query.limit
          setQuery({ ...query, offset: Math.max(0, Math.min(last, query.offset - query.limit)) })
          return
        }
        setResult({ query, page })
      })
      .catch((e) => {
        if (!signal.aborted) setError(asError(e))
      })
      .finally(() => {
        if (!signal.aborted) setBusy(false)
      })
    return () => controller.abort()
  }, [query, cycle])
  // Filtered totals describe matches. Keep the global card independent of those totals.
  const filtered = Boolean(query.q)
  useEffect(() => {
    if (!filtered) return
    const controller = new AbortController()
    api
      .list({ ...initial, limit: 1 }, controller.signal)
      .then(({ pagingMetadata: meta }) => {
        if (!controller.signal.aborted) setTotal(meta.tooManyToCount ? null : meta.total)
      })
      .catch(() => {
        if (!controller.signal.aborted) setTotal(null)
      })
    return () => controller.abort()
  }, [filtered, cycle])

  const page = result?.query === query && !pendingSearch ? result.page : null
  const meta = page?.pagingMetadata
  const exact = meta?.tooManyToCount ? null : meta?.total
  const waiting = busy || pendingSearch
  // A full page with an unknown total may require one probe. Remember an empty
  // next page for this search until refresh or a successful mutation.
  const boundary = emptyBoundary?.query
  const atKnownEnd =
    emptyBoundary?.cycle === cycle &&
    boundary?.q === query.q &&
    boundary.field === query.field &&
    boundary.limit === query.limit &&
    query.offset + query.limit >= boundary.offset
  const next = !atKnownEnd && (meta?.hasNext ?? (meta && meta.count >= query.limit))
  const status = error
    ? ['WIX_CONFIG', 'WIX_UNAUTHORIZED', 'NETWORK'].includes(error.code)
      ? 'Disconnected'
      : 'Failed'
    : waiting
      ? 'Loading'
      : checked
        ? 'Connected'
        : 'Disconnected'
  function refresh() {
    setCycle((n) => n + 1)
  }
  return {
    query,
    setQuery,
    term,
    setTerm,
    field,
    setField,
    page,
    meta,
    exact,
    next,
    waiting,
    status,
    checked,
    total,
    busy,
    error,
    refresh,
  }
}

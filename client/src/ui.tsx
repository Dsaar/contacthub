import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertCircle, X } from 'lucide-react'
import type { ApiError } from './api'

export function ErrorNotice({ error, individual = true }: { error: ApiError; individual?: boolean }) {
  const message =
    individual && error.code === 'WIX_NOT_FOUND'
      ? 'This contact no longer exists. Close this dialog and refresh the directory.'
      : error.message
  return (
    <div className="alert error" role="alert">
      <AlertCircle size={17} />
      <div>
        {message}
        {(error.requestId || error.upstreamStatus) && (
          <details>
            <summary>Error details</summary>
            {error.upstreamStatus && <div>Wix HTTP {error.upstreamStatus}</div>}
            {error.requestId && <div>Request ID: {error.requestId}</div>}
          </details>
        )}
      </div>
    </div>
  )
}

export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = ref.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    return () => {
      element.close()
      if (trigger?.isConnected) trigger.focus()
      else document.getElementById('add-contact')?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close dialog" className="icon" disabled={busy} onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  )
}

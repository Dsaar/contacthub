import { useEffect, useRef, useState } from 'react'
import { api, asError, type ApiError } from './api'
import { Dialog, ErrorNotice } from './ui'
import { contactIdentity, contactName, phoneEntries, type Contact } from './types'

export function ContactDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    api
      .get(id, controller.signal)
      .then(({ contact }) => {
        if (!controller.signal.aborted) setContact(contact)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(asError(e))
      })
    return () => controller.abort()
  }, [id])
  const phones = contact ? phoneEntries(contact) : []
  return (
    <Dialog title="Contact details" onClose={onClose}>
      <div className="modal-body">
        {error ? (
          <ErrorNotice error={error} />
        ) : !contact ? (
          <p role="status">Loading contact…</p>
        ) : (
          <>
            <h3>{contactName(contact)}</h3>
            <p className="hint">
              {contact.isSiteMember ? 'Site member · Wix protects this contact from deletion.' : 'Contact'}
            </p>
            <dl className="details">
              <dt>Email addresses</dt>
              <dd>
                {[...new Set([contact.primaryEmail, ...contact.emails].filter(Boolean))].map((email) => (
                  <div key={email}>
                    {email}
                    {email === contact.primaryEmail && <small>Primary</small>}
                  </div>
                ))}
                {!contact.primaryEmail && !contact.emails.length && '—'}
              </dd>
              <dt>Phone numbers</dt>
              <dd>
                {phones.map((entry, index) => (
                  <div key={index}>
                    {entry.phone}
                    {entry.e164Phone && entry.e164Phone !== entry.phone && ' · ' + entry.e164Phone}
                    {entry.countryCode && ' (' + entry.countryCode + ')'}
                    {entry.tag && ' · ' + entry.tag}
                    {entry.primary && <small>Primary</small>}
                  </div>
                ))}
                {!phones.length && '—'}
              </dd>
              <dt>Company</dt>
              <dd>{contact.company || '—'}</dd>
              <dt>Job title</dt>
              <dd>{contact.jobTitle || '—'}</dd>
            </dl>
          </>
        )}
      </div>
    </Dialog>
  )
}

export function DeleteDialog({
  contact,
  onClose,
  onDeleted,
}: {
  contact: Contact
  onClose: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<ApiError | null>(null)
  async function remove() {
    if (lock.current || contact.isSiteMember) return
    lock.current = true
    setBusy(true)
    try {
      await api.remove(contact.id)
      onDeleted()
    } catch (e) {
      setError(asError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog title="Delete contact?" busy={busy} onClose={onClose}>
      <div className="modal-body">
        <p>
          This permanently deletes <strong>{contactIdentity(contact)}</strong> from your Wix site.
        </p>
        {error && <ErrorNotice error={error} />}
      </div>
      <footer className="modal-foot">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button className="danger" disabled={busy} onClick={remove}>
          {busy ? 'Deleting…' : 'Delete contact'}
        </button>
      </footer>
    </Dialog>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { api, ApiError, asError } from './api'
import { Dialog, ErrorNotice } from './ui'
import {
  fields,
  primaryPhoneDisplay,
  labels,
  type Changes,
  type Contact,
  type Draft,
  type Field,
} from './types'

function values(contact?: Contact): Draft {
  return {
    firstName: contact?.firstName ?? '',
    lastName: contact?.lastName ?? '',
    email: contact?.primaryEmail ?? '',
    phone: contact ? (primaryPhoneDisplay(contact) ?? '') : '',
    company: contact?.company ?? '',
    jobTitle: contact?.jobTitle ?? '',
  }
}
function changes(draft: Draft, contact: Contact) {
  const original = values(contact)
  const patch: Changes = {}
  for (const field of fields) {
    if (field === 'email' && contact.isSiteMember) continue
    if (draft[field] !== original[field] && draft[field].trim() !== original[field].trim())
      patch[field] = draft[field].trim() || null
  }
  return patch
}
const maxLength = (field: Field) => (field === 'email' ? 320 : field === 'phone' ? 50 : 1000)
function validate(draft: Draft, baseline: Contact | null) {
  const errors: Partial<Draft> = {}
  const selected = baseline ? changes(draft, baseline) : draft
  for (const field of fields) {
    const value = selected[field]?.trim()
    if (!value) continue
    if (value.length > maxLength(field)) errors[field] = 'Use at most ' + maxLength(field) + ' characters.'
    else if (
      field === 'email' &&
      !/^(?:[A-Z0-9_'+-]+\.)*[A-Z0-9_'+-]*[A-Z0-9_+-]@(?:[A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i.test(value)
    )
      errors.email = 'Enter a valid email address.'
    else if (field === 'phone' && !/^\+?(?=[\d(). -]*\d)[\d(). -]+(?:\s*(?:ext\.?|x|#)\s*\d+)?$/i.test(value))
      errors.phone = 'Enter a phone number, optionally with an extension.'
  }
  if (
    !baseline &&
    ![draft.firstName, draft.lastName, draft.email, draft.phone].some((value) => value.trim())
  ) {
    errors.firstName = 'Enter a first name, last name, email, or phone.'
  }
  return errors
}

export function ContactEditor({
  id,
  onClose,
  onSaved,
}: {
  id?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [contact, setContact] = useState<Contact | null>(null)
  const [draft, setDraft] = useState<Draft>(values())
  const [loading, setLoading] = useState(Boolean(id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [errors, setErrors] = useState<Partial<Draft>>({})
  const [conflict, setConflict] = useState<'none' | 'stale' | 'review'>('none')
  const [protectedDraftEmail, setProtectedDraftEmail] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    api
      .get(id, controller.signal)
      .then(({ contact: latest }) => {
        if (controller.signal.aborted) return
        if (latest.id !== id)
          throw new ApiError(
            'MERGED_CONTACT',
            'This contact was merged. Close the editor and refresh the directory.',
          )
        setContact(latest)
        setDraft(values(latest))
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(asError(e))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [id])

  async function loadLatest() {
    if (!contact || lock.current) return
    lock.current = true
    setBusy(true)
    try {
      const { contact: fresh } = await api.get(contact.id)
      if (fresh.id !== contact.id)
        throw new ApiError('MERGED_CONTACT', 'Merged contact. Close the editor and refresh the list.')
      const next = values(fresh)
      const pending = changes(draft, contact)
      setProtectedDraftEmail(fresh.isSiteMember && 'email' in pending ? draft.email : null)
      for (const field of fields) {
        if (field in pending && !(fresh.isSiteMember && field === 'email')) next[field] = draft[field]
      }
      setDraft(next)
      setContact(fresh)
      setConflict('review')
      setReviewed(false)
      setError(null)
    } catch (e) {
      setError(asError(e))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || (id && !contact) || conflict === 'stale' || (conflict === 'review' && !reviewed))
      return
    const invalid = validate(draft, contact)
    setErrors(invalid)
    const first = fields.find((field) => invalid[field])
    if (first) {
      document.getElementById('edit-' + first)?.focus()
      return
    }
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      if (contact) {
        const patch = changes(draft, contact)
        if (contact.revision === null || !Object.keys(patch).length) return
        await api.update(contact.id, { ...patch, revision: contact.revision })
      } else {
        await api.create(
          Object.fromEntries(
            fields.filter((field) => draft[field].trim()).map((field) => [field, draft[field].trim()]),
          ),
        )
      }
      onSaved()
    } catch (e) {
      const problem = asError(e)
      setError(problem)
      if (problem.code === 'REVISION_CONFLICT') setConflict('stale')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const dirty = contact ? Object.keys(changes(draft, contact)).length > 0 : true
  return (
    <Dialog title={id ? 'Edit contact' : 'Add contact'} busy={busy} onClose={onClose}>
      {loading ? (
        <p className="modal-body" role="status">
          Loading latest contact…
        </p>
      ) : (
        <form noValidate onSubmit={submit}>
          <div className="modal-body">
            {error && <ErrorNotice error={error} />}
            {conflict === 'stale' && (
              <button type="button" className="secondary" disabled={busy} onClick={loadLatest}>
                Load latest version
              </button>
            )}
            {(!id || contact) && (
              <>
                {!id && <p className="hint mb-4">Enter at least a name, email, or phone number.</p>}
                <div className="form-grid">
                  {fields.map((field) => (
                    <div key={field}>
                      <label htmlFor={'edit-' + field}>{labels[field]}</label>
                      <input
                        id={'edit-' + field}
                        value={draft[field]}
                        type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                        maxLength={maxLength(field)}
                        disabled={busy || (field === 'email' && contact?.isSiteMember)}
                        aria-invalid={Boolean(errors[field])}
                        aria-describedby={
                          errors[field]
                            ? 'err-' + field
                            : field === 'email' && contact?.isSiteMember
                              ? 'member-email'
                              : undefined
                        }
                        onChange={(e) => {
                          setDraft({ ...draft, [field]: e.target.value })
                          setErrors({ ...errors, [field]: undefined })
                        }}
                      />
                      {errors[field] && (
                        <small role="alert" className="field-error" id={'err-' + field}>
                          {errors[field]}
                        </small>
                      )}
                      {field === 'email' && contact?.isSiteMember && (
                        <small id="member-email">
                          <LockKeyhole size={12} /> Wix protects site member emails.
                        </small>
                      )}
                      {conflict === 'review' && contact && field in changes(draft, contact) && (
                        <small>Latest in Wix: {values(contact)[field] || 'Empty'}</small>
                      )}
                    </div>
                  ))}
                </div>
                {protectedDraftEmail !== null && (
                  <p className="hint">
                    Wix now protects this member’s email. Your proposed email edit (
                    {protectedDraftEmail || 'clear email'}) cannot be submitted.
                  </p>
                )}
                {conflict === 'review' && (
                  <label className="review">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />{' '}
                    I reviewed my edits against the latest version.
                  </label>
                )}
              </>
            )}
          </div>
          <footer className="modal-foot">
            <button type="button" className="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                (Boolean(id) && (!contact || contact.revision === null)) ||
                !dirty ||
                conflict === 'stale' ||
                (conflict === 'review' && !reviewed)
              }
            >
              {busy ? 'Working…' : id ? 'Save changes' : 'Create contact'}
            </button>
          </footer>
        </form>
      )}
    </Dialog>
  )
}

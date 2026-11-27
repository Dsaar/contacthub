import { useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Database,
  Link2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from 'lucide-react'
import { useDirectory } from './useDirectory'
import { fields, labels, type Field } from './types'
import { Directory, type Modal } from './Directory'
import { ContactEditor } from './ContactEditor'
import { ContactDetails, DeleteDialog } from './ContactDialogs'
import { ErrorNotice } from './ui'

export default function App() {
  const {
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
    refreshAfterMutation,
  } = useDirectory()
  const [modal, setModal] = useState<Modal | null>(null)
  const [notice, setNotice] = useState('')
  function saved(message: string) {
    setModal(null)
    setNotice(message)
    refreshAfterMutation()
  }
  return (
    <div className="shell">
      <header className="topbar">
        <div className="container top-inner">
          <div className="brand">
            <span className="brand-mark">
              <ContactRound size={21} />
            </span>
            ContactHub
          </div>
          <a
            className="docs-link"
            href="https://dev.wix.com/docs/api-reference/crm/members-contacts/contacts/contacts/contact-v4/query-contacts"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={15} /> API reference <ArrowUpRight size={13} />
          </a>
        </div>
      </header>
      <main className="container content">
        <section className="page-heading">
          <div>
            <h1>Contacts</h1>
            <p>Manage the contacts and site members on your Wix site.</p>
          </div>
          <button id="add-contact" className="primary" onClick={() => setModal({ kind: 'create' })}>
            <Plus size={17} /> Add contact
          </button>
        </section>
        <div className="metrics">
          <section className="metric">
            <span className="metric-icon">
              <UsersRound />
            </span>
            <div>
              <h2>Total contacts</h2>
              <strong className="count">{total?.toLocaleString() ?? '—'}</strong>
            </div>
            <span className="metric-note">
              {total === null && checked ? 'Exact total unavailable' : 'Across your site'}
            </span>
          </section>
          <section className="metric">
            <span className="metric-icon link-icon">
              <Link2 />
            </span>
            <div>
              <h2>Wix integration</h2>
              <strong className={'connection ' + status.toLowerCase()}>
                <i />
                {status}
              </strong>
            </div>
            {checked && (
              <span className="metric-note">
                Last checked {checked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </section>
        </div>
        {notice && (
          <div className="alert success" role="status">
            <Check size={17} />
            {notice}
            <button aria-label="Dismiss notification" className="icon" onClick={() => setNotice('')}>
              <X />
            </button>
          </div>
        )}
        <section className="panel" aria-labelledby="directory-heading">
          <div className="panel-head">
            <div className="panel-name">
              <span className="directory-icon">
                <ContactRound size={20} />
              </span>
              <h2 id="directory-heading">Contact directory</h2>
            </div>
            <button className="secondary refresh" disabled={waiting} onClick={refresh}>
              <RefreshCw size={15} />
              {busy && checked ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="tools">
            <div className="search-wrap">
              <Search size={17} />
              <input
                type="search"
                aria-label="Search contacts"
                placeholder={'Search by ' + labels[field].toLowerCase() + '…'}
                maxLength={320}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
            <label className="field-select">
              Search field
              <select value={field} onChange={(e) => setField(e.target.value as Field)}>
                {fields.map((key) => (
                  <option key={key} value={key}>
                    {labels[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div className="list-error">
              <ErrorNotice error={error} individual={false} />
            </div>
          )}
          <div aria-busy={waiting} className="table-area">
            {page?.contacts.length ? (
              <Directory contacts={page.contacts} open={setModal} />
            ) : (
              <div className="empty" role="status">
                {waiting ? (
                  <>
                    <LoaderCircle className="spin" />
                    <h3>Loading contacts…</h3>
                  </>
                ) : error ? (
                  <>
                    <Database />
                    <h3>Directory unavailable</h3>
                    <p>Use Refresh after resolving the connection issue.</p>
                  </>
                ) : (
                  <>
                    <span className="empty-icon">{query.q ? <Search /> : <UsersRound />}</span>
                    <h3>{query.q ? 'No matching contacts' : 'No contacts yet'}</h3>
                    <p>
                      {query.q
                        ? 'Try a different prefix or search field.'
                        : 'Add your first contact to this Wix site.'}
                    </p>
                    <button
                      className="secondary"
                      onClick={() => (query.q ? setTerm('') : setModal({ kind: 'create' }))}
                    >
                      {query.q ? 'Clear search' : 'Add a contact'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <footer className="pagination">
            <span>
              {meta?.count
                ? `${meta.offset + 1}–${meta.offset + meta.count}${exact != null ? ' of ' + exact : ''} ${query.q ? 'matches' : 'contacts'}`
                : '0 displayed'}
            </span>
            <div>
              <label>
                Rows per page{' '}
                <select
                  value={query.limit}
                  onChange={(e) => setQuery({ ...query, limit: Number(e.target.value), offset: 0 })}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <button
                className="pager"
                aria-label="Previous page"
                disabled={waiting || !query.offset}
                onClick={() => setQuery({ ...query, offset: query.offset - query.limit })}
              >
                <ChevronLeft />
              </button>
              <button
                className="pager"
                aria-label="Next page"
                disabled={waiting || !page?.contacts.length || !next}
                onClick={() => setQuery({ ...query, offset: query.offset + query.limit })}
              >
                <ChevronRight />
              </button>
            </div>
          </footer>
        </section>
      </main>
      {(modal?.kind === 'create' || modal?.kind === 'edit') && (
        <ContactEditor
          key={modal.kind}
          id={modal.kind === 'edit' ? modal.contact.id : undefined}
          onClose={() => setModal(null)}
          onSaved={() => saved(modal.kind === 'create' ? 'Contact created.' : 'Contact updated.')}
        />
      )}
      {modal?.kind === 'details' && <ContactDetails id={modal.contact.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && (
        <DeleteDialog
          contact={modal.contact}
          onClose={() => setModal(null)}
          onDeleted={() => saved('Contact deleted.')}
        />
      )}
    </div>
  )
}

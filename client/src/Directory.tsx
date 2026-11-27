import { Building2, ChevronRight, ContactRound, LockKeyhole, Pencil, Trash2, UserRound } from 'lucide-react'
import { contactIdentity, contactName, primaryPhoneDisplay, type Contact } from './types'

export type Modal = { kind: 'create' } | { kind: 'edit' | 'details' | 'delete'; contact: Contact }

export function Directory({ contacts, open }: { contacts: Contact[]; open: (modal: Modal) => void }) {
  return (
    <table className="directory">
      <caption className="sr-only">Contacts in the current page</caption>
      <thead>
        <tr>
          {['Name / Email', 'Phone', 'Company / Role', 'Type', 'Actions'].map((title) => (
            <th scope="col" key={title}>
              {title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {contacts.map((contact) => {
          const name = contactName(contact)
          const identity = contactIdentity(contact)
          const initials = [contact.firstName, contact.lastName]
            .map((value) => Array.from(value || '')[0])
            .filter(Boolean)
            .join('')
            .toLocaleUpperCase()
          return (
            <tr key={contact.id}>
              <td className="identity-cell">
                <button
                  className="identity"
                  onClick={() => open({ kind: 'details', contact })}
                  aria-label={'View details for ' + identity}
                >
                  <span className={'avatar tone-' + (contact.id.charCodeAt(contact.id.length - 1) % 4)}>
                    {initials || <UserRound size={18} />}
                  </span>
                  <span className="identity-text">
                    <strong>{name}</strong>
                    <span>
                      {contact.primaryEmail && contact.primaryEmail !== name
                        ? contact.primaryEmail
                        : 'View details'}
                    </span>
                  </span>
                </button>
              </td>
              <td className="phone-cell">
                <span className="mobile-label">Phone</span>
                {primaryPhoneDisplay(contact) || '—'}
              </td>
              <td className="work-cell">
                <span className="mobile-label">
                  <Building2 size={13} /> Work
                </span>
                <div>{contact.company || '—'}</div>
                {contact.jobTitle && <span className="sub">{contact.jobTitle}</span>}
              </td>
              <td className="type-cell">
                <span className={'type ' + (contact.isSiteMember ? 'member' : '')}>
                  {contact.isSiteMember ? <ContactRound size={13} /> : <UserRound size={13} />}{' '}
                  {contact.isSiteMember ? 'Site member' : 'Contact'}
                </span>
              </td>
              <td className="actions">
                <div>
                  <button
                    className="icon"
                    title="View details"
                    aria-label={'Contact details for ' + identity}
                    onClick={() => open({ kind: 'details', contact })}
                  >
                    <ChevronRight />
                  </button>
                  <button
                    className="icon"
                    title="Edit contact"
                    aria-label={'Edit ' + identity}
                    onClick={() => open({ kind: 'edit', contact })}
                  >
                    <Pencil />
                  </button>
                  {contact.isSiteMember ? (
                    <span
                      className="locked"
                      tabIndex={0}
                      aria-label="Site members cannot be deleted"
                      title="Wix protects site members from deletion"
                    >
                      <LockKeyhole size={15} />
                      <span className="tooltip">Wix protects site members from deletion.</span>
                    </span>
                  ) : (
                    <button
                      className="icon remove"
                      title="Delete contact"
                      aria-label={'Delete ' + identity}
                      onClick={() => open({ kind: 'delete', contact })}
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

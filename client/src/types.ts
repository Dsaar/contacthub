export interface PhoneDetail {
  phone: string
  countryCode: string | null
  e164Phone: string | null
  primary?: boolean
  tag?: string | null
}

export interface Contact {
  id: string
  revision: number | null
  firstName: string | null
  lastName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  emails: string[]
  phones: string[]
  phoneDetails?: PhoneDetail[]
  company: string | null
  jobTitle: string | null
  createdDate: string | null
  updatedDate: string | null
  isSiteMember: boolean
}

export const labels = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  company: 'Company',
  jobTitle: 'Job title',
}
export type Field = keyof typeof labels
export const fields = Object.keys(labels) as Field[]
export type Draft = Record<Field, string>
export type Changes = Partial<Record<Field, string | null>>
export interface Query {
  limit: number
  offset: number
  q: string
  field: Field
}
export interface Page {
  contacts: Contact[]
  pagingMetadata: {
    count: number
    offset: number
    limit: number
    total: number | null
    hasNext: boolean | null
    tooManyToCount: boolean | null
  }
}
export function contactName(contact: Contact) {
  return (
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
    contact.primaryEmail ||
    primaryPhoneDisplay(contact) ||
    'Unnamed contact'
  )
}
// Older responses had display strings and optional, partial metadata.
export function phoneEntries(contact: Contact): PhoneDetail[] {
  const details = contact.phoneDetails ?? []
  if (details.length && details.every(item => item.primary !== undefined)) return details
  const numbers = [...contact.phones]
  if (contact.primaryPhone && !numbers.includes(contact.primaryPhone)) numbers.unshift(contact.primaryPhone)
  return numbers.map(phone => {
    const matches = details.filter(item => item.phone === phone)
    const unique = numbers.indexOf(phone) === numbers.lastIndexOf(phone)
    const detail = unique && matches.length === 1 ? matches[0] : undefined
    return { phone, countryCode: detail?.countryCode ?? null, e164Phone: detail?.e164Phone ?? null,
      tag: detail?.tag, primary: unique && phone === contact.primaryPhone }
  })
}

export function primaryPhoneDisplay(contact: Contact) {
  return phoneEntries(contact).find(item => item.primary)?.e164Phone || contact.primaryPhone
}

export function contactIdentity(contact: Contact) {
  return [...new Set([contactName(contact), contact.primaryEmail, primaryPhoneDisplay(contact)].filter(Boolean))].join(' · ')
}

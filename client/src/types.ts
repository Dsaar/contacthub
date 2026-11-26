export interface Contact {
  id: string
  revision: number | null
  firstName: string | null
  lastName: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  emails: string[]
  phones: string[]
  phoneDetails?: { phone: string; countryCode: string | null; e164Phone: string | null }[]
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
    'Unnamed contact'
  )
}
export function internationalPhone(contact: Contact, phone: string | null) {
  return contact.phoneDetails?.find((item) => item.phone === phone)?.e164Phone || phone
}

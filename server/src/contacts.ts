import { z } from 'zod'
import { contactId, type ContactChanges, type createInput, type updateInput } from './contact-input.ts'
import { WixError, wixRequest } from './wix.ts'

const text = z.string().optional()
const timestamp = z.iso.datetime({ offset: true }).optional()
const integer = z.int().nonnegative()

const wixContact = z.object({
  id: contactId,
  revision: integer.optional(),
  createdDate: timestamp,
  updatedDate: timestamp,
  primaryPhone: z.object({ phone: text, countryCode: text, e164Phone: text }).optional(),
  primaryInfo: z.object({ email: text, phone: text }).optional(),
  info: z.object({
    name: z.object({ first: text, last: text }).optional(),
    emails: z.object({
      items: z.array(z.object({ email: text, tag: text, primary: z.boolean().optional() })).optional(),
    }).optional(),
    phones: z.object({
      items: z.array(z.object({ phone: text, tag: text, countryCode: text, e164Phone: text, primary: z.boolean().optional() })).optional(),
    }).optional(),
    company: text,
    jobTitle: text,
  }).optional(),
  memberInfo: z.object({ memberId: text }).optional(),
})

const queryResponse = z.object({
  contacts: z.array(wixContact),
  pagingMetadata: z.object({
    count: integer.optional(),
    offset: integer.optional(),
    total: integer.optional(),
    tooManyToCount: z.boolean().optional(),
    hasNext: z.boolean().optional(),
  }),
})

type WixContact = z.infer<typeof wixContact>

// Wix can supply the primary in the collection, the summary, or both. Keep
// object identity so two countries sharing a national number remain distinct.
function resolvePhones(contact?: WixContact) {
  const items = contact?.info?.phones?.items ?? []
  const summary = contact?.primaryPhone
  const number = contact?.primaryInfo?.phone ?? summary?.phone
  const flagged = items.filter(item => item.primary)
  const conflictingNumbers = number && summary?.phone && number !== summary.phone
  const internationalMatches = summary?.e164Phone
    ? items.filter(item => item.e164Phone === summary.e164Phone) : []
  const possible = internationalMatches.length ? internationalMatches : items
  const candidates = possible.filter(item => {
    if (!item.phone || (flagged.length && !item.primary)) return false
    if (number && item.phone !== number) return false
    if (summary?.countryCode && item.countryCode && item.countryCode !== summary.countryCode) return false
    if (summary?.e164Phone && item.e164Phone && item.e164Phone !== summary.e164Phone) return false
    return Boolean(item.primary || number || internationalMatches.length)
  })
  const primary = !conflictingNumbers && flagged.length <= 1 && candidates.length === 1
    ? candidates[0] : undefined
  return { items, primary, number: number ?? primary?.phone ?? summary?.e164Phone, summary }
}

function dashboardContact(contact: WixContact) {
  const { info, primaryInfo } = contact
  const emails = info?.emails?.items ?? []
  const { items: phones, primary, number, summary } = resolvePhones(contact)
  const phoneDetails = phones.flatMap(item => item.phone ? [{
    phone: item.phone, primary: item === primary, tag: item.tag ?? null,
    countryCode: item.countryCode ?? (item === primary ? summary?.countryCode : undefined) ?? null,
    e164Phone: item.e164Phone ?? (item === primary ? summary?.e164Phone : undefined) ?? null,
  }] : [])
  // A summary-only number is readable, but cannot identify a writable list item.
  if (number && !phoneDetails.some(item => item.phone === number)) {
    const matchingSummary = !summary?.phone || summary.phone === number ? summary : undefined
    phoneDetails.push({ phone: number, primary: true, tag: null,
      countryCode: matchingSummary?.countryCode ?? null, e164Phone: matchingSummary?.e164Phone ?? null })
  }
  return {
    id: contact.id,
    revision: contact.revision ?? null,
    firstName: info?.name?.first ?? null,
    lastName: info?.name?.last ?? null,
    primaryEmail: primaryInfo?.email ?? emails.find(item => item.primary && item.email)?.email ?? null,
    primaryPhone: number ?? null,
    ...(phoneDetails.length ? { phoneDetails } : {}),
    emails: emails.flatMap(item => item.email ? [item.email] : []),
    phones: phones.flatMap(item => item.phone ? [item.phone] : []),
    company: info?.company ?? null,
    jobTitle: info?.jobTitle ?? null,
    createdDate: contact.createdDate ?? null,
    updatedDate: contact.updatedDate ?? null,
    isSiteMember: Boolean(contact.memberInfo?.memberId),
  }
}

export const searchFields = {
  firstName: 'info.name.first', lastName: 'info.name.last', email: 'primaryInfo.email',
  phone: 'primaryInfo.phone', company: 'info.company', jobTitle: 'info.jobTitle',
} as const

export async function queryContacts(paging: { limit: number, offset: number }, term?: string, field: keyof typeof searchFields = 'firstName') {
  const filter = term ? { [searchFields[field]]: { $startsWith: term } } : undefined
  const { contacts, pagingMetadata } = await wixRequest(
    '/contacts/v4/contacts/query', 'POST', { query: { paging, filter } }, queryResponse,
  )
  const offset = pagingMetadata.offset ?? paging.offset
  const count = pagingMetadata.count ?? contacts.length
  const total = pagingMetadata.tooManyToCount ? null : pagingMetadata.total ?? null
  return {
    contacts: contacts.map(dashboardContact),
    pagingMetadata: {
      limit: paging.limit,
      offset,
      count,
      total,
      tooManyToCount: pagingMetadata.tooManyToCount ?? null,
      hasNext: pagingMetadata.hasNext ?? (total === null ? null : offset + count < total),
    },
  }
}

const singleContact = wixContact.extend({ revision: z.int32().nonnegative() })
const singleResponse = z.object({ contact: singleContact, responseType: z.string().optional() })
const collection = '/contacts/v4/contacts'
type Contact = z.infer<typeof singleContact>

function readContact(id: string) {
  return wixRequest(`${collection}/${id}`, 'GET', undefined, singleResponse)
}

export async function getContact(id: string) {
  return dashboardContact((await readContact(id)).contact)
}

async function mutationTarget(id: string) {
  const { contact, responseType } = await readContact(id)
  if (contact.id !== id || responseType === 'MERGED') throw new WixError('MERGED_CONTACT')
  return contact
}

// Collections in PATCH are replacements. Preserve order and writable metadata.
function emailItems(contact: Contact | undefined, value: string | null) {
  const items = contact?.info?.emails?.items ?? []
  const summary = contact?.primaryInfo?.email
  const flagged = items.filter(item => item.primary)
  const matches = summary ? items.filter(item => item.email === summary) : []
  if (flagged.length > 1 || (summary && (matches.length !== 1 || (flagged[0] && flagged[0] !== matches[0]))) ||
      items.some(item => !item.email)) throw new WixError('AMBIGUOUS_PRIMARY')
  const primary = flagged[0] ?? matches[0]
  if (value && items.some(item => item !== primary && item.email === value)) throw new WixError('AMBIGUOUS_PRIMARY')
  if (value === null) return items.filter(item => item !== primary)
  if (!primary) return [...items, { email: value, primary: true }]
  return items.map(item => item === primary ? { ...item, email: value, primary: true } : item)
}

function phoneItems(contact: Contact | undefined, value: string | null) {
  const { items, primary, number, summary } = resolvePhones(contact)
  const unresolved = !primary && (items.length > 0 || number || summary?.countryCode)
  const duplicatesSecondary = value && items.some(item =>
    item !== primary && (item.phone === value || item.e164Phone === value))
  if (unresolved || duplicatesSecondary || items.some(item => !item.phone)) {
    throw new WixError('AMBIGUOUS_PRIMARY')
  }
  if (!primary) return value === null ? [] : [{ phone: value, primary: true }]
  return items.flatMap(item => {
    const { phone, countryCode, tag } = item
    if (item !== primary) return [{ phone, countryCode, tag, primary: item.primary }]
    if (value === null) return []
    return [{ phone: value, countryCode: countryCode ?? summary?.countryCode, tag, primary: true }]
  })
}

function contactInfo(changes: ContactChanges, contact?: Contact) {
  const { firstName, lastName, email, phone, company, jobTitle } = changes
  return {
    name: firstName !== undefined || lastName !== undefined
      ? { first: firstName === null ? '' : firstName, last: lastName === null ? '' : lastName }
      : undefined,
    emails: email === undefined ? undefined : { items: emailItems(contact, email) },
    phones: phone === undefined ? undefined : { items: phoneItems(contact, phone) },
    company: company === null ? '' : company,
    jobTitle: jobTitle === null ? '' : jobTitle,
  }
}

export async function createContact(input: z.infer<typeof createInput>) {
  const body = { info: contactInfo(input), allowDuplicates: false }
  const { contact } = await wixRequest(collection, 'POST', body, singleResponse)
  return dashboardContact(contact)
}

export async function updateContact(id: string, input: z.infer<typeof updateInput>) {
  const current = await mutationTarget(id)
  if (current.revision !== input.revision) throw new WixError('REVISION_CONFLICT')
  if (current.memberInfo?.memberId && input.email !== undefined) throw new WixError('MEMBER_EMAIL_RESTRICTED')
  const body = { info: contactInfo(input, current), revision: input.revision, allowDuplicates: false }
  const updated = singleResponse.refine(({ contact }) => contact.id === id && contact.revision > input.revision)
  const { contact } = await wixRequest(`${collection}/${id}`, 'PATCH', body, updated)
  return dashboardContact(contact)
}

export async function deleteContact(id: string) {
  const current = await mutationTarget(id)
  if (current.memberInfo?.memberId) throw new WixError('PROTECTED_CONTACT')
  await wixRequest(`${collection}/${id}`, 'DELETE', undefined, z.strictObject({}).optional())
}

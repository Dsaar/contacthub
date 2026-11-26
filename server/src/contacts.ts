import { z } from 'zod'
import { contactId, type ContactChanges, type createInput, type updateInput } from './contact-input.ts'
import { WixError, wixRequest } from './wix.ts'

const text = z.string().optional()
const timestamp = z.iso.datetime({ offset: true }).optional()
const integer = z.int().nonnegative()

const wixContact = z.object({
  id: z.string().min(1),
  revision: integer.optional(),
  createdDate: timestamp,
  updatedDate: timestamp,
  primaryInfo: z.object({ email: text, phone: text }).optional(),
  info: z.object({
    name: z.object({ first: text, last: text }).optional(),
    emails: z.object({
      items: z.array(z.object({ email: text, tag: text, primary: z.boolean().optional() })).optional(),
    }).optional(),
    phones: z.object({
      items: z.array(z.object({ phone: text, tag: text, countryCode: text, primary: z.boolean().optional() })).optional(),
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

function dashboardContact(contact: z.infer<typeof wixContact>) {
  const { info, primaryInfo } = contact
  const emails = info?.emails?.items ?? []
  const phones = info?.phones?.items ?? []
  return {
    id: contact.id,
    revision: contact.revision ?? null,
    firstName: info?.name?.first ?? null,
    lastName: info?.name?.last ?? null,
    primaryEmail: primaryInfo?.email ?? emails.find(item => item.primary && item.email)?.email ?? null,
    primaryPhone: primaryInfo?.phone ?? phones.find(item => item.primary && item.phone)?.phone ?? null,
    emails: emails.flatMap(item => item.email ? [item.email] : []),
    phones: phones.flatMap(item => item.phone ? [item.phone] : []),
    company: info?.company ?? null,
    jobTitle: info?.jobTitle ?? null,
    createdDate: contact.createdDate ?? null,
    updatedDate: contact.updatedDate ?? null,
    isSiteMember: Boolean(contact.memberInfo?.memberId),
  }
}

export async function queryContacts(paging: { limit: number, offset: number }) {
  const { contacts, pagingMetadata } = await wixRequest(
    '/contacts/v4/contacts/query', 'POST', { query: { paging } }, queryResponse,
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

const singleContact = wixContact.extend({ id: contactId, revision: z.int32().nonnegative() })
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

// PATCH replaces the supplied list. Select the primary by flag or the Wix summary
// and round-trip only documented writable fields, including secondary tags and country codes.
function primaryItems<T extends { primary?: boolean }>(
  items: T[], field: 'email' | 'phone', summary: string | undefined, value: string | null,
  readValue: (item: T) => string | undefined,
) {
  const flagged = items.filter(item => item.primary)
  const matches = summary ? items.filter(item => readValue(item) === summary) : []
  if (flagged.length > 1 || (summary && (matches.length !== 1 || (flagged[0] && flagged[0] !== matches[0]))) ||
      items.some(item => !readValue(item))) throw new WixError('AMBIGUOUS_PRIMARY')
  const primary = flagged[0] ?? matches[0]
  if (value && items.some(item => item !== primary && readValue(item) === value)) {
    throw new WixError('AMBIGUOUS_PRIMARY')
  }
  if (value === null) return items.filter(item => item !== primary)
  if (!primary) return [...items, { [field]: value, primary: true }]
  return items.map(item => item === primary ? { ...item, [field]: value, primary: true } : item)
}

function contactInfo(changes: ContactChanges, contact?: Contact) {
  const { firstName, lastName, email, phone, company, jobTitle } = changes
  return {
    name: firstName !== undefined || lastName !== undefined
      ? { first: firstName === null ? '' : firstName, last: lastName === null ? '' : lastName }
      : undefined,
    emails: email === undefined ? undefined : { items: primaryItems(
      contact?.info?.emails?.items ?? [], 'email', contact?.primaryInfo?.email, email, item => item.email,
    ) },
    phones: phone === undefined ? undefined : { items: primaryItems(
      contact?.info?.phones?.items ?? [], 'phone', contact?.primaryInfo?.phone, phone, item => item.phone,
    ) },
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

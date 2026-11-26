import { z } from 'zod'
import { wixRequest } from './wix.ts'

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
      items: z.array(z.object({ email: text, primary: z.boolean().optional() })).optional(),
    }).optional(),
    phones: z.object({
      items: z.array(z.object({ phone: text, primary: z.boolean().optional() })).optional(),
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

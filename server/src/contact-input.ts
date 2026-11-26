import { z } from 'zod'

export const contactId = z.guid().transform(value => value.toLowerCase())
const label = z.string().trim().min(1).max(1000)
const email = z.string().trim().max(320).pipe(z.email())
// Accept local and international numbers, common separators, and an optional extension.
const phone = z.string().trim().max(50).regex(/^\+?(?=[\d(). -]*\d)[\d(). -]+(?:\s*(?:ext\.?|x|#)\s*\d+)?$/i)

export const createInput = z.strictObject({
  firstName: label.optional(),
  lastName: label.optional(),
  email: email.optional(),
  phone: phone.optional(),
  company: label.optional(),
  jobTitle: label.optional(),
}).refine(value => Boolean(value.firstName || value.lastName || value.email || value.phone),
  'Provide a name, email, or phone.')

export const updateInput = z.strictObject({
  revision: z.int32().nonnegative(),
  firstName: label.nullable().optional(),
  lastName: label.nullable().optional(),
  email: email.nullable().optional(),
  phone: phone.nullable().optional(),
  company: label.nullable().optional(),
  jobTitle: label.nullable().optional(),
}).refine(value => Object.keys(value).length > 1, 'Supply at least one contact field.')

export type ContactChanges = Omit<z.infer<typeof updateInput>, 'revision'>

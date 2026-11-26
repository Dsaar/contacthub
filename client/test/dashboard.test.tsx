import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../src/App'
import { api, ApiError } from '../src/api'
import type { Contact, Page } from '../src/types'

const person: Contact = {
  id: 'fictional-1',
  revision: 3,
  firstName: 'Alex',
  lastName: 'Example',
  primaryEmail: 'alex@example.invalid',
  primaryPhone: '202-555-0123',
  phones: ['202-555-0123', '555-0102'],
  emails: ['alex@example.invalid', 'work@example.invalid'],
  phoneDetails: [{ phone: '202-555-0123', countryCode: 'US', e164Phone: '+12025550123' }],
  company: 'Example Co',
  jobTitle: 'Designer',
  isSiteMember: false,
  createdDate: null,
  updatedDate: null,
}
function page(contacts = [person], metadata: Partial<Page['pagingMetadata']> = {}): Page {
  return {
    contacts,
    pagingMetadata: {
      count: contacts.length,
      limit: 10,
      offset: 0,
      total: contacts.length,
      hasNext: false,
      tooManyToCount: false,
      ...metadata,
    },
  }
}
const list = vi.spyOn(api, 'list')
const get = vi.spyOn(api, 'get')
const create = vi.spyOn(api, 'create')
const update = vi.spyOn(api, 'update')
const remove = vi.spyOn(api, 'remove')
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Unexpected unmocked request')
    }),
  )
  list.mockReset().mockResolvedValue(page())
  get.mockReset().mockResolvedValue({ contact: person })
  create.mockReset().mockResolvedValue({ contact: person })
  update.mockReset().mockResolvedValue({ contact: { ...person, revision: 4 } })
  remove.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())
function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
async function start() {
  render(<App />)
  await screen.findByText('Connected')
}
async function edit() {
  await start()
  click('Edit Alex Example')
  await screen.findByDisplayValue('Alex')
}

it('renders real API fields and fetches details with secondary communication values', async () => {
  await start()
  for (const text of ['Alex Example', 'alex@example.invalid', 'Example Co', 'Designer', '+12025550123'])
    expect(screen.getByText(text)).toBeTruthy()
  click('View details for Alex Example')
  await screen.findByText('work@example.invalid')
  expect(screen.getByText(/555-0102/)).toBeTruthy()
  expect(get).toHaveBeenCalledWith(person.id, expect.any(AbortSignal))
})
it('handles missing names, emails and phones', async () => {
  list.mockResolvedValue(
    page([
      {
        ...person,
        firstName: null,
        lastName: null,
        primaryEmail: null,
        primaryPhone: null,
        company: null,
        jobTitle: null,
      },
    ]),
  )
  await start()
  expect(screen.getByText('Unnamed contact')).toBeTruthy()
})
it('distinguishes pending, connected and empty states', async () => {
  let complete!: (page: Page) => void
  list.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  render(<App />)
  expect(screen.getByText('Loading contacts…')).toBeTruthy()
  await act(async () => complete(page([])))
  expect(screen.getByText('No contacts yet')).toBeTruthy()
  expect(screen.getByText('Connected')).toBeTruthy()
})
it.each([
  ['WIX_CONFIG', 'Disconnected'],
  ['WIX_FORBIDDEN', 'Failed'],
  ['WIX_RATE_LIMIT', 'Failed'],
  ['WIX_TIMEOUT', 'Failed'],
])('shows %s with status, diagnostics, and manual refresh', async (code, status) => {
  list.mockRejectedValueOnce(new ApiError(code, 'Example actionable error.', 'safe-test-id', 403))
  render(<App />)
  await screen.findByText(status!)
  expect(screen.getByRole('alert').textContent).toContain('safe-test-id')
  click('Refresh')
  await screen.findByText('Connected')
})
it('uses server paging and resets offset for a new page size', async () => {
  list.mockResolvedValue(page([person], { total: null, hasNext: true, tooManyToCount: true }))
  await start()
  expect(screen.getByText('Exact total unavailable')).toBeTruthy()
  click('Next page')
  await waitFor(() =>
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 10 }), expect.anything()),
  )
  fill('Rows per page', '25')
  await waitFor(() =>
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 0, limit: 25 }),
      expect.anything(),
    ),
  )
})
it('debounces a server-wide field search and resets page position', async () => {
  list.mockImplementation(async (query) =>
    query.q ? page([]) : page([person], { hasNext: true, total: 20 }),
  )
  await start()
  click('Next page')
  await waitFor(() => expect(list.mock.lastCall?.[0].offset).toBe(10))
  fill('Search field', 'company')
  fill('Search contacts', 'E')
  fill('Search contacts', 'Example')
  expect(list.mock.calls.some(([q]) => q.q)).toBe(false)
  await screen.findByText('No matching contacts')
  expect(list.mock.calls.filter(([q]) => q.q).map(([q]) => q)).toEqual([
    { q: 'Example', field: 'company', offset: 0, limit: 10 },
  ])
  click('Clear search')
  await screen.findByText('Alex Example')
})
it('ignores a slow earlier page after the next response arrives', async () => {
  let complete!: (p: Page) => void
  list.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  render(<App />)
  fill('Rows per page', '50')
  await screen.findByText('Alex Example')
  await act(async () => complete(page([])))
  expect(screen.getByText('Alex Example')).toBeTruthy()
  expect(screen.queryByText('No contacts yet')).toBeNull()
})
it('validates fields and creates a sparse contact only once', async () => {
  let complete!: (value: { contact: Contact }) => void
  create.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  await start()
  click('Add contact')
  click('Create contact')
  expect(screen.getByRole('alert').textContent).toContain('Enter a first name')
  fill('Email', 'not-email')
  click('Create contact')
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
  fill('Email', '')
  fill('First name', '李')
  click('Create contact')
  expect(create).toHaveBeenCalledWith({ firstName: '李' })
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Working…' }).disabled).toBe(true)
  await act(async () => complete({ contact: person }))
  expect(await screen.findByText('Contact created.')).toBeTruthy()
  expect(create).toHaveBeenCalledTimes(1)
  expect(list).toHaveBeenCalledTimes(2)
})
it('keeps create form open on duplicate and exposes a safe diagnostic', async () => {
  create.mockRejectedValue(
    new ApiError('DUPLICATE_CONTACT', 'A contact with this email or phone already exists.', 'safe-dup'),
  )
  await start()
  click('Add contact')
  fill('Email', 'one@example.invalid')
  click('Create contact')
  await screen.findByText('A contact with this email or phone already exists.')
  expect(screen.getByDisplayValue('one@example.invalid')).toBeTruthy()
  expect(screen.getByText(/safe-dup/)).toBeTruthy()
  expect(list).toHaveBeenCalledTimes(1)
})
it('loads latest revision and patches only actual edits, including an explicit clear', async () => {
  get.mockResolvedValue({ contact: { ...person, revision: 8 } })
  await edit()
  expect(screen.getByDisplayValue('+12025550123')).toBeTruthy()
  fill('Last name', 'Changed')
  fill('Company', '')
  click('Save changes')
  await screen.findByText('Contact updated.')
  expect(update).toHaveBeenCalledWith(person.id, { revision: 8, lastName: 'Changed', company: null })
})
it('preserves edits on conflict and requires explicit review of newer values', async () => {
  update.mockRejectedValueOnce(
    new ApiError('REVISION_CONFLICT', 'The contact changed. Refresh before retrying.'),
  )
  get
    .mockResolvedValueOnce({ contact: person })
    .mockResolvedValueOnce({
      contact: { ...person, revision: 9, firstName: 'Elsewhere', company: 'Another Co' },
    })
  await edit()
  fill('First name', 'My edit')
  click('Save changes')
  await screen.findByText('Load latest version')
  expect(screen.getByDisplayValue('My edit')).toBeTruthy()
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' }).disabled).toBe(true)
  click('Load latest version')
  await screen.findByText('Latest in Wix: Elsewhere')
  expect(screen.getByDisplayValue('Another Co')).toBeTruthy()
  expect(update).toHaveBeenCalledTimes(1)
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  click('Save changes')
  await screen.findByText('Contact updated.')
  expect(update).toHaveBeenLastCalledWith(person.id, { revision: 9, firstName: 'My edit' })
})
it('protects member email and deletion', async () => {
  const member = { ...person, isSiteMember: true }
  list.mockResolvedValue(page([member]))
  get.mockResolvedValue({ contact: member })
  await edit()
  expect(screen.queryByRole('button', { name: /Delete Alex/ })).toBeNull()
  expect(screen.getByLabelText<HTMLInputElement>('Email').disabled).toBe(true)
  fill('Company', 'New Co')
  click('Save changes')
  await screen.findByText('Contact updated.')
  expect(update).toHaveBeenCalledWith(person.id, { revision: 3, company: 'New Co' })
})
it('explains a missing contact and refuses an edit to a merged target', async () => {
  get
    .mockRejectedValueOnce(new ApiError('WIX_NOT_FOUND', 'Upstream error'))
    .mockResolvedValueOnce({ contact: { ...person, id: 'merged-target' } })
  await start()
  click('Edit Alex Example')
  await screen.findByText(/no longer exists/)
  click('Cancel')
  click('Edit Alex Example')
  await screen.findByText(/was merged/)
  expect(update).not.toHaveBeenCalled()
})
it('requires delete confirmation and retains the row on failure', async () => {
  remove.mockRejectedValue(new ApiError('PROTECTED_CONTACT', 'Wix protects this contact.'))
  await start()
  click('Delete Alex Example')
  expect(within(screen.getByRole('dialog')).getByText('Alex Example')).toBeTruthy()
  click('Cancel')
  expect(remove).not.toHaveBeenCalled()
  click('Delete Alex Example')
  click('Delete contact')
  await screen.findByText('Wix protects this contact.')
  click('Cancel')
  expect(screen.getByText('Alex Example')).toBeTruthy()
  expect(list).toHaveBeenCalledTimes(1)
})
it('returns to a valid page after deleting its last row', async () => {
  list.mockImplementation(async (q) =>
    q.offset === 10
      ? remove.mock.calls.length
        ? page([], { total: 10, offset: 10 })
        : page([person], { offset: 10, total: 11 })
      : page([{ ...person, firstName: 'First' }], { total: 11, hasNext: true }),
  )
  await start()
  click('Next page')
  await screen.findByText('Alex Example')
  click('Delete Alex Example')
  click('Delete contact')
  await screen.findByText('Contact deleted.')
  await screen.findByText('First Example')
  expect(list.mock.lastCall?.[0].offset).toBe(0)
  expect(remove).toHaveBeenCalledTimes(1)
})

it('stops probing beyond the last full page when Wix cannot count it', async () => {
  list.mockImplementation(async (q) =>
    q.offset
      ? page([], { count: 0, offset: q.offset, total: null, hasNext: null, tooManyToCount: true })
      : page(
          Array.from({ length: 10 }, (_, i) => ({ ...person, id: 'fictional-' + i })),
          { count: 10, total: null, hasNext: null, tooManyToCount: true },
        ),
  )
  await start()
  click('Next page')
  await waitFor(() => expect(list).toHaveBeenCalledTimes(3))
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Next page' }).disabled).toBe(true)
})

it('retains a proposed email for review when a conflicted contact becomes protected', async () => {
  update.mockRejectedValueOnce(new ApiError('REVISION_CONFLICT', 'Refresh before retrying.'))
  get
    .mockResolvedValueOnce({ contact: person })
    .mockResolvedValueOnce({ contact: { ...person, isSiteMember: true, revision: 4 } })
  await edit()
  fill('Email', 'proposed@example.invalid')
  fill('Company', 'My company')
  click('Save changes')
  await screen.findByText('Load latest version')
  click('Load latest version')
  await screen.findByText(/proposed email edit.*proposed@example.invalid/)
  expect(screen.getByLabelText<HTMLInputElement>('Email').disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  click('Save changes')
  await screen.findByText('Contact updated.')
  expect(update).toHaveBeenLastCalledWith(person.id, { revision: 4, company: 'My company' })
})

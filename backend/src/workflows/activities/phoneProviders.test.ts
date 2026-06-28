import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findPhoneOrion, findPhoneAstra, findPhoneNimbus } from './phoneProviders'
import type { PhoneProviderInput } from './phoneProviders'

const input: PhoneProviderInput = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  jobTitle: 'CTO',
  companyWebsite: 'example.com',
}

function mockFetch(body: object, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('findPhoneOrion', () => {
  it('returns phone string when provider responds with phone', async () => {
    vi.stubGlobal('fetch', mockFetch({ phone: '+15551234567' }))
    expect(await findPhoneOrion(input)).toBe('+15551234567')
  })

  it('returns null when provider responds with phone: null', async () => {
    vi.stubGlobal('fetch', mockFetch({ phone: null }))
    expect(await findPhoneOrion(input)).toBeNull()
  })

  it('returns null when phone field is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    expect(await findPhoneOrion(input)).toBeNull()
  })

  it('throws when provider returns non-ok status', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 503))
    await expect(findPhoneOrion(input)).rejects.toThrow('503')
  })

  it('sends correct auth header and request body', async () => {
    const spy = mockFetch({ phone: null })
    vi.stubGlobal('fetch', spy)

    await findPhoneOrion(input)

    const [, init] = spy.mock.calls[0]
    expect(init.headers['x-auth-me']).toBeDefined()
    const body = JSON.parse(init.body)
    expect(body).toHaveProperty('fullName', 'Ada Lovelace')
    expect(body).toHaveProperty('companyWebsite', 'example.com')
  })
})

describe('findPhoneAstra', () => {
  it('returns phoneNmbr string when defined', async () => {
    vi.stubGlobal('fetch', mockFetch({ phoneNmbr: '+44987654321' }))
    expect(await findPhoneAstra(input)).toBe('+44987654321')
  })

  it('returns null when phoneNmbr is undefined', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    expect(await findPhoneAstra(input)).toBeNull()
  })

  it('returns null when phoneNmbr is null', async () => {
    vi.stubGlobal('fetch', mockFetch({ phoneNmbr: null }))
    expect(await findPhoneAstra(input)).toBeNull()
  })

  it('throws when provider returns non-ok status', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 429))
    await expect(findPhoneAstra(input)).rejects.toThrow('429')
  })

  it('sends email in body and apiKey header', async () => {
    const spy = mockFetch({ phoneNmbr: null })
    vi.stubGlobal('fetch', spy)

    await findPhoneAstra(input)

    const [, init] = spy.mock.calls[0]
    expect(init.headers['apiKey']).toBeDefined()
    const body = JSON.parse(init.body)
    expect(body).toHaveProperty('email', 'ada@example.com')
  })
})

describe('findPhoneNimbus', () => {
  it('concatenates countryCode + number when both present', async () => {
    vi.stubGlobal('fetch', mockFetch({ number: 5551234567, countryCode: '+1' }))
    expect(await findPhoneNimbus(input)).toBe('+15551234567')
  })

  it('returns null when number is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({ countryCode: '+1' }))
    expect(await findPhoneNimbus(input)).toBeNull()
  })

  it('returns null when countryCode is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({ number: 5551234567 }))
    expect(await findPhoneNimbus(input)).toBeNull()
  })

  it('throws when provider returns non-ok status', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false, 401))
    await expect(findPhoneNimbus(input)).rejects.toThrow('401')
  })

  it('sends api key as query param and email + jobTitle in body', async () => {
    const spy = mockFetch({ number: 1234, countryCode: '+44' })
    vi.stubGlobal('fetch', spy)

    await findPhoneNimbus(input)

    const [url, init] = spy.mock.calls[0]
    expect(url).toContain('?api=')
    const body = JSON.parse(init.body)
    expect(body).toHaveProperty('email', 'ada@example.com')
    expect(body).toHaveProperty('jobTitle', 'CTO')
  })
})

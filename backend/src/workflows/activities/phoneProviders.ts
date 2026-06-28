export type PhoneProviderInput = {
  fullName: string
  email: string
  jobTitle: string | null
  companyWebsite: string | null
}

// Each provider normalizes its response to string | null
type PhoneProviderFn = (input: PhoneProviderInput) => Promise<string | null>

const orionFn: PhoneProviderFn = async (input) => {
  const url = process.env.ORION_CONNECT_BASE_URL || 'https://api.enginy.ai/api/tmp/orionConnect'
  const key = process.env.ORION_CONNECT_API_KEY || ''

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-auth-me': key },
    body: JSON.stringify({ fullName: input.fullName, companyWebsite: input.companyWebsite }),
  })

  if (!res.ok) throw new Error(`Orion Connect responded ${res.status}`)
  const data = (await res.json()) as { phone?: string | null }
  return data.phone ?? null
}

const astraFn: PhoneProviderFn = async (input) => {
  const url = process.env.ASTRA_DIALER_BASE_URL || 'https://api.enginy.ai/api/tmp/astraDialer'
  const key = process.env.ASTRA_DIALER_API_KEY || ''

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apiKey: key },
    body: JSON.stringify({ email: input.email }),
  })

  if (!res.ok) throw new Error(`Astra Dialer responded ${res.status}`)
  const data = (await res.json()) as { phoneNmbr?: string | null }
  return data.phoneNmbr ?? null
}

const nimbusFn: PhoneProviderFn = async (input) => {
  const base = process.env.NIMBUS_LOOKUP_BASE_URL || 'https://api.enginy.ai/api/tmp/numbusLookup'
  const key = process.env.NIMBUS_LOOKUP_API_KEY || ''
  const url = `${base}?api=${encodeURIComponent(key)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: input.email, jobTitle: input.jobTitle }),
  })

  if (!res.ok) throw new Error(`Nimbus Lookup responded ${res.status}`)
  const data = (await res.json()) as { number?: number | null; countryCode?: string | null }
  if (!data.number || !data.countryCode) return null
  return `${data.countryCode}${data.number}`
}

// Temporal activity wrappers — each is a separate activity so timeouts/retries can differ
export async function findPhoneOrion(input: PhoneProviderInput): Promise<string | null> {
  return orionFn(input)
}

export async function findPhoneAstra(input: PhoneProviderInput): Promise<string | null> {
  return astraFn(input)
}

export async function findPhoneNimbus(input: PhoneProviderInput): Promise<string | null> {
  return nimbusFn(input)
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { enrichPhoneNumbers } from './enrichPhoneNumber'

const mockHandle = {
  result: vi.fn(),
}

const mockWorkflowStart = vi.fn()

const mockClient = {
  workflow: {
    start: mockWorkflowStart,
  },
} as any

const mockUpdate = vi.fn()
const mockPrisma = {
  lead: {
    update: mockUpdate,
  },
} as any

const makeLead = (id: number, overrides: Partial<ReturnType<typeof makeLead>> = {}) => ({
  id,
  firstName: 'Test',
  lastName: 'User',
  email: `test${id}@example.com`,
  jobTitle: null,
  companyName: null,
  phoneNumber: null,
  ...overrides,
})

const TIMEOUT_MS = 50

// Collects SSE data events from the mock response
function makeMockRes() {
  const events: object[] = []
  return {
    write: vi.fn((chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data: ')) {
          events.push(JSON.parse(line.slice(6)))
        }
      }
    }),
    end: vi.fn(),
    events,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWorkflowStart.mockResolvedValue(mockHandle)
  mockUpdate.mockResolvedValue({})
})

describe('enrichPhoneNumbers', () => {
  it('updates phoneNumber and counts foundCount when workflow returns phone', async () => {
    mockHandle.result.mockResolvedValue('+15551234567')

    const res = makeMockRes()
    await enrichPhoneNumbers(mockPrisma, mockClient, [makeLead(1)], res as any, TIMEOUT_MS)

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { phoneNumber: '+15551234567' } })
    const done = res.events.find((e: any) => e.done)
    expect(done).toMatchObject({ done: true, foundCount: 1, errorCount: 0 })
  })

  it('does not update DB and foundCount=0 when all providers return null', async () => {
    mockHandle.result.mockResolvedValue(null)

    const res = makeMockRes()
    await enrichPhoneNumbers(mockPrisma, mockClient, [makeLead(2)], res as any, TIMEOUT_MS)

    expect(mockUpdate).not.toHaveBeenCalled()
    const done = res.events.find((e: any) => e.done)
    expect(done).toMatchObject({ done: true, foundCount: 0, errorCount: 0 })
  })

  it('treats workflow timeout as error — no DB update, errorCount incremented', async () => {
    mockHandle.result.mockImplementation(() => new Promise(() => {}))

    const res = makeMockRes()
    await enrichPhoneNumbers(mockPrisma, mockClient, [makeLead(3)], res as any, TIMEOUT_MS)

    expect(mockUpdate).not.toHaveBeenCalled()
    const done = res.events.find((e: any) => e.done)
    expect(done).toMatchObject({ done: true, foundCount: 0, errorCount: 1 })
  })

  it('treats workflow.start rejection as error — does not throw, errorCount incremented', async () => {
    mockWorkflowStart.mockRejectedValue(new Error('Temporal connection refused'))

    const res = makeMockRes()
    await enrichPhoneNumbers(mockPrisma, mockClient, [makeLead(4)], res as any, TIMEOUT_MS)

    expect(mockUpdate).not.toHaveBeenCalled()
    const done = res.events.find((e: any) => e.done)
    expect(done).toMatchObject({ done: true, foundCount: 0, errorCount: 1 })
  })

  it('uses stable workflow ID — enrich-phone-{leadId} for idempotency', async () => {
    mockHandle.result.mockResolvedValue(null)

    const res = makeMockRes()
    await enrichPhoneNumbers(mockPrisma, mockClient, [makeLead(42)], res as any, TIMEOUT_MS)

    expect(mockWorkflowStart).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workflowId: 'enrich-phone-42' })
    )
  })

  it('starts all workflows in parallel before any resolves', async () => {
    const startOrder: number[] = []
    let resolvers: Array<(v: string | null) => void> = []

    mockWorkflowStart.mockImplementation(async (_wf, opts) => {
      const id = Number(opts.workflowId.split('-')[2])
      startOrder.push(id)
      return {
        result: () => new Promise<string | null>((resolve) => { resolvers.push(resolve) }),
      }
    })

    const leads = [makeLead(1), makeLead(2), makeLead(3)]
    const res = makeMockRes()
    const enrichPromise = enrichPhoneNumbers(mockPrisma, mockClient, leads, res as any, TIMEOUT_MS)

    // Let microtasks run so all starts are called
    await new Promise((r) => setTimeout(r, 10))
    expect(mockWorkflowStart).toHaveBeenCalledTimes(3)

    resolvers.forEach((r) => r(null))
    await enrichPromise
  })

  it('emits progress SSE events incrementally', async () => {
    mockHandle.result.mockResolvedValue(null)

    const res = makeMockRes()
    const leads = [makeLead(1), makeLead(2)]
    await enrichPhoneNumbers(mockPrisma, mockClient, leads, res as any, TIMEOUT_MS)

    const progressEvents = res.events.filter((e: any) => !e.done)
    // initial event + one per lead
    expect(progressEvents.length).toBeGreaterThanOrEqual(2)
    const doneEvent = res.events.find((e: any) => e.done)
    expect(doneEvent).toBeDefined()
    expect(res.end).toHaveBeenCalled()
  })

  it('skips workflow for leads that already have a phoneNumber', async () => {
    const res = makeMockRes()
    const leadWithPhone = makeLead(99, { phoneNumber: '+1existingphone' })
    await enrichPhoneNumbers(mockPrisma, mockClient, [leadWithPhone], res as any, TIMEOUT_MS)

    expect(mockWorkflowStart).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
    const done = res.events.find((e: any) => e.done)
    expect(done).toMatchObject({ done: true, foundCount: 0, errorCount: 0 })
  })

  it('handles mixed results: one phone found, one null', async () => {
    mockWorkflowStart
      .mockResolvedValueOnce({ result: vi.fn().mockResolvedValue('+1111111111') })
      .mockResolvedValueOnce({ result: vi.fn().mockResolvedValue(null) })

    const res = makeMockRes()
    await enrichPhoneNumbers(mockPrisma, mockClient, [makeLead(10), makeLead(11)], res as any, TIMEOUT_MS)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 10 }, data: { phoneNumber: '+1111111111' } })
    const done = res.events.find((e: any) => e.done)
    expect(done).toMatchObject({ done: true, foundCount: 1, errorCount: 0 })
  })
})

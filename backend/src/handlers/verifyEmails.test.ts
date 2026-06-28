import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyEmailsForLeads } from './verifyEmails'

const mockHandle = {
  result: vi.fn(),
  terminate: vi.fn(),
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

const makeLead = (id: number, email: string) => ({
  id,
  firstName: 'Test',
  lastName: 'User',
  email,
})

const TIMEOUT_MS = 50

beforeEach(() => {
  vi.clearAllMocks()
  mockWorkflowStart.mockResolvedValue(mockHandle)
  mockHandle.terminate.mockResolvedValue(undefined)
  mockUpdate.mockResolvedValue({})
})

describe('verifyEmailsForLeads', () => {
  it('marks emailVerified=true when workflow returns true', async () => {
    mockHandle.result.mockResolvedValue(true)

    const result = await verifyEmailsForLeads(mockPrisma, mockClient, [makeLead(1, 'good@example.com')], TIMEOUT_MS)

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { emailVerified: true } })
    expect(result.results[0]).toEqual({ leadId: 1, emailVerified: true })
    expect(result.verifiedCount).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('marks emailVerified=false when workflow returns false (e.g. john.doe email)', async () => {
    mockHandle.result.mockResolvedValue(false)

    const result = await verifyEmailsForLeads(mockPrisma, mockClient, [makeLead(2, 'john.doe@example.com')], TIMEOUT_MS)

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 2 }, data: { emailVerified: false } })
    expect(result.results[0]).toEqual({ leadId: 2, emailVerified: false })
    expect(result.verifiedCount).toBe(1)
  })

  it('terminates workflow and marks emailVerified=false on timeout (e.g. jane.smith email)', async () => {
    mockHandle.result.mockImplementation(() => new Promise(() => {}))

    const result = await verifyEmailsForLeads(mockPrisma, mockClient, [makeLead(3, 'jane.smith@example.com')], TIMEOUT_MS)

    expect(mockHandle.terminate).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 3 }, data: { emailVerified: false } })
    expect(result.results[0]).toEqual({ leadId: 3, emailVerified: false })
  })

  it('counts timed-out lead as verified (set to false) not as an error', async () => {
    mockHandle.result.mockImplementation(() => new Promise(() => {}))

    const result = await verifyEmailsForLeads(mockPrisma, mockClient, [makeLead(4, 'jane.smith@test.com')], TIMEOUT_MS)

    expect(result.verifiedCount).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(result.results[0].emailVerified).toBe(false)
  })

  it('records error when workflow.start rejects', async () => {
    mockWorkflowStart.mockRejectedValue(new Error('Temporal connection refused'))

    const result = await verifyEmailsForLeads(mockPrisma, mockClient, [makeLead(5, 'error@example.com')], TIMEOUT_MS)

    expect(result.verifiedCount).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].leadId).toBe(5)
    expect(result.errors[0].error).toContain('Temporal connection refused')
  })

  it('runs all leads in parallel — workflow.start called for all before any resolves', async () => {
    const startOrder: number[] = []

    mockWorkflowStart.mockImplementation(async (_wf, opts) => {
      const id = Number(opts.args[0].split('@')[0])
      startOrder.push(id)
      return {
        result: () => Promise.resolve(true),
        terminate: vi.fn(),
      }
    })

    const leads = [makeLead(1, '1@test.com'), makeLead(2, '2@test.com'), makeLead(3, '3@test.com')]

    await verifyEmailsForLeads(mockPrisma, mockClient, leads, TIMEOUT_MS)

    expect(mockWorkflowStart).toHaveBeenCalledTimes(3)
  })

  it('handles mixed results: one success and one timeout', async () => {
    const handles = {
      good: { result: vi.fn().mockResolvedValue(true), terminate: vi.fn() },
      slow: { result: vi.fn().mockImplementation(() => new Promise(() => {})), terminate: vi.fn() },
    }

    mockWorkflowStart
      .mockResolvedValueOnce(handles.good)
      .mockResolvedValueOnce(handles.slow)

    const leads = [makeLead(10, 'good@example.com'), makeLead(11, 'jane.smith@example.com')]

    const result = await verifyEmailsForLeads(mockPrisma, mockClient, leads, TIMEOUT_MS)

    expect(result.verifiedCount).toBe(2)
    expect(result.errors).toHaveLength(0)

    const r10 = result.results.find((r) => r.leadId === 10)
    const r11 = result.results.find((r) => r.leadId === 11)
    expect(r10?.emailVerified).toBe(true)
    expect(r11?.emailVerified).toBe(false)

    expect(handles.slow.terminate).toHaveBeenCalled()
  })
})

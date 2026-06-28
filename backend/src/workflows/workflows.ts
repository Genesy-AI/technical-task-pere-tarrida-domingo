import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'
import type { PhoneProviderInput } from './activities/phoneProviders'

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 second',
})

// Each provider gets its own proxy so timeouts and retry policies can differ independently.
// When providers add rate limits, configure maxConcurrentActivities on the worker per task queue.
const retryPolicy = { maximumAttempts: 3, backoffCoefficient: 2, initialInterval: '1s' } as const

const { findPhoneOrion } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: retryPolicy,
})

const { findPhoneAstra } = proxyActivities<typeof activities>({
  startToCloseTimeout: '3 seconds',
  retry: retryPolicy,
})

const { findPhoneNimbus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 seconds',
  retry: retryPolicy,
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}

export async function findPhoneNumberWorkflow(input: PhoneProviderInput): Promise<string | null> {
  for (const findPhone of [findPhoneOrion, findPhoneAstra, findPhoneNimbus]) {
    const phone = await findPhone(input)
    if (phone) return phone
  }
  return null
}

import type { PrismaClient } from '@prisma/client'
import type { Client } from '@temporalio/client'
import { verifyEmailWorkflow } from '../workflows'

type Lead = {
  id: number
  firstName: string
  lastName: string
  email: string
}

type VerifyResult = {
  leadId: number
  emailVerified: boolean
}

type VerifyError = {
  leadId: number
  leadName: string
  error: string
}

export type VerifyEmailsResult = {
  success: true
  verifiedCount: number
  results: VerifyResult[]
  errors: VerifyError[]
}

export async function verifyEmailsForLeads(
  prisma: PrismaClient,
  client: Client,
  leads: Lead[],
  timeoutMs = 5000
): Promise<VerifyEmailsResult> {
  const settled = await Promise.allSettled(
    leads.map(async (lead) => {
      const workflowId = `verify-email-${lead.id}-${crypto.randomUUID()}`

      const handle = await client.workflow.start(verifyEmailWorkflow, {
        taskQueue: 'myQueue',
        workflowId,
        args: [lead.email],
      })

      let isVerified = false
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Verification timed out after ${timeoutMs}ms`)), timeoutMs)
        )
        isVerified = await Promise.race([handle.result(), timeout])
      } catch {
        try {
          await handle.terminate('Timed out or errored — marked as unverified')
        } catch {
          // workflow may have already completed or been terminated
        }
        isVerified = false
      }

      await prisma.lead.update({
        where: { id: lead.id },
        data: { emailVerified: isVerified },
      })

      return { leadId: lead.id, emailVerified: isVerified }
    })
  )

  const results: VerifyResult[] = []
  const errors: VerifyError[] = []

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i]
    const lead = leads[i]

    if (outcome.status === 'fulfilled') {
      results.push(outcome.value)
    } else {
      errors.push({
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`.trim(),
        error: outcome.reason instanceof Error ? outcome.reason.message : 'Unknown error',
      })
    }
  }

  return {
    success: true,
    verifiedCount: results.length,
    results,
    errors,
  }
}

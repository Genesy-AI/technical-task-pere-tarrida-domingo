import type { PrismaClient } from '@prisma/client'
import type { Client } from '@temporalio/client'
import type { Response } from 'express'
import { findPhoneNumberWorkflow } from '../workflows'
import type { PhoneProviderInput } from '../workflows/activities/phoneProviders'

type Lead = {
  id: number
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
  companyName: string | null
  phoneNumber: string | null
}

function toProviderInput(lead: Lead): PhoneProviderInput {
  return {
    fullName: `${lead.firstName} ${lead.lastName}`.trim(),
    email: lead.email,
    jobTitle: lead.jobTitle,
    // companyName is used as best-effort companyWebsite; no website field in schema
    companyWebsite: lead.companyName,
  }
}

function sseEvent(res: Response, data: object): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export async function enrichPhoneNumbers(
  prisma: PrismaClient,
  client: Client,
  leads: Lead[],
  res: Response,
  timeoutMs = 30_000
): Promise<void> {
  const total = leads.length
  let foundCount = 0
  let errorCount = 0
  let completed = 0

  sseEvent(res, { completed: 0, total })

  await Promise.allSettled(
    leads.map(async (lead) => {
      if (lead.phoneNumber) {
        completed++
        sseEvent(res, { completed, total })
        return
      }

      // Stable workflow ID — idempotent: only one enrichment per lead at a time
      const workflowId = `enrich-phone-${lead.id}`

      let phone: string | null = null
      let errored = false
      try {
        const handle = await client.workflow.start(findPhoneNumberWorkflow, {
          taskQueue: 'myQueue',
          workflowId,
          workflowIdConflictPolicy: 'USE_EXISTING',
          args: [toProviderInput(lead)],
        })

        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
        )
        phone = await Promise.race([handle.result(), timeout])
      } catch {
        errored = true
      }

      if (phone) {
        await prisma.lead.update({ where: { id: lead.id }, data: { phoneNumber: phone } })
        foundCount++
      } else if (errored) {
        errorCount++
      }

      completed++
      sseEvent(res, { completed, total })
    })
  )

  sseEvent(res, { done: true, foundCount, errorCount })
  res.end()
}

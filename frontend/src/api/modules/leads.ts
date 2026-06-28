import { LeadsCreateInput, LeadsCreateOutput } from '../types/leads/create'
import { LeadsDeleteInput, LeadsDeleteOutput } from '../types/leads/delete'
import { LeadsDeleteManyInput, LeadsDeleteManyOutput } from '../types/leads/deleteMany'
import { LeadsGenerateMessagesInput, LeadsGenerateMessagesOutput } from '../types/leads/generateMessages'
import { LeadsGetManyInput, LeadsGetManyOutput } from '../types/leads/getMany'
import { LeadsGetOneInput, LeadsGetOneOutput } from '../types/leads/getOne'
import { LeadsUpdateInput, LeadsUpdateOutput } from '../types/leads/update'
import { LeadsBulkImportInput, LeadsBulkImportOutput } from '../types/leads/bulkImport'
import { LeadsVerifyEmailsInput, LeadsVerifyEmailsOutput } from '../types/leads/verifyEmails'
import {
  EnrichPhoneNumberInput,
  EnrichPhoneDoneEvent,
  EnrichPhoneProgressEvent,
} from '../types/leads/enrichPhoneNumber'
import { ApiModule, endpoint } from '../utils'

async function enrichPhoneNumbers(
  input: EnrichPhoneNumberInput,
  onProgress: (e: EnrichPhoneProgressEvent) => void
): Promise<{ foundCount: number }> {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const response = await fetch(`${baseUrl}/leads/enrich-phone-number`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok || !response.body) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let foundCount = 0
  let errorCount = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const event = JSON.parse(line.slice(6)) as EnrichPhoneProgressEvent | EnrichPhoneDoneEvent
      if ('done' in event) {
        foundCount = event.foundCount
        errorCount = event.errorCount
      } else {
        onProgress(event)
      }
    }
  }

  return { foundCount, errorCount }
}

export const leadsApi = {
  getMany: endpoint<LeadsGetManyOutput, LeadsGetManyInput>('get', '/leads'),
  getOne: endpoint<LeadsGetOneOutput, LeadsGetOneInput>('get', ({ id }) => `/leads/${id}`),
  create: endpoint<LeadsCreateOutput, LeadsCreateInput>('post', '/leads'),
  delete: endpoint<LeadsDeleteOutput, LeadsDeleteInput>('delete', ({ id }) => `/leads/${id}`),
  deleteMany: endpoint<LeadsDeleteManyOutput, LeadsDeleteManyInput>('delete', '/leads'),
  update: endpoint<LeadsUpdateOutput, LeadsUpdateInput>('put', ({ id }) => `/leads/${id}`),
  generateMessages: endpoint<LeadsGenerateMessagesOutput, LeadsGenerateMessagesInput>(
    'post',
    '/leads/generate-messages'
  ),
  bulkImport: endpoint<LeadsBulkImportOutput, LeadsBulkImportInput>('post', '/leads/bulk'),
  verifyEmails: endpoint<LeadsVerifyEmailsOutput, LeadsVerifyEmailsInput>('post', '/leads/verify-emails'),
  enrichPhoneNumbers,
} as const satisfies ApiModule

export type EnrichPhoneNumberInput = { leadIds: number[] }
export type EnrichPhoneProgressEvent = { completed: number; total: number }
export type EnrichPhoneDoneEvent = { done: true; foundCount: number; errorCount: number }

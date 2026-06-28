import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail, isValidLinkedInUrl } from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,phoneNumber,yearsInRole,linkedInURL
John,Doe,john@example.com,,,,, `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].phoneNumber).toBeUndefined()
    expect(result[0].yrsCurrentCompany).toBeUndefined()
    expect(result[0].linkedInUrl).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })
})

describe('isValidLinkedInUrl', () => {
  it('should return true for valid LinkedIn profile URLs', () => {
    expect(isValidLinkedInUrl('https://linkedin.com/in/janedoe')).toBe(true)
    expect(isValidLinkedInUrl('https://www.linkedin.com/in/janedoe')).toBe(true)
    expect(isValidLinkedInUrl('http://linkedin.com/in/jane-doe')).toBe(true)
    expect(isValidLinkedInUrl('https://www.linkedin.com/in/john_doe123/')).toBe(true)
    expect(isValidLinkedInUrl('https://linkedin.com/in/user-name_123%40/')).toBe(true)
  })

  it('should return false for invalid LinkedIn URLs', () => {
    expect(isValidLinkedInUrl('')).toBe(false)
    expect(isValidLinkedInUrl('https://twitter.com/janedoe')).toBe(false)
    expect(isValidLinkedInUrl('https://linkedin.com/company/acme')).toBe(false)
    expect(isValidLinkedInUrl('linkedin.com/in/janedoe')).toBe(false)
    expect(isValidLinkedInUrl('https://linkedin.com/in/')).toBe(false)
    expect(isValidLinkedInUrl('not-a-url')).toBe(false)
  })
})

describe('new fields: phoneNumber, yrsCurrentCompany, linkedInUrl', () => {
  it('should parse phoneNumber as-is without validation', () => {
    const csv = `firstName,lastName,email,phoneNumber
John,Doe,john@example.com,+1 (555) 000-0000`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].phoneNumber).toBe('+1 (555) 000-0000')
    expect(result[0].isValid).toBe(true)
  })

  it('should parse yearsInRole as integer', () => {
    const csv = `firstName,lastName,email,yearsInRole
John,Doe,john@example.com,5`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].yrsCurrentCompany).toBe(5)
    expect(result[0].isValid).toBe(true)
  })

  it('should accept yearsInRole of zero', () => {
    const csv = `firstName,lastName,email,yearsInRole
John,Doe,john@example.com,0`

    const result = parseCsv(csv)

    expect(result[0].yrsCurrentCompany).toBe(0)
    expect(result[0].isValid).toBe(true)
  })

  it('should reject non-integer yearsInRole', () => {
    const csv = `firstName,lastName,email,yearsInRole
John,Doe,john@example.com,3.5`

    const result = parseCsv(csv)

    expect(result[0].yrsCurrentCompany).toBeUndefined()
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Years at current company must be a non-negative integer')
  })

  it('should reject negative yearsInRole', () => {
    const csv = `firstName,lastName,email,yearsInRole
John,Doe,john@example.com,-1`

    const result = parseCsv(csv)

    expect(result[0].yrsCurrentCompany).toBeUndefined()
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Years at current company must be a non-negative integer')
  })

  it('should accept valid linkedInUrl', () => {
    const csv = `firstName,lastName,email,linkedInURL
John,Doe,john@example.com,https://linkedin.com/in/johndoe`

    const result = parseCsv(csv)

    expect(result[0].linkedInUrl).toBe('https://linkedin.com/in/johndoe')
    expect(result[0].isValid).toBe(true)
  })

  it('should reject invalid linkedInUrl', () => {
    const csv = `firstName,lastName,email,linkedInURL
John,Doe,john@example.com,https://twitter.com/johndoe`

    const result = parseCsv(csv)

    expect(result[0].linkedInUrl).toBeUndefined()
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid LinkedIn URL (expected format: https://linkedin.com/in/username)')
  })

  it('should normalize new field headers case-insensitively', () => {
    const csv = `firstName,lastName,email,PHONENUMBER,YearsInRole,LinkedInURL
John,Doe,john@example.com,555-1234,3,https://linkedin.com/in/johndoe`

    const result = parseCsv(csv)

    expect(result[0].phoneNumber).toBe('555-1234')
    expect(result[0].yrsCurrentCompany).toBe(3)
    expect(result[0].linkedInUrl).toBe('https://linkedin.com/in/johndoe')
    expect(result[0].isValid).toBe(true)
  })

  it('should normalize headers with underscores and mixed case', () => {
    const csv = `firstName,lastName,email,phone_number,years_in_role,linked_in_url
John,Doe,john@example.com,555-9999,7,https://linkedin.com/in/johndoe`

    const result = parseCsv(csv)

    expect(result[0].phoneNumber).toBe('555-9999')
    expect(result[0].yrsCurrentCompany).toBe(7)
    expect(result[0].linkedInUrl).toBe('https://linkedin.com/in/johndoe')
  })

  it('should still be valid when all 3 new fields are absent', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com`

    const result = parseCsv(csv)

    expect(result[0].isValid).toBe(true)
    expect(result[0].phoneNumber).toBeUndefined()
    expect(result[0].yrsCurrentCompany).toBeUndefined()
    expect(result[0].linkedInUrl).toBeUndefined()
  })
})

describe('encoding edge cases', () => {
  it('strips UTF-8 BOM and parses countryCode correctly', () => {
    const csv = '﻿firstName,lastName,email,countryCode\nJohn,Doe,john@example.com,US'
    const result = parseCsv(csv)
    expect(result).toHaveLength(1)
    expect(result[0].countryCode).toBe('US')
    expect(result[0].isValid).toBe(true)
  })

  it('parses countryCode correctly when earlier fields have special characters', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
Iñaki,Álvarez,user@example.com,Restaurant manager,ES,Rogers Inc
Ümit,Çelik,umit@example.com,Engineer,TR,Tech Corp`
    const result = parseCsv(csv)
    expect(result[0].countryCode).toBe('ES')
    expect(result[1].countryCode).toBe('TR')
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(true)
  })

  it('parses countryCode correctly when other fields contain unicode replacement chars', () => {
    const csv = `firstName,lastName,email,countryCode\nI�aki,Smith,test@example.com,DE`
    const result = parseCsv(csv)
    expect(result[0].countryCode).toBe('DE')
  })
})

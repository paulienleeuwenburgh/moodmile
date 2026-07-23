import { describe, it, expect } from 'vitest'
import { validateImageUrl } from './imageUrl'

describe('validateImageUrl', () => {
  it('returns null for undefined (absent field)', () => {
    expect(validateImageUrl(undefined)).toBeNull()
  })

  it('returns null for null', () => {
    expect(validateImageUrl(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(validateImageUrl('')).toBeNull()
  })

  it('accepts a relative path', () => {
    expect(validateImageUrl('/mascots/ninja1.png')).toBeNull()
  })

  it('accepts a root relative path', () => {
    expect(validateImageUrl('/')).toBeNull()
  })

  it('accepts an HTTPS URL', () => {
    expect(validateImageUrl('https://example.com/image.png')).toBeNull()
  })

  it('accepts an Azure Blob Storage HTTPS URL', () => {
    expect(validateImageUrl('https://myaccount.blob.core.windows.net/container/image.png')).toBeNull()
  })

  it('rejects an HTTP URL', () => {
    const error = validateImageUrl('http://example.com/image.png')
    expect(error).not.toBeNull()
    expect(error).toContain('HTTPS')
  })

  it('rejects a data URI', () => {
    const error = validateImageUrl('data:image/png;base64,abc123')
    expect(error).not.toBeNull()
    expect(error).toContain('Data URI')
  })

  it('rejects a javascript: URI', () => {
    const error = validateImageUrl('javascript:alert(1)')
    expect(error).not.toBeNull()
  })

  it('rejects an unrecognised scheme', () => {
    const error = validateImageUrl('ftp://files.example.com/img.png')
    expect(error).not.toBeNull()
    expect(error).toContain('https://')
  })

  it('rejects a bare hostname without scheme', () => {
    const error = validateImageUrl('example.com/image.png')
    expect(error).not.toBeNull()
  })
})

/**
 * Image URL validation — frontend mirror of api/src/imageUrl.ts.
 *
 * Supported schemes:
 *   - https://  – any public HTTPS URL (e.g. Azure Blob Storage, CDN)
 *   - /         – relative path served from the app's static assets (e.g. /mascots/ninja1.png)
 *
 * Returns an error message string when invalid, or null when valid.
 */
export function validateImageUrl(url: string | undefined | null): string | null {
  if (!url) {
    return null
  }

  const trimmed = url.trim()

  if (trimmed.startsWith('/')) {
    return null
  }

  if (trimmed.startsWith('https://')) {
    return null
  }

  if (trimmed.startsWith('http://')) {
    return 'Image URL must use HTTPS, not HTTP.'
  }

  if (trimmed.startsWith('data:')) {
    return 'Data URI image URLs are not supported. Use an HTTPS URL or a relative path.'
  }

  return 'Image URL must start with https:// or / (relative path).'
}

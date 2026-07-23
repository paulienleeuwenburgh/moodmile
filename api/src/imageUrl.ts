/**
 * Image URL validation.
 *
 * Supported schemes:
 *   - https://  – any public HTTPS URL (e.g. Azure Blob Storage, CDN)
 *   - /         – relative path served from the app's static assets (e.g. /mascots/ninja1.png)
 *
 * Rejected schemes:
 *   - http://   – insecure; images mixed into an HTTPS page trigger browser warnings
 *   - data:     – inline data URIs are large, hard to manage, and pose XSS risk
 *   - javascript: – obviously dangerous
 *   - anything else not matching the above patterns
 *
 * Image ownership:
 *   - Campaign   → bannerImageUrl  (optional; rendered in the hero section)
 *   - Question   → imageUrl        (optional; rendered as the category/question thumbnail)
 *   - Suggestion → imageUrl        (optional; rendered as the candidate avatar)
 *
 * All image fields are optional. Absence is handled gracefully by showing a placeholder.
 * Images are stored as URL strings in Azure Table Storage and can be changed at any time
 * without redeployment.
 */

/**
 * Validate an image URL string.
 * Returns an error message string when invalid, or null when valid.
 */
export function validateImageUrl(url: string | undefined | null): string | null {
  if (!url) {
    return null // absent / empty is always valid (optional field)
  }

  const trimmed = url.trim()

  // Relative paths (must start with /) are allowed — served from the app's static assets.
  if (trimmed.startsWith('/')) {
    return null
  }

  // HTTPS absolute URLs are allowed.
  if (trimmed.startsWith('https://')) {
    return null
  }

  // Explicitly reject common unsafe schemes with targeted messages.
  if (trimmed.startsWith('http://')) {
    return 'Image URL must use HTTPS, not HTTP.'
  }

  if (trimmed.startsWith('data:')) {
    return 'Data URI image URLs are not supported. Use an HTTPS URL or a relative path.'
  }

  return 'Image URL must start with https:// or / (relative path).'
}

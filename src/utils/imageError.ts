/**
 * onError handler for <img> elements.
 *
 * Hides the image element when it fails to load (e.g. broken blob URL,
 * unreachable CDN, or missing static asset). This prevents the browser's
 * default broken-image placeholder from appearing in the UI.
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none'
}

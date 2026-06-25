/**
 * Safe parser for hero image gallery.
 * Supports pipe '|' separated values to prevent breaking base64 data URLs,
 * and falls back to comma separation for safe external image links.
 */
export function parseHeroImages(heroImageString: string): string[] {
  if (!heroImageString) return [];
  
  // If it's a pipe-separated string, parse it directly
  if (heroImageString.includes("|")) {
    return heroImageString.split("|").map(s => s.trim()).filter(Boolean);
  }
  
  // If it contains a Base64 data image but no pipes, it's likely a single data URL
  if (heroImageString.startsWith("data:")) {
    return [heroImageString.trim()];
  }
  
  // Otherwise, fallback to standard comma split (e.g., initial Unsplash lists)
  return heroImageString.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Packs array of hero images into a safe storage string.
 */
export function serializeHeroImages(images: string[]): string {
  return images.map(s => s.trim()).filter(Boolean).join("|");
}

/**
 * Standard default medical-themed hero images in case the list is empty.
 */
export const DEFAULT_HERO_IMAGES = [
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=1200"
];

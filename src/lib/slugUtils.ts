/**
 * Generates a URL-friendly slug from name and location
 */
export const generateSlug = (name: string, location?: string): string => {
  const combined = location ? `${name}-${location}` : name;
  return combined
    .toLowerCase()
    .trim()
    .replace(/[^\\w\\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 100); // Limit length
};

/**
 * Parses a slug to extract potential search terms
 */
export const parseSlug = (slug: string): string => {
  return slug.replace(/-/g, ' ').trim();
};

/**
 * Creates a full URL path with slug and id for fallback
 * Uses full UUID for reliable database lookups
 */
export const createDetailPath = (
  type: string,
  id: string,
  name: string,
  location?: string
): string => {
  // If name is empty or invalid, just use the ID directly
  if (!name || name.trim() === '') {
    return `/${type}/${id}`;
  }
  
  const slug = generateSlug(name, location);
  
  // If slug generation failed, use ID directly
  if (!slug) {
    return `/${type}/${id}`;
  }
  
  // Use full UUID for reliable matching
  return `/${type}/${slug}-${id}`;
};

/**
 * Extracts ID from a slug-id combination or returns the ID directly
 * Handles multiple formats: full UUID, slug-uuid, partial IDs
 */
export const extractIdFromSlug = (slugWithId: string): string => {
  if (!slugWithId) return '';
  
  // Check if it's a full UUID format anywhere in the string
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const uuidMatch = slugWithId.match(uuidPattern);
  if (uuidMatch) {
    return uuidMatch[0];
  }
  
  // Clean the slug and try to extract ID from the end
  const cleaned = slugWithId.replace(/^-+|-+$/g, '').trim();
  
  // If cleaned string looks like a valid UUID prefix (8+ hex chars), return it
  if (/^[0-9a-f]{8,}$/i.test(cleaned)) {
    return cleaned;
  }
  
  // Split by hyphen and look for UUID-like segments from the end
  const parts = cleaned.split('-').filter(p => p.length > 0);
  
  // Try to find a valid hex segment (at least 8 chars) from the end
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^[0-9a-f]{8,}$/i.test(parts[i])) {
      return parts[i];
    }
  }
  
  // Last resort: return the last non-empty part
  const lastPart = parts[parts.length - 1];
  if (lastPart && /^[0-9a-f]+$/i.test(lastPart)) {
    return lastPart;
  }
  
  // Return cleaned slug as fallback
  return cleaned;
};

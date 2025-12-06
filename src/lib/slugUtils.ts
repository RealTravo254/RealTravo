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
 */
export const createDetailPath = (
  type: string,
  id: string,
  name: string,
  location?: string
): string => {
  const slug = generateSlug(name, location);
  return `/${type}/${slug}-${id.substring(0, 8)}`;
};

/**
 * Extracts ID from a slug-id combination
 * The ID is the last 8 characters after the final hyphen
 */
export const extractIdFromSlug = (slugWithId: string): string => {
  if (!slugWithId) return '';
  
  // Check if it's a full UUID format
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(slugWithId)) {
    return slugWithId;
  }
  
  // Clean up slug - remove leading/trailing hyphens and collapse multiple hyphens
  const cleanSlug = slugWithId.replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  
  if (!cleanSlug) return '';
  
  // Split by hyphen and look for the ID part (last segment that looks like hex)
  const parts = cleanSlug.split('-');
  
  // Check from the end for a valid hex ID part
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && /^[0-9a-f]+$/i.test(part) && part.length >= 6) {
      return part;
    }
  }
  
  // If no valid hex part found, try to extract from the entire cleaned string
  const hexMatch = cleanSlug.match(/[0-9a-f]{8}/i);
  if (hexMatch) {
    return hexMatch[0];
  }
  
  // Last resort - return the last part after hyphen
  const lastHyphenIndex = cleanSlug.lastIndexOf('-');
  if (lastHyphenIndex !== -1 && lastHyphenIndex < cleanSlug.length - 1) {
    return cleanSlug.substring(lastHyphenIndex + 1);
  }
  
  return cleanSlug;
};

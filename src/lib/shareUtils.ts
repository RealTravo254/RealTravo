import { createDetailPath } from "@/lib/slugUtils";

/**
 * Generate a clean, SEO-friendly share link for an item.
 * No referral parameters — just slug-based URLs.
 * Always points to the production domain realtravo.com.
 */
export const getShareLink = (
  itemId: string,
  itemType: string,
  itemName: string,
  itemLocation?: string
): string => {
  const typeMap: Record<string, string> = {
    trip: "trip",
    event: "event",
    hotel: "hotel",
    adventure: "adventure",
    adventure_place: "adventure", 
  };
  
  const type = typeMap[itemType] || itemType;
  const path = createDetailPath(type, itemId, itemName, itemLocation);
  
  // Forces the domain to be realtravo.com even when testing on localhost
  const baseUrl = "https://realtravo.com"; 
  
  return `${baseUrl}${path}`;
};
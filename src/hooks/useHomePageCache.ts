// Cache management for home page data
const CACHE_KEY = 'home_page_cache';
const CACHE_EXPIRY_KEY = 'home_page_cache_expiry';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface HomePageCacheData {
  scrollableRows: {
    trips: any[];
    hotels: any[];
    attractions: any[];
    campsites: any[];
    events: any[];
  };
  listings: any[];
  nearbyPlacesHotels: any[];
  cachedAt: number;
}

export const getCachedHomePageData = (): HomePageCacheData | null => {
  try {
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    const now = Date.now();
    
    // Check if cache is expired
    if (expiry && now > parseInt(expiry, 10)) {
      clearHomePageCache();
      return null;
    }
    
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export const setCachedHomePageData = (data: Omit<HomePageCacheData, 'cachedAt'>): void => {
  try {
    const cacheData: HomePageCacheData = {
      ...data,
      cachedAt: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION_MS));
  } catch (error) {
    // Storage might be full, silently fail
    console.warn('Failed to cache home page data:', error);
  }
};

export const clearHomePageCache = (): void => {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_EXPIRY_KEY);
};

export const isCacheValid = (): boolean => {
  try {
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (!expiry) return false;
    return Date.now() < parseInt(expiry, 10);
  } catch {
    return false;
  }
};

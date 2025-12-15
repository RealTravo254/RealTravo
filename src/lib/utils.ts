import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Optimizes Supabase Storage image URLs with transformations
 * Supports resize, format conversion, and quality settings
 */
export function optimizeSupabaseImage(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'origin';
  } = {}
): string {
  if (!url) return url;
  
  // Only optimize Supabase Storage URLs
  if (!url.includes('supabase.co/storage')) {
    return url;
  }

  const { width, height, quality = 85, format = 'webp' } = options;
  
  // Build transformation parameters
  const params = new URLSearchParams();
  
  if (width) params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  if (quality) params.append('quality', quality.toString());
  if (format !== 'origin') params.append('format', format);
  
  // Add transformation parameters to URL
  const separator = url.includes('?') ? '&' : '?';
  return params.toString() ? `${url}${separator}${params.toString()}` : url;
}

/**
 * Generates srcset for responsive images
 * Uses smaller sizes optimized for listing cards (~254px display)
 */
export function generateImageSrcSet(
  url: string,
  sizes: number[] = [160, 256, 320, 480]
): string {
  if (!url || !url.includes('supabase.co/storage')) {
    return '';
  }
  
  return sizes
    .map(size => `${optimizeSupabaseImage(url, { width: size, quality: 75 })} ${size}w`)
    .join(', ');
}

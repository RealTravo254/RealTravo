import { useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";

interface ConditionalFooterProps {
  className?: string;
}

/**
 * Footer that only displays on Home and Category pages
 * Hidden on detail pages, account pages, checkout pages, etc.
 */
export const ConditionalFooter = ({ className }: ConditionalFooterProps) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Pages where footer should be visible
  const footerVisiblePaths = [
    "/", // Home page
    "/contact", // Contact page
    "/about", // About page
  ];

  // Path prefixes where footer should be visible
  const footerVisiblePrefixes = [
    "/category/", // Category pages
  ];

  const shouldShowFooter = 
    footerVisiblePaths.includes(pathname) ||
    footerVisiblePrefixes.some(prefix => pathname.startsWith(prefix));

  if (!shouldShowFooter) {
    return null;
  }

  return <Footer className={className} />;
};

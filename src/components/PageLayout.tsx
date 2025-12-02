import { useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";

interface PageLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout wrapper that conditionally renders Footer
 * Footer is ONLY displayed on Home and Category pages
 */
export const PageLayout = ({ children }: PageLayoutProps) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Pages where footer should be visible
  const shouldShowFooter = 
    pathname === "/" || // Home page
    pathname.startsWith("/category/"); // Category pages

  return (
    <>
      {children}
      {shouldShowFooter && <Footer />}
    </>
  );
};

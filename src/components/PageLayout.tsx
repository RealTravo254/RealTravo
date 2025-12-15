import { useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";

interface PageLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout wrapper that conditionally renders Footer
 * Footer is ONLY displayed on Home, Category, Contact, and About pages
 */
export const PageLayout = ({ children }: PageLayoutProps) => {
  const location = useLocation();
  const pathname = location.pathname;

  // Pages where footer should be visible
  const shouldShowFooter = 
    pathname === "/" || // Home page
    pathname === "/contact" || // Contact page
    pathname === "/about" || // About page
    pathname.startsWith("/category/"); // Category pages

  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex-1 w-full">
        {children}
      </div>
      {shouldShowFooter && <Footer />}
    </div>
  );
};

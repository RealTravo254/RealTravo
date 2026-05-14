import { useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Header } from "@/components/Header";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { createContext, useContext, useState, useCallback } from "react";

interface SearchFocusContextType {
  isSearchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
}

const SearchFocusContext = createContext<SearchFocusContextType>({
  isSearchFocused: false,
  setSearchFocused: () => {},
});

export const useSearchFocus = () => useContext(SearchFocusContext);

interface PageLayoutProps {
  children: React.ReactNode;
}

export const PageLayout = ({ children }: PageLayoutProps) => {
  const location = useLocation();
  const pathname = location.pathname;
  const [isSearchFocused, setSearchFocused] = useState(false);

  const shouldShowFooter =
    pathname === "/" ||
    pathname === "/contact" ||
    pathname === "/about" ||
    pathname.startsWith("/category/") ||
    pathname.startsWith("/county/");

  // Hide mobile bottom bar on detail pages and booking pages
  const isDetailPage =
    pathname.startsWith("/adventure/") || pathname.startsWith("/hotel/") ||
    pathname.startsWith("/event/") || pathname.startsWith("/trip/");

  const shouldHideMobileBar =
    pathname === "/host-verification" || pathname.startsWith("/booking/") || isDetailPage ||
    pathname === "/auth" || pathname === "/reset-password" || pathname === "/forgot-password";

  // Auth page renders its own header; also hide on explore, category, county, and detail pages
  const shouldHideHeader =
    pathname === "/auth" || pathname === "/reset-password" || pathname === "/forgot-password" ||
    pathname === "/verify-email" || pathname === "/complete-profile" || pathname.startsWith("/booking/") ||
    pathname === "/explore" ||
    pathname.startsWith("/category/") ||
    pathname.startsWith("/county/") ||
    isDetailPage;

  // On mobile, only show header on index page
  const shouldHideHeaderOnMobile = pathname !== "/";

  // Hide header completely when search is focused
  const hideHeaderForSearch = isSearchFocused;

  return (
    <SearchFocusContext.Provider value={{ isSearchFocused, setSearchFocused }}>
      <div className="w-full min-h-screen flex flex-col">
        <OfflineIndicator />
        {!shouldHideHeader && !hideHeaderForSearch && (
          <div className={shouldHideHeaderOnMobile ? "hidden md:block" : ""}>
            <Header __fromLayout />
          </div>
        )}
        <div className={`flex-1 w-full ${!shouldHideMobileBar ? 'pb-20' : 'pb-0'} md:pb-0 ${!shouldHideHeader && !hideHeaderForSearch ? (shouldHideHeaderOnMobile ? 'pt-0 md:pt-14' : 'pt-0 md:pt-14') : ''}`}>
          {children}
        </div>
        {shouldShowFooter && <Footer />}
        {!shouldHideMobileBar && <MobileBottomBar />}
      </div>
    </SearchFocusContext.Provider>
  );
};
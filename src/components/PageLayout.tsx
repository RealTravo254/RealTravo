import { useLocation } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Header } from "@/components/Header";

interface PageLayoutProps {
  children: React.ReactNode;
}

export const PageLayout = ({ children }: PageLayoutProps) => {
  const location = useLocation();
  const pathname = location.pathname;

  const shouldShowFooter =
    pathname === "/" || pathname === "/contact" || pathname === "/about" || pathname.startsWith("/category/");

  const shouldHideMobileBar =
    pathname === "/host-verification" || pathname.startsWith("/booking/");

  const shouldHideHeader =
    pathname === "/auth" || pathname === "/reset-password" || pathname === "/forgot-password" ||
    pathname === "/verify-email" || pathname === "/complete-profile";

  const shouldHideHeaderOnMobile =
    pathname.startsWith("/hotel/") ||
    pathname.startsWith("/adventure/") ||
    pathname.startsWith("/attraction/") ||
    pathname.startsWith("/trip/") ||
    pathname.startsWith("/event/");

  return (
    <div className="w-full min-h-screen flex flex-col">
      {!shouldHideHeader && (
        <div className={shouldHideHeaderOnMobile ? "hidden md:block" : ""}>
          <Header __fromLayout />
        </div>
      )}
      <div className="flex-1 w-full pb-20 md:pb-0">{children}</div>
      {shouldShowFooter && <Footer />}
      {!shouldHideMobileBar && <MobileBottomBar />}
    </div>
  );
};
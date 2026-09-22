// Save as: src/pages/admin/AdminVisitAnalyticsPage.tsx
//
// Wrapper page for the Visitor Analytics panel.
// Replaces the old custom teal hero (icon badge + title + subtitle +
// circular back button) with the app's shared Header/Footer and a
// back button styled the same way the rest of AccountPage's buttons are
// (border border-border bg-card hover:bg-muted).
//
// Route this at whatever path used to render the teal-header version,
// e.g. <Route path="/admin/analytics" element={<AdminVisitAnalyticsPage />} />

import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import VisitAnalyticsPanel from "./VisitAnalyticsPanel";

export default function AdminVisitAnalyticsPage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col min-h-screen bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <Header />

      <main className="flex-1 px-4 pt-4 pb-12 max-w-5xl mx-auto w-full space-y-5">
        {/* Back button — matches the bordered/card button style used
           throughout AccountPage rather than the old circular teal one */}
        <button
          onClick={() => navigate(-1)}
          className="h-8 px-3 rounded-lg text-xs font-bold border border-border bg-card hover:bg-muted text-foreground transition-all inline-flex items-center gap-1.5 active:scale-95"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <VisitAnalyticsPanel />
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
}
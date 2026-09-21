// Save as: src/pages/admin/VisitAnalytics.tsx
// Route: /admin/analytics  (opened from the "Visitor Analytics" card on /admin)
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3 } from "lucide-react";
import VisitAnalyticsPanel from "./VisitAnalyticsPanel";

const VisitAnalytics = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen w-full bg-background flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Header (same style as the admin dashboard) */}
      <div className="bg-primary px-4 pt-5 pb-6 relative flex-shrink-0">
        <button
          onClick={() => navigate("/admin")}
          aria-label="Back to admin dashboard"
          className="absolute top-4 left-4 h-8 w-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-primary-foreground" />
        </button>

        <div className="flex flex-col items-center text-center pt-8">
          <div className="h-12 w-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center mb-2">
            <BarChart3 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-black text-primary-foreground">Visitor Analytics</h1>
          <p className="text-primary-foreground/60 text-xs font-medium mt-0.5">
            Who visits RealTravo, on web and in the app
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-4 max-w-4xl w-full mx-auto">
        <VisitAnalyticsPanel />
      </div>
    </div>
  );
};

export default VisitAnalytics;
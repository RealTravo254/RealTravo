import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * AppAuthHandler — add this page to your WEBSITE at /app-auth
 *
 * It receives the session tokens from the mobile app and
 * restores the user's session, then redirects to the target page.
 *
 * Add this route in your website's App.tsx or router:
 *   <Route path="/app-auth" element={<AppAuthHandler />} />
 */
const AppAuthHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your session...");

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const accessToken = searchParams.get("access_token");
        const refreshToken = searchParams.get("refresh_token");
        const redirectTo = searchParams.get("redirect_to") || "/";

        if (!accessToken || !refreshToken) {
          setStatus("error");
          setMessage("Invalid session link. Please log in again.");
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        // Restore the session from the app's tokens
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error || !data.session) {
          setStatus("error");
          setMessage("Session expired. Please log in again.");
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        // Success — redirect to the target page
        setStatus("success");
        setMessage("Redirecting you now...");
        setTimeout(() => navigate(redirectTo), 800);
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message ?? "Something went wrong.");
        setTimeout(() => navigate("/auth"), 3000);
      }
    };

    restoreSession();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 max-w-sm w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: status === "error" ? "#fef2f2" : "#f0fdfa",
            border: `1px solid ${status === "error" ? "#fecaca" : "#99f6e4"}`,
          }}>
          {status === "loading" && <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />}
          {status === "success" && <CheckCircle2 className="h-8 w-8 text-teal-600" />}
          {status === "error" && <XCircle className="h-8 w-8 text-red-400" />}
        </div>

        {/* Text */}
        <h1 className="text-xl font-black text-slate-800 mb-2">
          {status === "loading" && "Signing you in..."}
          {status === "success" && "Welcome back!"}
          {status === "error" && "Session Error"}
        </h1>
        <p className="text-sm text-slate-400">{message}</p>

        {/* RealTravo branding */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <p className="text-[11px] text-slate-300 font-semibold uppercase tracking-widest">
            RealTravo — Secure Sign-In
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppAuthHandler;
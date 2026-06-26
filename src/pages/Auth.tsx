import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, Compass } from "lucide-react";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo || "/";

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  useEffect(() => {
    if (!loading && user) {
      navigate(returnTo);
    }
  }, [loading, user, returnTo, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center">
        <Compass className="w-8 h-8 text-[rgb(0,128,128)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#070A13] text-slate-100 antialiased font-sans selection:bg-teal-500/20">
      <SEOHead
        title="Welcome to Realtravo | Sign In or Sign Up"
        description="Explore custom activities, book unique hotels or campsites, and easily host your assets on Realtravo."
      />

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-gradient-to-br from-[#121131] via-[#090D1A] to-[#03050B]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-[rgb(0,128,128)]/10 rounded-full blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex flex-col cursor-pointer" onClick={() => navigate("/")}>
            <span className="text-2xl font-black tracking-wider text-[rgb(0,128,128)]">RealTravo</span>
            <span className="text-[10px] font-mono tracking-widest text-slate-500">WWW.REALTRAVO.COM</span>
          </div>

          <div className="space-y-4 my-auto max-w-sm">
            <h1 className="text-4xl font-black text-white leading-[1.1] tracking-tight">
              Discover.<br />
              Book.<br />
              <span className="bg-gradient-to-r from-[rgb(0,128,128)] to-teal-200 bg-clip-text text-transparent">
                Experience.
              </span>
            </h1>
            <p className="text-slate-400 text-sm font-medium leading-relaxed">
              Your comprehensive travel ecosystem built for curated getaways, premium active rentals, and trusted local marketplaces.
            </p>
          </div>

          <p className="text-slate-600 text-[10px] font-mono tracking-widest uppercase">
            © {new Date().getFullYear()} Realtravo Inc.
          </p>
        </div>
      </div>

      {/* Right Panel */}
      <div
        className="flex-1 flex flex-col min-h-screen relative overflow-hidden"
        style={{
          backgroundImage: "url('/images/category-campsite.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Reduced overlay — image now clearly visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070A13]/20 via-transparent to-[#070A13]/20 lg:bg-gradient-to-tr lg:from-[#070A13]/20 lg:via-transparent lg:to-transparent z-0" />

        {/* Navigation Header */}
        <div className="relative z-10 flex items-center justify-between p-4 lg:p-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-900/80 hover:border-white/20 backdrop-blur-md transition-all duration-200 shadow-sm group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs font-semibold">Return Home</span>
          </button>

          <div className="flex flex-col text-right lg:hidden">
            <span className="text-lg font-black text-[rgb(0,128,128)] tracking-wide">RealTravo</span>
            <span className="text-[8px] text-slate-500 font-mono">WWW.REALTRAVO.COM</span>
          </div>
        </div>

        {/* Form Area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8 lg:px-8">
          <div className="w-full max-w-[420px]">
            <div
              key="auth-form-card"
              className="bg-slate-950/45 backdrop-blur-2xl border border-white/10 rounded-xl p-6 lg:p-8 space-y-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transform transition-all duration-500 scale-[1.01] h-auto max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="space-y-1 text-center lg:text-left flex-shrink-0">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  {activeTab === "login" ? "Welcome back" : "Get started"}
                </h2>
                <p className="text-slate-400 text-xs font-medium">
                  {activeTab === "login"
                    ? "Sign in to plan and access your luxury portals"
                    : "Create an account to embark on custom journeys"}
                </p>
              </div>

              <div className="flex bg-black/50 border border-white/5 p-0.5 rounded-lg flex-shrink-0">
                <button
                  onClick={() => setActiveTab("login")}
                  className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all duration-200 ${
                    activeTab === "login"
                      ? "bg-[rgb(0,128,128)] text-white shadow-md scale-[1.01]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab("signup")}
                  className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all duration-200 ${
                    activeTab === "signup"
                      ? "bg-[rgb(0,128,128)] text-white shadow-md scale-[1.01]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <div className="mt-1 text-slate-200 max-h-[340px] overflow-y-auto pr-1 overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {activeTab === "login" ? (
                  <LoginForm onSwitchToSignup={() => setActiveTab("signup")} />
                ) : (
                  <SignupForm onSwitchToLogin={() => setActiveTab("login")} />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 p-4 text-center lg:hidden">
          <p className="text-[10px] text-slate-600 font-medium">
            © {new Date().getFullYear()} Realtravo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
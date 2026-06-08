import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, MapPin, Shield, Star, Compass } from "lucide-react";

const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo || "/";

  if (!loading && user) {
    navigate(returnTo);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center">
        <Compass className="w-10 h-10 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#070A13] text-slate-100 antialiased font-sans selection:bg-white/20">
      <SEOHead
        title="Sign In or Sign Up | Realtravo"
        description="Create an account or sign in to Realtravo to book trips, save favorites, and manage your travel experiences."
      />

      {/* Left Panel - Premium Branding Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-[#121131] via-[#090D1A] to-[#03050B]">
        {/* Subtle Engineering Grid and Flare */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src="/fulllogo.png" alt="Realtravo" className="h-9 brightness-0 invert tracking-wide" />
          </div>

          {/* Core Content */}
          <div className="space-y-12 my-auto">
            <div className="space-y-6">
              <h1 className="text-6xl font-black text-white leading-[1.1] tracking-tight">
                Discover.<br />
                Book.<br />
                <span className="bg-gradient-to-r from-white via-slate-200/80 to-slate-500/30 bg-clip-text text-transparent">
                  Experience.
                </span>
              </h1>
              <p className="text-slate-400 text-lg max-w-sm font-medium leading-relaxed">
                Your ultimate companion portal for tailored getaways, unique stays, and boutique trails.
              </p>
            </div>

            {/* Value Vectors */}
            <div className="flex flex-col gap-6">
              {[
                { icon: MapPin, text: "Handpicked stays, trips & adventures" },
                { icon: Shield, text: "Book with confidence, pay securely" },
                { icon: Star, text: "Real reviews from real travelers" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-4 group">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300">
                    <Icon className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-slate-300 text-sm font-semibold tracking-wide group-hover:text-white transition-colors">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-slate-600 text-xs font-mono tracking-widest uppercase">
            © {new Date().getFullYear()} Realtravo Inc.
          </p>
        </div>
      </div>

      {/* Right Panel - Immersive Content Card Area */}
      <div
        className="flex-1 flex flex-col min-h-screen relative"
        style={{
          backgroundImage: "url('/images/category-campsite.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Soft Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070A13]/90 via-[#070A13]/75 to-[#070A13]/95 lg:bg-gradient-to-tr lg:from-[#070A13]/95 lg:via-[#070A13]/70 lg:to-black/30 z-0" />

        {/* Global Control Layout */}
        <div className="relative z-10 flex items-center justify-between p-6 lg:p-10">
          <button
            onClick={() => navigate("/")}
            className="hidden lg:flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/40 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-900/80 hover:border-white/20 backdrop-blur-md transition-all duration-200 shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-semibold">Return Home</span>
          </button>
          
          <img src="/fulllogo.png" alt="Realtravo" className="h-6 lg:hidden brightness-0 invert" />
          <div className="w-10 lg:hidden" />
        </div>

        {/* Dynamic Card Area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-12 lg:px-12">
          <div className="w-full max-w-[450px]">
            {/* Master Glassmorphic Shell */}
            <div className="bg-slate-950/45 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 lg:p-10 space-y-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
              
              {/* Header Blocks */}
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-3xl font-extrabold text-white tracking-tight">
                  {activeTab === "login" ? "Welcome back" : "Get started"}
                </h2>
                <p className="text-slate-400 text-sm font-medium">
                  {activeTab === "login"
                    ? "Sign in to plan and access your luxury portals"
                    : "Create an account to embark on custom journeys"}
                </p>
              </div>

              {/* Segmented Controller */}
              <div className="flex bg-black/50 border border-white/5 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab("login")}
                  className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold rounded-lg transition-all duration-200 ${
                    activeTab === "login"
                      ? "bg-white text-slate-950 shadow-md scale-[1.01]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab("signup")}
                  className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold rounded-lg transition-all duration-200 ${
                    activeTab === "signup"
                      ? "bg-white text-slate-950 shadow-md scale-[1.01]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Interactive Core */}
              <div className="mt-2 text-slate-200">
                {activeTab === "login" ? (
                  <LoginForm onSwitchToSignup={() => setActiveTab("signup")} />
                ) : (
                  <SignupForm onSwitchToLogin={() => setActiveTab("login")} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Minimal Layout Disclaimer */}
        <div className="relative z-10 p-6 text-center lg:hidden">
          <p className="text-xs text-slate-600 font-medium">
            © {new Date().getFullYear()} Realtravo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
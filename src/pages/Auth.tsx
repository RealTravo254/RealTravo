import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, MapPin, Star, Compass } from "lucide-react";

const Auth = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo || "/";

  // Check if a page (like ForgotPassword) requested starting directly on the form slide (index 3)
  const initialSlide = location.state?.returnToSlideIndex !== undefined 
    ? location.state.returnToSlideIndex 
    : 0;

  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [slideIndex, setSlideIndex] = useState<number>(initialSlide);

  if (!loading && user) {
    navigate(returnTo);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center">
        <Compass className="w-8 h-8 text-[rgb(0,128,128)] animate-spin" />
      </div>
    );
  }

  const onboardingSlides = [
    {
      title: "Discover Activities & Guides",
      description: "Uncover hidden activities and hire experienced local experts to turn your trips into true stories.",
      icon: <Compass className="w-12 h-12 text-[rgb(0,128,128)] mx-auto" />
    },
    {
      title: "Trips, Hotels & Campsites",
      description: "Plan your stays seamlessly. Book luxury hotels, boutique rooms, or secure your pitch under the stars at peaceful campsites.",
      icon: <MapPin className="w-12 h-12 text-[rgb(0,128,128)] mx-auto" />
    },
    {
      title: "Host & Share Your Items",
      description: "Monetize your gear, spaces, campsites, properties, or guiding skills by hosting directly on our open marketplace.",
      icon: <Star className="w-12 h-12 text-[rgb(0,128,128)] mx-auto" />
    }
  ];

  const handleNextSlide = () => {
    if (slideIndex < 3) {
      setSlideIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#070A13] text-slate-100 antialiased font-sans selection:bg-teal-500/20">
      <SEOHead
        title="Welcome to Realtravo | Sign In or Sign Up"
        description="Explore custom activities, book unique hotels or campsites, and easily host your assets on Realtravo."
      />

      {/* Left Panel - Premium Branding & Onboarding Container */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-gradient-to-br from-[#121131] via-[#090D1A] to-[#03050B]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-[rgb(0,128,128)]/10 rounded-full blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Brand Identity Typography */}
          <div className="flex flex-col cursor-pointer" onClick={() => navigate("/")}>
            <span className="text-2xl font-black tracking-wider text-[rgb(0,128,128)]">RealTravo</span>
            <span className="text-[10px] font-mono tracking-widest text-slate-500">WWW.REALTRAVO.COM</span>
          </div>

          {/* Static High-End Branding Pitch */}
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

      {/* Right Panel - Dynamic Interchanging Card & Slider Space */}
      <div
        className="flex-1 flex flex-col min-h-screen relative overflow-hidden"
        style={{
          backgroundImage: "url('/images/category-campsite.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Soft Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070A13]/95 via-[#070A13]/85 to-[#070A13]/95 lg:bg-gradient-to-tr lg:from-[#070A13]/95 lg:via-[#070A13]/75 lg:to-black/40 z-0" />

        {/* Global Navigation Header Controls */}
        <div className="relative z-10 flex items-center justify-between p-4 lg:p-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-900/80 hover:border-white/20 backdrop-blur-md transition-all duration-200 shadow-sm group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-xs font-semibold">Return Home</span>
          </button>
          
          {/* Mobile Text Branding */}
          <div className="flex flex-col text-right lg:hidden">
            <span className="text-lg font-black text-[rgb(0,128,128)] tracking-wide">RealTravo</span>
            <span className="text-[8px] text-slate-500 font-mono">WWW.REALTRAVO.COM</span>
          </div>
        </div>

        {/* Dynamic Card & Onboarding Window Area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8 lg:px-8">
          <div className="w-full max-w-[420px]">
            
            {/* Conditional Render: Slides 0-2 (Onboarding Content) */}
            {slideIndex < 3 ? (
              <div className="bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-xl p-6 lg:p-8 space-y-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] text-center transition-all duration-300">
                
                {/* Onboarding Icon Asset */}
                <div className="p-3 bg-white/[0.02] border border-white/5 rounded-full w-20 h-20 flex items-center justify-center mx-auto shadow-inner">
                  {onboardingSlides[slideIndex].icon}
                </div>

                {/* Onboarding Metadata Text */}
                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">
                    {onboardingSlides[slideIndex].title}
                  </h2>
                  <p className="text-slate-300 text-xs leading-relaxed font-medium">
                    {onboardingSlides[slideIndex].description}
                  </p>
                </div>

                {/* Unified Footer Actions & Slide Navigation UI */}
                <div className="space-y-4 pt-2">
                  {/* Slider Progress Bar Dots */}
                  <div className="flex justify-center gap-1.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <button
                        key={idx}
                        onClick={() => setSlideIndex(idx)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          slideIndex === idx 
                            ? "bg-[rgb(0,128,128)] w-5" 
                            : "bg-white/20 w-1.5 hover:bg-white/40"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Primary Multi-slide Button */}
                  <button
                    onClick={handleNextSlide}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wide uppercase bg-[rgb(0,128,128)] text-white hover:bg-teal-700 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-teal-950/50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              
              /* Conditional Render: Slide 3 (Isolated Inner Form Scroll Shell) */
              <div className="bg-slate-950/45 backdrop-blur-2xl border border-white/10 rounded-xl p-6 lg:p-8 space-y-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transform transition-all duration-500 scale-[1.01] h-auto max-h-[85vh] flex flex-col overflow-hidden">
                
                {/* Back to Slides Navigation Link - FIXED POSITION */}
                <button 
                  onClick={() => setSlideIndex(2)}
                  className="text-[10px] font-semibold text-slate-400 hover:text-[rgb(0,128,128)] flex items-center gap-1 transition-colors flex-shrink-0 w-max"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to onboarding
                </button>

                {/* Header Blocks - FIXED POSITION */}
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

                {/* Segmented Controller - FIXED POSITION */}
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

                {/* Interactive Core Form Container - ISOLATED SCROLLABLE INNER LAYER */}
                <div className="mt-1 text-slate-200 max-h-[340px] overflow-y-auto pr-1 overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {activeTab === "login" ? (
                    <LoginForm onSwitchToSignup={() => setActiveTab("signup")} />
                  ) : (
                    <SignupForm onSwitchToLogin={() => setActiveTab("login")} />
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Mobile Minimal Layout Disclaimer */}
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
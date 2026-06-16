import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, MapPin, Shield, Star, Compass } from "lucide-react";

const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [slideIndex, setSlideIndex] = useState<number>(0); // Multi-slide track index
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
        <Compass className="w-10 h-10 text-[rgb(0,128,128)] animate-spin" />
      </div>
    );
  }

  const onboardingSlides = [
    {
      title: "Discover Activities & Guides",
      description: "Uncover hidden activities and hire experienced local experts to turn your trips into true stories.",
      icon: <Compass className="w-16 h-16 text-[rgb(0,128,128)] mx-auto" />
    },
    {
      title: "Trips, Hotels & Campsites",
      description: "Plan your stays seamlessly. Book luxury hotels, boutique rooms, or secure your pitch under the stars at peaceful campsites.",
      icon: <MapPin className="w-16 h-16 text-[rgb(0,128,128)] mx-auto" />
    },
    {
      title: "Host & Share Your Items",
      description: "Monetize your gear, spaces, campsites, properties, or guiding skills by hosting directly on our open marketplace.",
      icon: <Star className="w-16 h-16 text-[rgb(0,128,128)] mx-auto" />
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
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-[#121131] via-[#090D1A] to-[#03050B]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-[rgb(0,128,128)]/10 rounded-full blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          {/* Brand Identity Typography instead of image */}
          <div className="flex flex-col cursor-pointer" onClick={() => navigate("/")}>
            <span className="text-3xl font-black tracking-wider text-[rgb(0,128,128)]">RealTravo</span>
            <span className="text-xs font-mono tracking-widest text-slate-500">WWW.REALTRAVO.COM</span>
          </div>

          {/* Static High-End Branding Pitch */}
          <div className="space-y-6 my-auto max-w-md">
            <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
              Discover.<br />
              Book.<br />
              <span className="bg-gradient-to-r from-[rgb(0,128,128)] to-teal-200 bg-clip-text text-transparent">
                Experience.
              </span>
            </h1>
            <p className="text-slate-400 text-base font-medium leading-relaxed">
              Your comprehensive travel ecosystem built for curated getaways, premium active rentals, and trusted local marketplaces.
            </p>
          </div>

          <p className="text-slate-600 text-xs font-mono tracking-widest uppercase">
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
        <div className="relative z-10 flex items-center justify-between p-6 lg:p-10">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-900/40 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-900/80 hover:border-white/20 backdrop-blur-md transition-all duration-200 shadow-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-semibold">Return Home</span>
          </button>
          
          {/* Mobile Text Branding instead of image */}
          <div className="flex flex-col text-right lg:hidden">
            <span className="text-xl font-black text-[rgb(0,128,128)] tracking-wide">RealTravo</span>
            <span className="text-[9px] text-slate-500 font-mono">WWW.REALTRAVO.COM</span>
          </div>
        </div>

        {/* Dynamic Card & Onboarding Window Area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-12 lg:px-12">
          <div className="w-full max-w-[450px]">
            
            {/* Conditional Render: Slides 0-2 (Onboarding Content) */}
            {slideIndex < 3 ? (
              <div className="bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 lg:p-10 space-y-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] text-center transition-all duration-300">
                
                {/* Onboarding Icon Asset */}
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-full w-28 h-28 flex items-center justify-center mx-auto shadow-inner">
                  {onboardingSlides[slideIndex].icon}
                </div>

                {/* Onboarding Metadata Text */}
                <div className="space-y-3">
                  <h2 className="text-2xl font-extrabold text-white tracking-tight">
                    {onboardingSlides[slideIndex].title}
                  </h2>
                  <p className="text-slate-300 text-sm leading-relaxed font-medium">
                    {onboardingSlides[slideIndex].description}
                  </p>
                </div>

                {/* Unified Footer Actions & Slide Navigation UI */}
                <div className="space-y-6 pt-4">
                  {/* Slider Progress Bar Dots */}
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <button
                        key={idx}
                        onClick={() => setSlideIndex(idx)}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          slideIndex === idx 
                            ? "bg-[rgb(0,128,128)] w-6" 
                            : "bg-white/20 w-2 hover:bg-white/40"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Primary Multi-slide Button */}
                  <button
                    onClick={handleNextSlide}
                    className="w-full py-3.5 px-4 rounded-xl text-sm font-bold tracking-wide uppercase bg-[rgb(0,128,128)] text-white hover:bg-teal-700 active:scale-[0.99] transition-all duration-200 shadow-lg shadow-teal-950/50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              
              /* Conditional Render: Slide 3 (Your Glassmorphic Form Shell) */
              <div className="bg-slate-950/45 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 lg:p-10 space-y-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transform transition-all duration-500 scale-[1.01]">
                
                {/* Back to Slides Navigation Link */}
                <button 
                  onClick={() => setSlideIndex(2)}
                  className="text-xs font-semibold text-slate-400 hover:text-[rgb(0,128,128)] flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to onboarding
                </button>

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

                {/* Segmented Controller using your customized color scheme selection indicators */}
                <div className="flex bg-black/50 border border-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveTab("login")}
                    className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold rounded-lg transition-all duration-200 ${
                      activeTab === "login"
                        ? "bg-[rgb(0,128,128)] text-white shadow-md scale-[1.01]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setActiveTab("signup")}
                    className={`flex-1 py-3 text-xs uppercase tracking-wider font-bold rounded-lg transition-all duration-200 ${
                      activeTab === "signup"
                        ? "bg-[rgb(0,128,128)] text-white shadow-md scale-[1.01]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Interactive Core with Secondary forms intact */}
                <div className="mt-2 text-slate-200">
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
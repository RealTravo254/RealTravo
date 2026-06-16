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

  const initialSlide = location.state?.returnToSlideIndex !== undefined ? location.state.returnToSlideIndex : 0;
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [slideIndex, setSlideIndex] = useState<number>(initialSlide);

  if (!loading && user) { navigate(returnTo); }
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070A13] flex items-center justify-center">
        <Compass className="w-8 h-8 text-[rgb(0,128,128)] animate-spin" />
      </div>
    );
  }

  const onboardingSlides = [
    { title: "Discover Activities", description: "Hire local experts to turn trips into stories.", icon: <Compass className="w-10 h-10 text-[rgb(0,128,128)] mx-auto" /> },
    { title: "Plan Stays", description: "Book luxury hotels or secure campsites.", icon: <MapPin className="w-10 h-10 text-[rgb(0,128,128)] mx-auto" /> },
    { title: "Host Gear", description: "Monetize gear or guiding skills easily.", icon: <Star className="w-10 h-10 text-[rgb(0,128,128)] mx-auto" /> }
  ];

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-[#070A13] text-slate-100 antialiased font-sans">
      <SEOHead title="Welcome to Realtravo" description="Sign in or Sign up" />

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[40%] relative bg-gradient-to-br from-[#121131] via-[#090D1A] to-[#03050B] p-10 flex-col justify-between">
        <div className="cursor-pointer" onClick={() => navigate("/")}>
          <span className="text-2xl font-black text-[rgb(0,128,128)]">RealTravo</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black leading-tight">Discover.<br />Book.<br /><span className="text-[rgb(0,128,128)]">Experience.</span></h1>
          <p className="text-slate-400 text-sm">A comprehensive travel ecosystem.</p>
        </div>
        <p className="text-slate-600 text-[10px] uppercase">© {new Date().getFullYear()} Realtravo Inc.</p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 relative flex flex-col" style={{ backgroundImage: "url('/images/category-campsite.webp')", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0 bg-[#070A13]/90 lg:bg-[#070A13]/80 z-0" />
        
        <div className="relative z-10 flex items-center justify-between p-4">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold backdrop-blur-md">
            <ArrowLeft className="w-3 h-3" /> Return Home
          </button>
          <div className="lg:hidden text-lg font-black text-[rgb(0,128,128)]">RealTravo</div>
        </div>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-[380px]">
            {slideIndex < 3 ? (
              <div className="bg-slate-950/60 backdrop-blur-2xl border border-white/10 rounded-xl p-6 text-center space-y-4 shadow-2xl">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">{onboardingSlides[slideIndex].icon}</div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold">{onboardingSlides[slideIndex].title}</h2>
                  <p className="text-slate-400 text-xs">{onboardingSlides[slideIndex].description}</p>
                </div>
                <button onClick={() => setSlideIndex(slideIndex + 1)} className="w-full py-2 bg-[rgb(0,128,128)] rounded-lg text-xs font-bold uppercase">Continue</button>
              </div>
            ) : (
              <div className="bg-slate-950/70 backdrop-blur-3xl border border-white/10 rounded-xl p-5 space-y-3 shadow-2xl transition-all">
                <button onClick={() => setSlideIndex(2)} className="text-[10px] text-slate-500 flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>
                <div className="text-center space-y-0.5">
                  <h2 className="text-xl font-black text-white">{activeTab === "login" ? "Welcome back" : "Get started"}</h2>
                  <p className="text-slate-400 text-[11px]">{activeTab === "login" ? "Access your travel portal" : "Join the travel ecosystem"}</p>
                </div>
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                  <button onClick={() => setActiveTab("login")} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md uppercase ${activeTab === "login" ? "bg-[rgb(0,128,128)] text-white" : "text-slate-500"}`}>Sign In</button>
                  <button onClick={() => setActiveTab("signup")} className={`flex-1 py-1.5 text-[10px] font-bold rounded-md uppercase ${activeTab === "signup" ? "bg-[rgb(0,128,128)] text-white" : "text-slate-500"}`}>Sign Up</button>
                </div>
                <div className="pt-1">
                  {activeTab === "login" ? <LoginForm onSwitchToSignup={() => setActiveTab("signup")} /> : <SignupForm onSwitchToLogin={() => setActiveTab("login")} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default Auth;
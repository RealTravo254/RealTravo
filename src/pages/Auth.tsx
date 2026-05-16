import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, MapPin, Shield, Star } from "lucide-react";

const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as any)?.returnTo || "/";

  // Safely handle navigation after rendering finishes
  useEffect(() => {
    if (!loading && user) {
      navigate(returnTo, { replace: true });
    }
  }, [user, loading, navigate, returnTo]);
 
  if (loading) {
    return <div className="min-h-screen bg-background animate-pulse" />;
  }

  // If the user is logged in, show an empty state temporarily while the useEffect redirects
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <SEOHead
        title="Sign In or Sign Up | Realtravo"
        description="Create an account or sign in to Realtravo to book trips, save favorites, and manage your travel experiences."
      />

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden bg-primary">
        <div className="flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <img src="/fulllogo.png" alt="Realtravo" className="h-10 brightness-0 invert" />
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-5xl font-extrabold text-primary-foreground leading-[1.1] tracking-tight">
                Discover.<br />
                Book.<br />
                <span className="text-primary-foreground/70">Experience.</span>
              </h1>
              <p className="mt-6 text-primary-foreground/60 text-lg max-w-sm leading-relaxed">
                Your gateway to curated adventures, events and unforgettable trips.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {[
                { icon: MapPin, text: "Handpicked stays, trips & adventures" },
                { icon: Shield, text: "Book with confidence, pay securely" },
                { icon: Star, text: "Real reviews from real travelers" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary-foreground/80" />
                  </div>
                  <span className="text-primary-foreground/70 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-primary-foreground/30 text-xs">
            © {new Date().getFullYear()} Realtravo. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Forms with background image */}
      <div
        className="flex-1 flex flex-col min-h-screen relative"
        style={{
          backgroundImage: "url('/images/category-campsite.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60 z-0" />

        {/* Mobile top bar */}
        <div className="relative z-10 flex items-center justify-between p-4 lg:p-8 lg:pb-0">
          <button
            onClick={() => navigate("/")}
            className="hidden lg:flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <img src="/fulllogo.png" alt="Realtravo" className="h-7 lg:hidden brightness-0 invert" />
          <div className="w-16 lg:hidden" />
        </div>

        {/* Form area */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 lg:px-12">
          <div className="w-full max-w-[420px]">
            {/* Glass card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 space-y-6 shadow-xl">

              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {activeTab === "login" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="mt-1 text-white/60 text-sm">
                  {activeTab === "login"
                    ? "Sign in to continue your journey"
                    : "Join Realtravo and start exploring"}
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex bg-white/10 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setActiveTab("login")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === "login"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab("signup")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === "signup"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Forms */}
              <div>
                {activeTab === "login" ? (
                  <LoginForm onSwitchToSignup={() => setActiveTab("signup")} />
                ) : (
                  <SignupForm />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile footer */}
        <div className="relative z-10 p-4 text-center lg:hidden">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Realtravo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
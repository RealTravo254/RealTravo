import { useEffect } from "react";
import { X } from "lucide-react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

export const AuthModal = () => {
  const { isOpen, activeTab, setActiveTab, closeAuthModal } = useAuthModal();

  // Lock page scroll while the modal is open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuthModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeAuthModal]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <div
        className="w-full max-w-[420px] bg-slate-950/90 backdrop-blur-2xl border border-white/10 rounded-xl p-6 lg:p-8 space-y-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] relative max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeAuthModal}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-1 text-center flex-shrink-0">
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

        <div className="mt-1 text-slate-200 overflow-y-auto pr-1 overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {activeTab === "login" ? (
            <LoginForm
              onSwitchToSignup={() => setActiveTab("signup")}
              onAuthSuccess={closeAuthModal}
            />
          ) : (
            <SignupForm
              onSwitchToLogin={() => setActiveTab("login")}
              onSignupSuccess={() => setActiveTab("login")}
            />
          )}
        </div>
      </div>
    </div>
  );
};
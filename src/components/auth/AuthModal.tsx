import { useEffect } from "react";
import { X } from "lucide-react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { useGoogleAuthGuard } from "@/hooks/useGoogleAuthGuard";

export const AuthModal = () => {
  const { isOpen, activeTab, setActiveTab, closeAuthModal } = useAuthModal();

  // If someone hits "Continue with Google" on the LOGIN tab but no account
  // exists for that Google email yet, Supabase would otherwise silently
  // create one. This catches that case after the redirect back and bounces
  // them to Sign Up instead.
  //
  // NOTE: this only flips activeTab. If AuthModalContext exposes a way to
  // *open* the modal (e.g. `openAuthModal`), call that here too so the modal
  // is actually visible on landing back from Google — right now this assumes
  // the modal (or page) is already open/visible when the redirect completes.
  useGoogleAuthGuard({
    onNoAccountFound: () => setActiveTab("signup"),
  });

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
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <div
        className="w-full max-w-[420px] bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] relative max-h-[90vh] flex flex-col overflow-visible animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={closeAuthModal}
          aria-label="Close"
          className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-1 text-center flex-shrink-0">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {activeTab === "login" ? "Welcome back" : "Get started"}
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            {activeTab === "login"
              ? "Sign in to plan and access your luxury portals"
              : "Create an account to embark on custom journeys"}
          </p>
        </div>

        <div className="flex bg-slate-100 border border-slate-200 p-0.5 rounded-lg flex-shrink-0">
          <button
            onClick={() => setActiveTab("login")}
            className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all duration-200 ${
              activeTab === "login"
                ? "bg-[rgb(0,128,128)] text-white shadow-md scale-[1.01]"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setActiveTab("signup")}
            className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all duration-200 ${
              activeTab === "signup"
                ? "bg-[rgb(0,128,128)] text-white shadow-md scale-[1.01]"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Sign Up
          </button>
        </div>

        <div className="mt-1 text-slate-900 overflow-y-auto overflow-x-visible pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
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
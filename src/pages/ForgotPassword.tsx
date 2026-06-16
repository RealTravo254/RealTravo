import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPassword() {
  const [step, setStep] = useState<'email' | 'verify' | 'reset'>('email');
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });
      if (error) throw error;
      setStep('verify');
      setCountdown(60);
      setCanResend(false);
    } catch (err: any) {
      setError(err.message || "Failed to send code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setVerifying(true);
    setError("");
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) throw error;
      setStep('reset');
    } catch (err: any) {
      setError("Invalid or expired validation code.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      navigate("/auth");
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 w-screen h-screen z-[99999] flex flex-col justify-center items-center font-sans antialiased bg-[#070A13] px-4 overflow-hidden select-none"
      style={{
        backgroundImage: "url('/images/category-campsite.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Absolute Backdrop Gradient Matching Auth Page */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#070A13]/95 via-[#070A13]/85 to-[#070A13]/95 lg:bg-gradient-to-tr lg:from-[#070A13]/95 lg:via-[#070A13]/75 lg:to-black/40 z-0" />

      {/* Global Sticky Top Bar Header */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 lg:p-8">
        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/40 border border-white/10 text-slate-300 hover:text-white backdrop-blur-md text-xs font-semibold transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Login
        </button>
        <div className="text-right">
          <span className="text-lg font-black text-[rgb(0,128,128)] tracking-wide">RealTravo</span>
          <span className="block text-[8px] text-slate-500 font-mono">WWW.REALTRAVO.COM</span>
        </div>
      </div>

      {/* Main Container Assembly Card */}
      <div className="relative z-10 w-full max-w-[390px]">
        <div className="bg-slate-950/70 backdrop-blur-3xl border border-white/10 rounded-xl p-6 space-y-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col">
          
          {/* Step Back Control Link */}
          <button 
            type="button"
            onClick={() => step === 'email' ? navigate("/auth") : setStep('email')}
            className="text-[10px] font-bold text-slate-500 hover:text-[rgb(0,128,128)] flex items-center gap-1 transition-colors w-max uppercase tracking-wider"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            {step === 'email' ? "Cancel" : "Change Email"}
          </button>

          {/* Core Multi-Step Form Logic */}
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="text-center space-y-1.5">
                <div className="bg-[rgb(0,128,128)]/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(0,128,128)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Recovery</h2>
                <p className="text-slate-400 text-[10px] tracking-wider uppercase leading-relaxed px-2">Enter your email address below to receive a secure access token</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-0.5">Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-black/40 border border-white/10 rounded-md text-white placeholder:text-slate-600 focus:outline-none focus:border-[rgb(0,128,128)] transition-colors"
                  required
                />
              </div>

              {error && <p className="text-[10px] text-red-400 font-bold bg-red-950/40 p-2.5 rounded border border-red-500/20 uppercase tracking-wide">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-[rgb(0,128,128)] hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-widest rounded-md transition-colors disabled:opacity-50 shadow-lg shadow-teal-950/50"
              >
                {loading ? "Sending Token..." : "Send Reset Code"}
              </button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-1.5">
                <div className="bg-[rgb(0,128,128)]/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(0,128,128)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Verify Token</h2>
                <p className="text-slate-400 text-[10px] tracking-wider uppercase leading-relaxed">Enter the 6-digit confirmation code dispatched to your email inbox</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-0.5">Verification Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-10 text-center tracking-[1em] text-base font-black bg-black/40 border border-white/10 rounded-md text-[rgb(0,128,128)] focus:outline-none focus:border-[rgb(0,128,128)] transition-colors placeholder:text-slate-800 placeholder:tracking-normal"
                  required
                />
              </div>

              {error && <p className="text-[10px] text-red-400 font-bold bg-red-950/40 p-2.5 rounded border border-red-500/20 uppercase tracking-wide">{error}</p>}

              <button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="w-full h-9 bg-[rgb(0,128,128)] hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-widest rounded-md transition-colors disabled:opacity-40 shadow-lg shadow-teal-950/50"
              >
                {verifying ? "Validating..." : "Confirm Security Code"}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  disabled={!canResend}
                  onClick={handleSendCode}
                  className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-white disabled:opacity-30"
                >
                  Resend Code {countdown > 0 ? `(${countdown}s)` : ""}
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="text-center space-y-1.5">
                <div className="bg-[rgb(0,128,128)]/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mx-auto shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(0,128,128)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">New Credentials</h2>
                <p className="text-slate-400 text-[10px] tracking-wider uppercase leading-relaxed">Update your account with a secure unique password</p>
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-0.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-9 px-3 pr-9 text-xs bg-black/40 border border-white/10 rounded-md text-white focus:outline-none focus:border-[rgb(0,128,128)] transition-colors"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-0.5">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-9 px-3 pr-9 text-xs bg-black/40 border border-white/10 rounded-md text-white focus:outline-none focus:border-[rgb(0,128,128)] transition-colors"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error && <p className="text-[10px] text-red-400 font-bold bg-red-950/40 p-2.5 rounded border border-red-500/20 uppercase tracking-wide">{error}</p>}

              <button
                type="submit"
                disabled={loading || !newPassword || newPassword !== confirmPassword}
                className="w-full h-9 mt-2 bg-[rgb(0,128,128)] hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-widest rounded-md transition-colors disabled:opacity-40 shadow-lg shadow-teal-950/50"
              >
                {loading ? "Saving Password..." : "Update Password"}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
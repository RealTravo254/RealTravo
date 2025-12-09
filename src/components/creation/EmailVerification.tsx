import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle2, XCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface EmailVerificationProps {
  email: string;
  onEmailChange: (email: string) => void;
  isVerified: boolean;
  onVerificationChange: (verified: boolean) => void;
  required?: boolean;
}

export const EmailVerification = ({
  email,
  onEmailChange,
  isVerified,
  onVerificationChange,
  required = false
}: EmailVerificationProps) => {
  const { toast } = useToast();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationAttempted, setVerificationAttempted] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive"
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        }
      });

      if (error) throw error;

      setOtpSent(true);
      setOtp("");
      setVerificationAttempted(false);
      onVerificationChange(false);
      
      toast({
        title: "Verification Code Sent",
        description: "Please check your email for the 6-digit code",
      });
    } catch (error: any) {
      toast({
        title: "Error Sending Code",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the complete 6-digit code",
        variant: "destructive"
      });
      return;
    }

    setVerifying(true);
    setVerificationAttempted(true);
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email'
      });

      if (error) throw error;

      onVerificationChange(true);
      toast({
        title: "Email Verified!",
        description: "Your email has been successfully verified",
      });
    } catch (error: any) {
      onVerificationChange(false);
      toast({
        title: "Verification Failed",
        description: "The code you entered is incorrect",
        variant: "destructive"
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleEmailChange = (newEmail: string) => {
    onEmailChange(newEmail);
    // Reset verification state when email changes
    if (newEmail !== email) {
      setOtpSent(false);
      setOtp("");
      setVerificationAttempted(false);
      onVerificationChange(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">
          Email {required && "*"}
          {isVerified && (
            <span className="ml-2 text-green-600 text-sm inline-flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Verified
            </span>
          )}
          {verificationAttempted && !isVerified && (
            <span className="ml-2 text-destructive text-sm inline-flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              Not Verified
            </span>
          )}
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required={required}
              className="pl-10"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="contact@example.com"
              disabled={isVerified}
            />
          </div>
          {!isVerified && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSendOtp}
              disabled={sending || !email}
              className="shrink-0"
            >
              {sending ? "Sending..." : otpSent ? "Resend Code" : "Send Code"}
            </Button>
          )}
        </div>
      </div>

      {otpSent && !isVerified && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
          <Label htmlFor="otp">Enter 6-Digit Verification Code</Label>
          <div className="flex items-center gap-3">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                // Auto-submit when 6 digits entered
                if (value.length === 6) {
                  setTimeout(() => {
                    handleVerifyOtp(value);
                  }, 100);
                }
              }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            {verifying && (
              <span className="text-sm text-muted-foreground">Verifying...</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Check your email for the verification code
          </p>
        </div>
      )}
    </div>
  );
};

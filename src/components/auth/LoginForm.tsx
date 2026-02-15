import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

type FormErrors = {
  email?: string;
  password?: string;
};

export const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("email")) {
        setErrors({ email: error.message });
      } else if (error.message.toLowerCase().includes("password")) {
        setErrors({ password: error.message });
      } else {
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      navigate("/");
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    toast({
      title: "Connecting to Google...",
      description: "Please wait while we redirect you",
    });
    const redirectUrl = `${window.location.origin}/`;
    
    // On mobile, try to open Google auth in a smaller popup window
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: { prompt: 'select_account' },
        },
      });
      
      if (error) {
        setLoading(false);
        toast({ title: "Google login failed", description: error.message, variant: "destructive" });
        return;
      }
      
      if (data?.url) {
        // Open in a centered popup window instead of full redirect
        const width = 500;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        const popup = window.open(
          data.url,
          'google-auth',
          `width=${width},height=${height},top=${top},left=${left},toolbar=no,menubar=no`
        );
        
        // If popup blocked, fall back to redirect
        if (!popup || popup.closed) {
          window.location.href = data.url;
        } else {
          // Poll for popup close to refresh auth state
          const interval = setInterval(async () => {
            if (popup.closed) {
              clearInterval(interval);
              setLoading(false);
              // Check if user signed in
              const { data: session } = await supabase.auth.getSession();
              if (session?.session) {
                navigate("/");
              }
            }
          }, 500);
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) {
        setLoading(false);
        toast({ title: "Google login failed", description: error.message, variant: "destructive" });
      }
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={errors.email ? "border-destructive" : ""}
          required
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={errors.password ? "border-destructive" : ""}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Logging in..." : "Login"}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          className="text-sm text-primary hover:underline"
        >
          Forgot password?
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      {/* Branded Google Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-gray-200"
      >
        {/* Google Multi-Color Border Bottom */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full flex">
          <div className="h-full w-1/4 bg-[#4285F4]" /> {/* Blue */}
          <div className="h-full w-1/4 bg-[#EA4335]" /> {/* Red */}
          <div className="h-full w-1/4 bg-[#FBBC05]" /> {/* Yellow */}
          <div className="h-full w-1/4 bg-[#34A853]" /> {/* Green */}
        </div>

        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span className="font-semibold transition-colors duration-200 group-hover:text-red-600">
          Continue with Google
        </span>
      </button>

      <div className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={() => {
            const tabTrigger = document.querySelector('[value="signup"]') as HTMLElement;
            tabTrigger?.click();
          }}
          className="text-primary hover:underline font-medium"
        >
          Join
        </button>
      </div>
    </form>
  );
};
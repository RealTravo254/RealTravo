import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
// Import components. The `rounded-none` class is applied below where possible.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

// Define the specified TEAL color (#008080)
const TEAL_COLOR = "#008080";
const TEAL_HOVER_COLOR = "#005555"; // A darker shade of teal for hover

const Auth = () => {
  const [activeTab, setActiveTab] = useState("login");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  // Function to handle switching tabs from within the form components
  const handleSwitchTab = (tabName: "login" | "signup") => {
    setActiveTab(tabName);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container px-4 py-8 max-w-md mx-auto">
        {/* Back Button styling uses TEAL color */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
          style={{ color: TEAL_COLOR }} // Uses TEAL_COLOR
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* TabsList and TabsTrigger control styling typically managed by Tailwind configuration */}
          <TabsList className="grid w-full grid-cols-2 rounded-none">
            <TabsTrigger value="login" className="rounded-none">Login</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-none">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card className="rounded-none">
              <CardHeader>
                <CardTitle>Login to your account</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Passes TEAL color properties for the Login button */}
                <LoginForm 
                  onSwitchToSignup={() => handleSwitchTab("signup")} 
                  primaryColor={TEAL_COLOR} // Passes TEAL_COLOR
                  primaryHoverColor={TEAL_HOVER_COLOR} // Passes TEAL_HOVER_COLOR
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="rounded-none">
              <CardHeader>
                <CardTitle>Create an account</CardTitle>
                <CardDescription>
                  Sign up to start creating and booking
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Passes TEAL color properties for the Sign Up button */}
                <SignupForm 
                  onSwitchToLogin={() => handleSwitchTab("login")} 
                  primaryColor={TEAL_COLOR} // Passes TEAL_COLOR
                  primaryHoverColor={TEAL_HOVER_COLOR} // Passes TEAL_HOVER_COLOR
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <MobileBottomBar />
      {/* Footer is not shown, but Header/MobileBottomBar might need similar styling if they contain blue elements */}
      <Footer />
    </div>
  );
};
export default Auth;
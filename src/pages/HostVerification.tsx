import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// Assuming MultiStepForm handles internal styling, we'll try to pass color if possible, 
// but we'll focus on elements we can directly control.
import { MultiStepForm } from "@/components/creation/MultiStepForm"; 
import { Upload, CheckCircle2 } from "lucide-react";

// Define the specified Teal color
const TEAL_COLOR = "#008080";
const TEAL_HOVER_COLOR = "#005555"; // A darker shade of teal for hover

const HostVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [existingVerification, setExistingVerification] = useState<any>(null);

  // Form state
  const [legalName, setLegalName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      // Fetch user profile to auto-populate name
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profileData?.name) {
        setLegalName(profileData.name);
      }

      // Check if user already has a verification
      const { data, error } = await supabase
        .from("host_verifications")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setExistingVerification(data);
        
        // If approved, redirect to become host
        if (data.status === "approved") {
          navigate("/become-host");
        }
      }
    };

    fetchData();
  }, [user, navigate]);

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from("verification-documents")
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("verification-documents")
      .getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!legalName || !streetAddress || !city || !documentType) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }
    } else if (currentStep === 2) {
      if (!documentFront || (documentType !== "passport" && !documentBack)) {
        toast({
          title: "Missing Documents",
          description: "Please upload all required documents.",
          variant: "destructive",
        });
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!selfie) {
      toast({
        title: "Missing Selfie",
        description: "Please upload your selfie.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Ensure profile exists first
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", user!.id)
        .maybeSingle();

      if (profileCheckError) {
        console.error("Profile check error:", profileCheckError);
        throw new Error("Failed to verify user profile. Please contact support.");
      }

      // If no profile exists, create one
      if (!existingProfile) {
        const { error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            id: user!.id,
            name: legalName,
            email: user!.email || "",
          });

        if (createProfileError) {
          console.error("Profile creation error:", createProfileError);
          throw new Error("Failed to create user profile. Please try again.");
        }
      } else if (existingProfile.name !== legalName) {
        // Update profile name if it was edited during verification
        const { error: updateProfileError } = await supabase
          .from("profiles")
          .update({ name: legalName })
          .eq("id", user!.id);

        if (updateProfileError) {
          console.error("Profile update error:", updateProfileError);
        }
      }

      // Upload files
      const frontUrl = await uploadFile(documentFront!, `${user!.id}/document_front_${Date.now()}`);
      const backUrl = documentBack 
        ? await uploadFile(documentBack, `${user!.id}/document_back_${Date.now()}`)
        : null;
      const selfieUrl = await uploadFile(selfie, `${user!.id}/selfie_${Date.now()}`);

      // Insert or update verification
      const verificationData = {
        user_id: user!.id,
        legal_name: legalName,
        street_address: streetAddress,
        city: city,
        postal_code: postalCode || null,
        document_type: documentType,
        document_front_url: frontUrl,
        document_back_url: backUrl,
        selfie_url: selfieUrl,
        status: "pending",
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
      };

      // Check if verification exists
      const { data: existingVer } = await supabase
        .from("host_verifications")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      let verificationError;
      if (existingVer) {
        // Update existing verification
        const { error } = await supabase
          .from("host_verifications")
          .update(verificationData)
          .eq("user_id", user!.id);
        verificationError = error;
      } else {
        // Insert new verification
        const { error } = await supabase
          .from("host_verifications")
          .insert(verificationData);
        verificationError = error;
      }

      if (verificationError) {
        console.error("Verification insert/update error:", verificationError);
        throw verificationError;
      }

      toast({
        title: "Submission Successful",
        description: "Your identity is currently under review. We will notify you of the result soon.",
      });

      navigate("/verification-status");
    } catch (error: any) {
      console.error("Verification submission error:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Common button styles for teal color
  const getTealButtonStyle = (variant: 'default' | 'outline' = 'default') => {
    if (variant === 'default') {
      return {
        backgroundColor: TEAL_COLOR,
        borderColor: TEAL_COLOR,
        color: 'white',
        transition: 'background-color 0.15s',
      };
    } else { // outline variant is not used in this component, but for completeness
      return {
        color: TEAL_COLOR,
        borderColor: TEAL_COLOR,
        transition: 'color 0.15s, border-color 0.15s',
      };
    }
  };
  
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget.style as any).backgroundColor = TEAL_HOVER_COLOR;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    (e.currentTarget.style as any).backgroundColor = TEAL_COLOR;
  };


  // If user has pending verification, show status
  if (existingVerification && existingVerification.status === "pending") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
          <Card className="max-w-2xl mx-auto p-8 text-center">
            {/* Icon color changed to Teal */}
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: TEAL_COLOR }} />
            <h1 className="text-2xl font-bold mb-4">Verification Pending</h1>
            <p className="text-muted-foreground mb-6">
              Your identity verification is currently under review. We will notify you of the result soon.
            </p>
            {/* Button color changed to Teal */}
            <Button 
              onClick={() => navigate("/")}
              style={getTealButtonStyle()}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              Return to Home
            </Button>
          </Card>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  // If rejected, allow re-submission
  if (existingVerification && existingVerification.status === "rejected") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
          <Card className="max-w-2xl mx-auto p-8">
            <h1 className="text-2xl font-bold mb-4 text-destructive">Verification Failed</h1>
            <div className="bg-destructive/10 p-4 rounded-md mb-6">
              <p className="font-semibold mb-2">Rejection Reason:</p>
              <p className="text-muted-foreground">{existingVerification.rejection_reason}</p>
            </div>
            {/* Button color changed to Teal */}
            <Button 
              onClick={() => setExistingVerification(null)} 
              className="w-full"
              style={getTealButtonStyle()}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              Start Verification Process Again
            </Button>
          </Card>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mb-20 md:mb-0">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-2 text-center">Verify Your Identity to Become a Host</h1>
          <p className="text-muted-foreground mb-8 text-center">
            Complete the following steps to verify your identity and gain access to hosting features.
          </p>

          <MultiStepForm
            currentStep={currentStep}
            totalSteps={3}
            title={
              currentStep === 1
                ? "Identity Details"
                : currentStep === 2
                ? "Document Uploads"
                : "Liveness Check"
            }
            description={
              currentStep === 1
                ? "Provide your legal information"
                : currentStep === 2
                ? "Upload your government-issued documents"
                : "Upload a selfie for verification"
            }
            onNext={handleNext}
            onPrev={handlePrev}
            onSubmit={handleSubmit}
            nextDisabled={false}
            isLoading={isLoading}
            // Passing the color to MultiStepForm assuming it accepts a primaryColor prop
            // If MultiStepForm is a custom component, it needs to be updated to respect this prop.
            // Since we can't edit MultiStepForm, we rely on button styles below.
            // primaryColor={TEAL_COLOR} 
          >
            {currentStep === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="legalName">Legal Name (Must match government ID) *</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Enter your full legal name"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-filled from your profile. You can edit it to match your ID - this will update your profile name.
                  </p>
                </div>
                <div>
                  <Label htmlFor="streetAddress">Street Address *</Label>
                  <Input
                    id="streetAddress"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Enter your street address"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter your city"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal Code (Optional)</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Enter your postal code"
                  />
                </div>
                <div>
                  <Label htmlFor="documentType">Government Document Type *</Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national_id">National ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving_licence">Driving Licence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="documentFront">Upload Front Side of Document *</Label>
                  <div className="mt-2">
                    <Input
                      id="documentFront"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDocumentFront(e.target.files?.[0] || null)}
                      required
                    />
                    {documentFront && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {/* Icon color changed to Teal (was text-green-600) */}
                        <CheckCircle2 className="h-4 w-4 inline mr-1" style={{ color: TEAL_COLOR }} /> 
                        {documentFront.name}
                      </p>
                    )}
                  </div>
                </div>

                {documentType !== "passport" && (
                  <div>
                    <Label htmlFor="documentBack">Upload Back Side of Document *</Label>
                    <div className="mt-2">
                      <Input
                        id="documentBack"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setDocumentBack(e.target.files?.[0] || null)}
                        required
                      />
                      {documentBack && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {/* Icon color changed to Teal (was text-green-600) */}
                          <CheckCircle2 className="h-4 w-4 inline mr-1" style={{ color: TEAL_COLOR }} />
                          {documentBack.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {documentType === "passport" && (
                  <p className="text-sm text-muted-foreground">
                    Back side upload is not required for passport.
                  </p>
                )}
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="selfie">Upload a Clear Selfie *</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Please upload a clear photo of yourself. This will be used to verify your identity.
                  </p>
                  <div className="mt-2">
                    <Input
                      id="selfie"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelfie(e.target.files?.[0] || null)}
                      required
                    />
                    {selfie && (
                      <div className="mt-4">
                        <img
                          src={URL.createObjectURL(selfie)}
                          alt="Selfie preview"
                          className="max-w-xs mx-auto rounded-lg border"
                        />
                        <p className="text-sm text-muted-foreground mt-2 text-center">
                          {/* Icon color changed to Teal (was text-green-600) */}
                          <CheckCircle2 className="h-4 w-4 inline mr-1" style={{ color: TEAL_COLOR }} />
                          {selfie.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </MultiStepForm>
        </div>
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default HostVerification;
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiStepForm } from "@/components/creation/MultiStepForm";
import { DocumentUploadWithCamera } from "@/components/verification/DocumentUploadWithCamera";
import { CheckCircle2 } from "lucide-react";

const TEAL_COLOR = "#008080";
const TEAL_HOVER_COLOR = "#005555";

const HostVerification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [existingVerification, setExistingVerification] = useState<any>(null);
  const [hostingCategory, setHostingCategory] = useState<string | null>(null);

  const [legalName, setLegalName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentFront, setDocumentFront] = useState<File | null>(null);
  const [documentBack, setDocumentBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [traLicense, setTraLicense] = useState<File | null>(null);
  const [traLicensePreview, setTraLicensePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const category = params.get("category");
    if (category) setHostingCategory(category);

    const fetchData = async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profileData?.name) setLegalName(profileData.name);

      const { data, error } = await supabase
        .from("host_verifications")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setExistingVerification(data);
        if (data.status === "approved") navigate("/become-host");
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
        toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
        return;
      }
      if ((hostingCategory === 'guide' || hostingCategory === 'company') && !registrationNumber.trim()) {
        toast({ title: "Missing Information", description: "Registration number is required.", variant: "destructive" });
        return;
      }
    } else if (currentStep === 2) {
      if (!documentFront || (documentType !== "passport" && !documentBack)) {
        toast({ title: "Missing Documents", description: "Please upload all required documents.", variant: "destructive" });
        return;
      }
    }
    setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => setCurrentStep(currentStep - 1);

  const handleSubmit = async () => {
    if (!selfie) {
      toast({ title: "Missing Selfie", description: "Please upload your selfie.", variant: "destructive" });
      return;
    }
    if (!traLicense) {
      toast({ title: "TRA License Required", description: "Please upload your TRA license image to prove regulation.", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from("profiles").select("id, name").eq("id", user!.id).maybeSingle();

      if (profileCheckError) throw new Error("Failed to verify user profile.");

      if (!existingProfile) {
        const { error: createProfileError } = await supabase
          .from("profiles").insert({ id: user!.id, name: legalName, email: user!.email || "" });
        if (createProfileError) throw new Error("Failed to create user profile.");
      } else if (existingProfile.name !== legalName) {
        await supabase.from("profiles").update({ name: legalName }).eq("id", user!.id);
      }

      const frontUrl = await uploadFile(documentFront!, `${user!.id}/document_front_${Date.now()}`);
      const backUrl = documentBack ? await uploadFile(documentBack, `${user!.id}/document_back_${Date.now()}`) : null;
      const selfieUrl = await uploadFile(selfie, `${user!.id}/selfie_${Date.now()}`);
      const traUrl = await uploadFile(traLicense, `${user!.id}/tra_license_${Date.now()}`);

      const verificationData: Record<string, any> = {
        user_id: user!.id, legal_name: legalName, street_address: streetAddress,
        city, postal_code: postalCode || null, document_type: documentType,
        document_front_url: frontUrl, document_back_url: backUrl, selfie_url: selfieUrl,
        tra_license_url: traUrl, status: "pending", rejection_reason: null,
        submitted_at: new Date().toISOString(), hosting_category: hostingCategory || null,
        registration_number: registrationNumber.trim() || null,
      };

      const { data: existingVer } = await supabase
        .from("host_verifications").select("id").eq("user_id", user!.id).maybeSingle();

      let verificationError;
      if (existingVer) {
        const { error } = await supabase.from("host_verifications").update(verificationData as any).eq("user_id", user!.id);
        verificationError = error;
      } else {
        const { error } = await supabase.from("host_verifications").insert(verificationData as any);
        verificationError = error;
      }

      if (verificationError) throw verificationError;

      toast({ title: "Submission Successful", description: "Your identity is currently under review." });
      navigate("/verification-status");
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message || "Failed to submit verification.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const getTealButtonStyle = () => ({
    backgroundColor: TEAL_COLOR, borderColor: TEAL_COLOR, color: 'white', transition: 'background-color 0.15s',
  });
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget.style as any).backgroundColor = TEAL_HOVER_COLOR; };
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => { (e.currentTarget.style as any).backgroundColor = TEAL_COLOR; };

  // ── PENDING STATE ─────────────────────────────────────────────────────────
  if (existingVerification && existingVerification.status === "pending") {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
        <Header />
        <main className="flex-1 container px-4 py-8 flex items-center justify-center">
          <Card className="max-w-2xl w-full p-8 text-center shadow-lg rounded-[24px]">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: TEAL_COLOR }} />
            <h1 className="text-2xl font-black uppercase tracking-tight mb-4">Verification Pending</h1>
            <p className="text-muted-foreground mb-6">
              Your identity verification is currently under review. We will notify you of the result soon.
            </p>
            <Button onClick={() => navigate("/")} style={getTealButtonStyle()} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="px-8 rounded-xl">
              Return to Home
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  // ── REJECTED STATE ────────────────────────────────────────────────────────
  if (existingVerification && existingVerification.status === "rejected") {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
        <Header />
        <main className="flex-1 container px-4 py-8 flex items-center justify-center">
          <Card className="max-w-2xl w-full p-8 shadow-lg rounded-[24px]">
            <h1 className="text-2xl font-black uppercase tracking-tight mb-4 text-destructive">Verification Failed</h1>
            <div className="bg-destructive/10 p-4 rounded-xl mb-6">
              <p className="font-semibold mb-2">Rejection Reason:</p>
              <p className="text-muted-foreground">{existingVerification.rejection_reason}</p>
            </div>
            <Button onClick={() => setExistingVerification(null)} className="w-full rounded-xl" style={getTealButtonStyle()} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
              Start Verification Process Again
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  // ── MAIN FORM ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] pb-0">
      <Header />
      <main className="flex-1 container px-4 py-8">
        <div className="mx-auto">
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-2 text-center">
            Verify Your Identity
          </h1>
          <p className="text-muted-foreground mb-8 text-center text-sm">
            Complete the following steps to gain access to hosting features.
          </p>

          <MultiStepForm
            currentStep={currentStep}
            totalSteps={3}
            title={
              currentStep === 1 ? "Identity Details"
              : currentStep === 2 ? "Document Uploads"
              : "Liveness Check"
            }
            description={
              currentStep === 1 ? "Provide your legal information"
              : currentStep === 2 ? "Upload your government-issued documents"
              : "Upload a selfie for verification"
            }
            onNext={handleNext}
            onPrev={handlePrev}
            onSubmit={handleSubmit}
            nextDisabled={false}
            isLoading={isLoading}
          >
            {/* ── STEP 1 : Identity Details ─────────────────────────────── */}
            {currentStep === 1 && (
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* Legal Name — full width */}
                <div className="col-span-2">
                  <Label htmlFor="legalName" className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">
                    Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Full legal name (must match ID)"
                    className="rounded-xl border-slate-200 focus:border-[#008080] focus:ring-[#008080]"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Auto-filled from your profile. Edit to match your ID.</p>
                </div>

                {/* Street Address — full width */}
                <div className="col-span-2">
                  <Label htmlFor="streetAddress" className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">
                    Street Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="streetAddress"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Enter your street address"
                    className="rounded-xl border-slate-200 focus:border-[#008080] focus:ring-[#008080]"
                    required
                  />
                </div>

                {/* City — left col */}
                <div>
                  <Label htmlFor="city" className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="rounded-xl border-slate-200 focus:border-[#008080] focus:ring-[#008080]"
                    required
                  />
                </div>

                {/* Postal Code — right col */}
                <div>
                  <Label htmlFor="postalCode" className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">
                    Postal Code
                  </Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Postal code"
                    className="rounded-xl border-slate-200 focus:border-[#008080] focus:ring-[#008080]"
                  />
                </div>

                {/* Document Type — full width */}
                <div className="col-span-2">
                  <Label htmlFor="documentType" className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">
                    Government Document Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="rounded-xl border-slate-200 focus:border-[#008080] focus:ring-[#008080]">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national_id">National ID</SelectItem>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="driving_licence">Driving Licence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Registration Number — full width, conditional */}
                {(hostingCategory === 'guide' || hostingCategory === 'company') && (
                  <div className="col-span-2">
                    <Label htmlFor="registrationNumber" className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 block">
                      Registration Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="registrationNumber"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g. BN-X12345 or guide license number"
                      className="rounded-xl border-slate-200 focus:border-[#008080] focus:ring-[#008080]"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {hostingCategory === 'guide' ? 'Your tour guide license or registration number' : 'Your company registration number'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2 : Document Uploads ─────────────────────────────── */}
            {currentStep === 2 && (
              <div className="grid grid-cols-2 gap-4">
                {/* Front — always shown, full width if passport (only one card), else left col */}
                <div className={documentType === "passport" ? "col-span-2" : "col-span-2 md:col-span-1"}>
                  <DocumentUploadWithCamera
                    documentType={documentType as any}
                    label={documentType === "passport" ? "Passport Photo Page" : "Front Side of Document"}
                    side="front"
                    file={documentFront}
                    onFileChange={setDocumentFront}
                    required
                  />
                </div>

                {/* Back — right col, hidden for passport */}
                {documentType !== "passport" && (
                  <div className="col-span-2 md:col-span-1">
                    <DocumentUploadWithCamera
                      documentType={documentType as any}
                      label="Back Side of Document"
                      side="back"
                      file={documentBack}
                      onFileChange={setDocumentBack}
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3 : Liveness Check ───────────────────────────────── */}
            {currentStep === 3 && (
              <div className="grid grid-cols-2 gap-4">
                {/* Selfie — left col */}
                <div className="col-span-2 md:col-span-1">
                  <DocumentUploadWithCamera
                    documentType={documentType as any}
                    label="Selfie for Verification"
                    side="selfie"
                    file={selfie}
                    onFileChange={setSelfie}
                    required
                  />
                </div>

                {/* TRA License — right col */}
                <div className="col-span-2 md:col-span-1">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500 block">
                      TRA License <span className="text-red-500">*</span>
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Upload your TRA (Tanzania Revenue Authority) license to prove you are regulated to host.
                    </p>
                    {traLicensePreview ? (
                      <div className="relative rounded-xl overflow-hidden border-2 border-dashed" style={{ borderColor: TEAL_COLOR }}>
                        <img src={traLicensePreview} alt="TRA License" className="w-full h-48 object-cover" />
                        <button
                          type="button"
                          onClick={() => { setTraLicense(null); setTraLicensePreview(null); }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <div
                          className="h-32 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl transition-all hover:bg-teal-50"
                          style={{ borderColor: TEAL_COLOR }}
                        >
                          <span className="text-xs font-black uppercase tracking-wide" style={{ color: TEAL_COLOR }}>
                            Upload TRA License
                          </span>
                          <span className="text-[10px] text-muted-foreground">Image of your tax/regulatory license</span>
                        </div>
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setTraLicense(file);
                              setTraLicensePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </MultiStepForm>
        </div>
      </main>
    </div>
  );
};

export default HostVerification;
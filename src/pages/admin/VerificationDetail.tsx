import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, ShieldCheck, Mail, User, FileText,
  MapPin, Loader2, Phone, Globe, Building2, Hash, Calendar, Map as MapIcon,
} from "lucide-react";
import { TealLoader } from "@/components/ui/teal-loader";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  SOFT_GRAY: "#F8F9FA",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// First non-empty value among the given keys (column names differ between schemas).
const pick = (obj: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return "";
};

const humanize = (s: string) => s.replace(/_/g, " ").replace(/\s+/g, " ").trim();

const formatDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";

// Columns already shown explicitly (or that should never be dumped) — everything
// else non-empty falls into the "Other Submitted Details" list so nothing is hidden.
const KNOWN_KEYS = new Set([
  "id", "user_id", "profiles", "status", "reviewed_by", "rejection_reason",
  "legal_name", "kra_pin", "kra_pin_number", "kra_number", "tax_pin", "pin_number",
  "phone", "phone_number", "mobile", "country", "country_id", "country_name",
  "division", "division_id", "division_name", "region", "region_id", "county", "state",
  "city", "town", "street_address", "address", "location", "place", "postal_code", "zip_code",
  "document_type", "document_number", "id_number", "national_id", "passport_number",
  "date_of_birth", "dob", "hosting_category", "host_type", "registration_type",
  "registration_name", "registration_number", "company_name", "business_name",
  "submitted_at", "reviewed_at", "created_at", "updated_at",
]);

const VerificationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resolved, setResolved] = useState<{ country: string; division: string }>({ country: "", division: "" });
  const [signedUrls, setSignedUrls] = useState<{
    front: string | null;
    back: string | null;
    selfie: string | null;
    tra: string | null;
  }>({ front: null, back: null, selfie: null, tra: null });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAdminAndFetch = async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        navigate("/");
        toast({ title: "Access Denied", variant: "destructive" });
        return;
      }
      await fetchVerification();
    };

    checkAdminAndFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, id]);

  // Helper to extract path from storage URL and generate signed URL
  const getSignedUrl = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
      if (url.includes("token=") || !url.includes("supabase")) return url;
      const bucketName = "verification-documents";
      const pathMatch = url.match(/\/verification-documents\/(.+)$/);
      if (pathMatch && pathMatch[1]) {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(pathMatch[1], 3600);
        if (error) {
          console.error("Error creating signed URL:", error);
          return url;
        }
        return data.signedUrl;
      }
      return url;
    } catch (error) {
      console.error("Error processing URL:", error);
      return url;
    }
  };

  // If the record stores a country/division as an id, look up its display name.
  const resolveName = async (table: "countries" | "country_divisions", value: string): Promise<string> => {
    if (!value) return "";
    if (!UUID_RE.test(value)) return value;
    const { data } = await supabase.from(table).select("name").eq("id", value).maybeSingle();
    return data?.name || "";
  };

  const fetchVerification = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("host_verifications")
        .select(`*, profiles!host_verifications_user_id_fkey (name, email, phone_number, country)`)
        .eq("id", id)
        .single();

      if (error) throw error;
      setVerification(data);
      if (data.rejection_reason) setRejectionReason(data.rejection_reason);

      const [country, division] = await Promise.all([
        resolveName("countries", pick(data, "country_name", "country", "country_id") || pick(data.profiles, "country")),
        resolveName("country_divisions", pick(data, "division_name", "division", "division_id", "region", "region_id", "county", "state")),
      ]);
      setResolved({ country, division });

      const [frontUrl, backUrl, selfieUrl, traUrl] = await Promise.all([
        getSignedUrl(data.document_front_url),
        getSignedUrl(data.document_back_url),
        getSignedUrl(data.selfie_url),
        getSignedUrl(data.tra_license_url),
      ]);
      setSignedUrls({ front: frontUrl, back: backUrl, selfie: selfieUrl, tra: traUrl });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      navigate("/admin/verification");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("host_verifications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
          rejection_reason: null,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Approved Successfully" });
      navigate("/admin/verification");
    } catch (error: any) {
      toast({ title: "Approval Failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim() || rejectionReason === "custom") {
      toast({ title: "Reason Required", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("host_verifications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
          rejection_reason: rejectionReason,
        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Verification Rejected" });
      navigate("/admin/verification");
    } catch (error: any) {
      toast({ title: "Rejection Failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <TealLoader text="Loading verification..." />;
  if (!verification) return null;

  const v = verification;

  // ── Derived display values ──────────────────────────────────────────────
  const hostType = pick(v, "host_type", "registration_type");
  const hostTypeLabel =
    hostType.toLowerCase() === "company" ? "Company"
    : hostType ? "Individual / Guide" : "";

  const addressLine = [pick(v, "street_address", "address"), pick(v, "city", "town")]
    .filter(Boolean).join(", ");

  // Any remaining non-empty column that isn't already shown above or a document URL.
  const otherDetails = Object.entries(v)
    .filter(([k, val]) =>
      !KNOWN_KEYS.has(k) &&
      !k.endsWith("_url") &&
      !k.endsWith("_id") &&
      val !== null && val !== undefined && String(val).trim() !== "" &&
      typeof val !== "object"
    )
    .map(([k, val]) => ({
      key: k,
      label: humanize(k),
      value: typeof val === "boolean" ? (val ? "Yes" : "No") : String(val),
    }));

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />

      {/* Top Banner */}
      <div className="bg-white border-b border-slate-100 pt-8 pb-12">
        <div className="container mx-auto px-4">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="mb-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 px-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Queue</span>
          </Button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5" style={{ color: COLORS.TEAL }} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: COLORS.TEAL }}>
                  Identity Verification
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-tight text-slate-900">
                {v.profiles?.name || v.legal_name}
              </h1>
              {hostTypeLabel && (
                <p className="mt-2 text-xs font-black uppercase tracking-widest text-slate-400">{hostTypeLabel}</p>
              )}
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 w-fit">
              {v.status === "pending" ? <Clock className="h-5 w-5 text-amber-500" /> :
                v.status === "approved" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> :
                  <XCircle className="h-5 w-5 text-red-500" />}
              <span className="text-sm font-black uppercase tracking-widest">{v.status}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 -mt-6">
        <div className="grid lg:grid-cols-[1fr,380px] gap-8">

          {/* Documents Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black uppercase tracking-tight mb-8" style={{ color: COLORS.TEAL }}>
                Uploaded Evidence
              </h2>

              <div className="space-y-12">
                {(signedUrls.front || v.document_front_url) && (
                  <DocumentPreview label="Government ID (Front)" url={signedUrls.front || v.document_front_url} />
                )}
                {v.document_back_url && (
                  <DocumentPreview label="Government ID (Back)" url={signedUrls.back || v.document_back_url} />
                )}
                {(signedUrls.selfie || v.selfie_url) && (
                  <DocumentPreview label="Verification Selfie" url={signedUrls.selfie || v.selfie_url} />
                )}
                {(signedUrls.tra || v.tra_license_url) && (
                  <DocumentPreview label="TRA License (Regulation Proof)" url={signedUrls.tra || v.tra_license_url} />
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Info & Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 lg:sticky lg:top-8">
              <h2 className="text-sm font-black uppercase tracking-widest mb-6 text-slate-400">Host Details</h2>

              {/* Personal */}
              <SectionLabel>Personal</SectionLabel>
              <div className="space-y-5 mb-8">
                <InfoItem icon={<User />} label="Legal Name" value={pick(v, "legal_name")} />
                <InfoItem icon={<Mail />} label="Email" value={pick(v.profiles, "email")} />
                <InfoItem icon={<Phone />} label="Phone" value={pick(v, "phone_number", "phone", "mobile") || pick(v.profiles, "phone_number")} />
                <InfoItem icon={<Calendar />} label="Date of Birth" value={formatDate(pick(v, "date_of_birth", "dob")) } />
              </div>

              {/* Identity & Tax */}
              <SectionLabel>Identity &amp; Tax</SectionLabel>
              <div className="space-y-5 mb-8">
                <InfoItem icon={<FileText />} label="Document Type" value={humanize(pick(v, "document_type"))} />
                <InfoItem icon={<Hash />} label="Document / ID Number" value={pick(v, "document_number", "id_number", "national_id", "passport_number")} />
                <InfoItem icon={<Hash />} label="KRA PIN" value={pick(v, "kra_pin", "kra_pin_number", "kra_number", "tax_pin", "pin_number")} />
              </div>

              {/* Location */}
              <SectionLabel>Location</SectionLabel>
              <div className="space-y-5 mb-8">
                <InfoItem icon={<Globe />} label="Country" value={resolved.country} />
                <InfoItem icon={<MapIcon />} label="Division / Region" value={resolved.division} />
                <InfoItem icon={<MapPin />} label="Location / Address" value={addressLine || pick(v, "location", "place")} />
                {pick(v, "location", "place") && addressLine && (
                  <InfoItem icon={<MapPin />} label="Place" value={pick(v, "location", "place")} />
                )}
                <InfoItem icon={<MapPin />} label="Postal Code" value={pick(v, "postal_code", "zip_code")} />
              </div>

              {/* Hosting / Registration */}
              <SectionLabel>Hosting &amp; Registration</SectionLabel>
              <div className="space-y-5 mb-8">
                <InfoItem icon={<Building2 />} label="Registered As" value={hostTypeLabel} />
                <InfoItem icon={<ShieldCheck />} label="Hosting Category" value={pick(v, "hosting_category")} />
                <InfoItem icon={<User />} label="Registration Name" value={pick(v, "registration_name", "company_name", "business_name")} />
                <InfoItem icon={<FileText />} label="Registration Number" value={pick(v, "registration_number")} />
              </div>

              {/* Timeline */}
              <SectionLabel>Timeline</SectionLabel>
              <div className="space-y-5 mb-8">
                <InfoItem icon={<Clock />} label="Submitted" value={formatDate(pick(v, "submitted_at", "created_at"))} />
                <InfoItem icon={<CheckCircle2 />} label="Reviewed" value={formatDate(pick(v, "reviewed_at"))} />
              </div>

              {/* Anything else the host submitted */}
              {otherDetails.length > 0 && (
                <>
                  <SectionLabel>Other Submitted Details</SectionLabel>
                  <div className="space-y-5 mb-8">
                    {otherDetails.map((d) => (
                      <InfoItem key={d.key} icon={<FileText />} label={d.label} value={d.value} />
                    ))}
                  </div>
                </>
              )}

              {v.status === "pending" && (
                <div className="space-y-4 pt-6 border-t border-slate-50">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Decision Reason</Label>
                    <Select value={rejectionReason} onValueChange={setRejectionReason}>
                      <SelectTrigger className="rounded-xl border-slate-200">
                        <SelectValue placeholder="Select outcome..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Document does not match legal name.">Name Mismatch</SelectItem>
                        <SelectItem value="Document not visible/blurry.">Blurry/Illegible</SelectItem>
                        <SelectItem value="Inappropriate/Invalid document.">Invalid Document</SelectItem>
                        <SelectItem value="Selfie does not match the document photo.">Face Mismatch</SelectItem>
                        <SelectItem value="custom">Custom Note</SelectItem>
                      </SelectContent>
                    </Select>
                    {rejectionReason === "custom" && (
                      <Textarea
                        className="mt-2 rounded-xl"
                        placeholder="Enter specific reason..."
                        onChange={(e) => setRejectionReason(e.target.value || "custom")}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-4">
                    <Button
                      onClick={handleApprove}
                      disabled={isProcessing}
                      className="w-full py-7 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 border-none"
                      style={{ background: COLORS.TEAL }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Approve Host
                    </Button>

                    <Button
                      onClick={handleReject}
                      disabled={isProcessing || !rejectionReason}
                      variant="ghost"
                      className="w-full py-7 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-red-500 hover:bg-red-50 transition-all border border-red-100"
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Reject Application
                    </Button>
                  </div>
                </div>
              )}

              {v.status === "rejected" && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 mt-4">
                  <p className="text-[10px] font-black text-red-400 uppercase mb-1">Rejection Reason</p>
                  <p className="text-xs font-bold text-red-700">{v.rejection_reason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 pb-2 border-b border-slate-100" style={{ color: COLORS.TEAL }}>
    {children}
  </p>
);

const DocumentPreview = ({ label, url }: { label: string; url: string }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</h3>
        <Button
          variant="link"
          className="text-[10px] font-black uppercase text-[#008080] h-auto p-0"
          onClick={() => window.open(url, "_blank")}
        >
          View Original
        </Button>
      </div>
      <div className="relative group overflow-hidden rounded-[24px] border-4 border-slate-50 bg-slate-100 aspect-video md:aspect-auto min-h-[200px]">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}
        {imageError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400">
            <p className="text-sm font-bold">Unable to load image</p>
            <Button
              variant="link"
              className="text-[#008080] text-xs mt-2"
              onClick={() => window.open(url, "_blank")}
            >
              Try opening directly
            </Button>
          </div>
        ) : (
          <img
            src={url}
            alt={label}
            className={`w-full h-auto max-h-[600px] object-contain transition-transform duration-500 group-hover:scale-[1.02] ${imageLoading ? "opacity-0" : "opacity-100"}`}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        )}
        {!imageError && !imageLoading && (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="bg-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
              Click to Zoom
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactElement; label: string; value?: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-1 p-2 rounded-lg bg-slate-50 text-slate-400 shrink-0">
      {React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
    </div>
    <div className="min-w-0">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xs font-bold text-slate-800 uppercase tracking-tight break-words">{value || "N/A"}</p>
    </div>
  </div>
);

export default VerificationDetail;
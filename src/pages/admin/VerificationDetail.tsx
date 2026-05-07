import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, XCircle, Clock, ShieldCheck, Mail, User, FileText, MapPin, Loader2, Ban } from "lucide-react";
import { TealLoader } from "@/components/ui/teal-loader";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const VerificationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [signedUrls, setSignedUrls] = useState<{
    front: string | null;
    back: string | null;
    selfie: string | null;
    tra: string | null;
  }>({ front: null, back: null, selfie: null, tra: null });
  const [isBanned, setIsBanned] = useState(false);

  const toggleBan = async () => {
    if (!verification?.user_id) return;
    const newStatus = !isBanned;
    try {
      const { error } = await supabase.from("profiles").update({ is_banned: newStatus }).eq("id", verification.user_id);
      if (error) throw error;
      setIsBanned(newStatus);
      toast({ title: newStatus ? "User Banned" : "User Unbanned", description: newStatus ? "User can no longer host or create listings." : "User restored." });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

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
  }, [user, navigate, id]);

  // Helper to extract path from storage URL and generate signed URL
  const getSignedUrl = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    
    try {
      // Check if it's already a signed URL or external URL
      if (url.includes('token=') || !url.includes('supabase')) {
        return url;
      }

      // Extract the path from the URL
      // URL format: .../storage/v1/object/public/bucket-name/path
      // or: .../storage/v1/object/sign/bucket-name/path (for private)
      const bucketName = 'verification-documents';
      const pathMatch = url.match(/\/verification-documents\/(.+)$/);
      
      if (pathMatch && pathMatch[1]) {
        const filePath = pathMatch[1];
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(filePath, 3600); // 1 hour expiry
        
        if (error) {
          console.error('Error creating signed URL:', error);
          return url; // Fall back to original URL
        }
        return data.signedUrl;
      }
      
      return url;
    } catch (error) {
      console.error('Error processing URL:', error);
      return url;
    }
  };

  const fetchVerification = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("host_verifications")
        .select(`*, profiles!host_verifications_user_id_fkey (name, email)`)
        .eq("id", id)
        .single();

      if (error) throw error;
      setVerification(data);
      if (data.rejection_reason) setRejectionReason(data.rejection_reason);

      // Fetch ban status
      if (data.user_id) {
        const { data: profile } = await supabase.from("profiles").select("is_banned").eq("id", data.user_id).maybeSingle();
        setIsBanned(profile?.is_banned || false);
      }

      // Generate signed URLs for private bucket access
      const [frontUrl, backUrl, selfieUrl, traUrl] = await Promise.all([
        getSignedUrl(data.document_front_url),
        getSignedUrl(data.document_back_url),
        getSignedUrl(data.selfie_url),
        getSignedUrl(data.tra_license_url),
      ]);
      
      setSignedUrls({
        front: frontUrl,
        back: backUrl,
        selfie: selfieUrl,
        tra: traUrl,
      });
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
    } finally { setIsProcessing(false); }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
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
    } finally { setIsProcessing(false); }
  };

  if (loading) {
    return <TealLoader text="Loading verification..." />;
  }
  if (!verification) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      
      {/* Top Banner / Hero Style */}
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
                {verification.profiles?.name || verification.legal_name}
              </h1>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 w-fit">
               {verification.status === 'pending' ? <Clock className="h-5 w-5 text-amber-500" /> : 
                verification.status === 'approved' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : 
                <XCircle className="h-5 w-5 text-red-500" />}
               <span className="text-sm font-black uppercase tracking-widest">
                 {verification.status}
               </span>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 -mt-6">
        <div className="grid lg:grid-cols-[1fr,350px] gap-8">
          
          {/* Documents Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
              <h2 className="text-xl font-black uppercase tracking-tight mb-8" style={{ color: COLORS.TEAL }}>
                Uploaded Evidence
              </h2>
              
              <div className="space-y-12">
                <DocumentPreview 
                  label="Government ID (Front)" 
                  url={signedUrls.front || verification.document_front_url} 
                />
                {verification.document_back_url && (
                  <DocumentPreview 
                    label="Government ID (Back)" 
                    url={signedUrls.back || verification.document_back_url} 
                  />
                )}
                <DocumentPreview 
                  label="Verification Selfie" 
                  url={signedUrls.selfie || verification.selfie_url} 
                />
                {(signedUrls.tra || verification.tra_license_url) && (
                  <DocumentPreview 
                    label="TRA License (Regulation Proof)" 
                    url={signedUrls.tra || verification.tra_license_url} 
                  />
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Info & Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 lg:sticky lg:top-8">
              <h2 className="text-sm font-black uppercase tracking-widest mb-6 text-slate-400">Host Details</h2>
              
              <div className="space-y-6 mb-8">
                <InfoItem icon={<User />} label="Legal Name" value={verification.legal_name} />
                <InfoItem icon={<Mail />} label="Email" value={verification.profiles?.email} />
                <InfoItem icon={<FileText />} label="Doc Type" value={verification.document_type.replace("_", " ")} />
                <InfoItem 
                    icon={<MapPin />} 
                    label="Address" 
                    value={`${verification.street_address}, ${verification.city}`} 
                />
                {verification.hosting_category && (
                  <InfoItem icon={<ShieldCheck />} label="Hosting Category" value={verification.hosting_category} />
                )}
                {verification.registration_number && (
                  <InfoItem icon={<FileText />} label="Registration Number" value={verification.registration_number} />
                )}
              </div>

              {verification.status === "pending" && (
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
                        onChange={(e) => setRejectionReason(e.target.value)}
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

              {verification.status === "rejected" && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-100 mt-4">
                  <p className="text-[10px] font-black text-red-400 uppercase mb-1">Rejection Reason</p>
                  <p className="text-xs font-bold text-red-700">{verification.rejection_reason}</p>
                </div>
              )}

              {/* Ban / Unban control */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">User Access Control</p>
                {isBanned && (
                  <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100 text-[10px] font-black uppercase text-red-600 tracking-widest flex items-center gap-2">
                    <Ban className="h-3 w-3" /> User is currently banned
                  </div>
                )}
                <Button
                  onClick={toggleBan}
                  variant={isBanned ? "outline" : "destructive"}
                  className="w-full py-6 rounded-2xl text-xs font-black uppercase tracking-[0.2em]"
                >
                  <Ban className="h-4 w-4 mr-2" /> {isBanned ? "Unban User" : "Ban from Hosting"}
                </Button>
                <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
                  Banned users cannot create listings or host any items on the platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

const DocumentPreview = ({ label, url }: { label: string, url: string }) => {
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
            className={`w-full h-auto max-h-[600px] object-contain transition-transform duration-500 group-hover:scale-[1.02] ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
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

const InfoItem = ({ icon, label, value }: { icon: React.ReactElement, label: string, value: string }) => (
  <div className="flex items-start gap-3">
    <div className="mt-1 p-2 rounded-lg bg-slate-50 text-slate-400">
      {React.cloneElement(icon, { size: 14 })}
    </div>
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{value || "N/A"}</p>
    </div>
  </div>
);

export default VerificationDetail;

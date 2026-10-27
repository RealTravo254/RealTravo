import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useSafeBack } from "@/hooks/useSafeBack";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MultiStepBooking, BookingFormData } from "@/components/booking/MultiStepBooking";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { useAuth } from "@/contexts/AuthContext";
import { getReferralTrackingId } from "@/lib/referralUtils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CreditCard, Clock } from "lucide-react";
import { PaymentSuccessDialog } from "@/components/booking/PaymentSuccessDialog";
import {
  generateBookingPDF as buildBookingPDF,
  getBookingMeta, getBookingLines, fmtMoney, fmtDate,
} from "@/lib/bookingPdf";
import { inquiryAmount, inquiryLines, inquiryBookingDetails } from "@/lib/bookingEmail";

// Kept as a named export from this file so existing imports
// (e.g. PaymentSuccessDialog) keep working. The PDF code now lives in @/lib/bookingPdf.
export const generateBookingPDF = buildBookingPDF;

// ── Design tokens ─────────────────────────────────────────────────────────
const FOREST       = "#1F4D3A";
const FOREST_DEEP  = "#123322";
const FOREST_SOFT  = "#EAF0EA";
const CLAY         = "#C1552F";
const GOLD         = "#B98A2A";
const GOLD_SOFT    = "#FBF2DD";
const GOLD_TEXT    = "#8A6716";
const INK          = "#1C2B22";
const INK_SOFT     = "#5B6B60";
const HAIRLINE     = "#DCE3DC";
const CANVAS       = "#F4F6F2";

const COLORS = { TEAL: FOREST, CORAL: CLAY };

const FONT_DISPLAY = "'Fraunces', ui-serif, Georgia, serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

const useInjectFonts = () => {
  useEffect(() => {
    const id = "adventure-detail-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);
};

type BookingType = "trip" | "event" | "hotel" | "adventure_place" | "attraction";

// ─── Dark-mode lockout ──────────────────────────────────────────────────────
const LOCK_LIGHT_CLASS = "rt-booking-force-light";
const ForceLightModeStyles = () => (
  <style>{`
    .${LOCK_LIGHT_CLASS} {
      color-scheme: light;
      --background: 0 0% 100%; --foreground: 222.2 84% 4.9%;
      --card: 0 0% 100%; --card-foreground: 222.2 84% 4.9%;
      --popover: 0 0% 100%; --popover-foreground: 222.2 84% 4.9%;
      --primary: 222.2 47.4% 11.2%; --primary-foreground: 210 40% 98%;
      --secondary: 210 40% 96.1%; --secondary-foreground: 222.2 47.4% 11.2%;
      --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%;
      --accent: 210 40% 96.1%; --accent-foreground: 222.2 47.4% 11.2%;
      --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 40% 98%;
      --border: 214.3 31.8% 91.4%; --input: 214.3 31.8% 91.4%; --ring: 222.2 84% 4.9%;
    }
    .${LOCK_LIGHT_CLASS}, .${LOCK_LIGHT_CLASS} * { color-scheme: light; }
  `}</style>
);

// ── Portal header ─────────────────────────────────────────────────────────────
const PaystackFloatingHeader = ({ itemName, onBack }: { itemName: string; onBack: () => void }) =>
  createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 2147483647, pointerEvents: "auto",
      backgroundColor: FOREST, borderBottom: "1px solid rgba(255,255,255,0.15)",
      boxShadow: "0 1px 8px rgba(14,23,18,0.2)",
      paddingTop: "max(env(safe-area-inset-top, 0px), 10px)",
      paddingBottom: "10px", paddingLeft: "16px", paddingRight: "16px",
      display: "flex", alignItems: "center", gap: "12px", fontFamily: FONT_BODY,
    }}>
      <button onClick={onBack} aria-label="Back to checkout" style={{
        width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.2)",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "background-color 0.15s",
      }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.3)")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.2)")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.72)", letterSpacing: "0.04em", lineHeight: 1.2 }}>
          Back to checkout
        </p>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, fontFamily: FONT_DISPLAY, color: "#ffffff", letterSpacing: "-0.01em", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {itemName}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.2)", color: "#ffffff", fontSize: 11, fontWeight: 600, padding: "6px 12px", borderRadius: 999, flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        Secure pay
      </div>
    </div>,
    document.body
  );

// ── Pay-for-accepted-booking card (shown when URL has ?inquiry=<id>) ──────────
const InquiryPayCard = ({
  inquiry, itemName, amount, busy, onPay,
}: { inquiry: any; itemName: string; amount: number; busy: boolean; onPay: () => void }) => {
  const lines = inquiryLines(inquiry);
  const sections = Array.from(new Set(lines.map((l) => l.section)));
  const visit = inquiry.visit_date || inquiry.booking_details?.visit_date;
  return (
    <div className="p-6" style={{ fontFamily: FONT_BODY }}>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-3"
        style={{ background: GOLD_SOFT, color: GOLD_TEXT, border: `1px solid ${GOLD}50` }}>
        <Clock className="h-3 w-3" /> Accepted · Waiting for payment
      </span>
      <h2 className="text-xl font-semibold" style={{ fontFamily: FONT_DISPLAY, color: INK }}>{itemName}</h2>
      <p className="text-[13px] mt-1" style={{ color: INK_SOFT }}>
        The host accepted your request. Pay now to confirm your booking and get your QR code.
      </p>

      {visit && (
        <div className="mt-4 rounded-xl px-3.5 py-3" style={{ background: CANVAS }}>
          <p className="text-[10px] font-medium" style={{ color: INK_SOFT }}>Visit date</p>
          <p className="text-[13px] font-semibold" style={{ color: INK }}>{fmtDate(visit)}</p>
        </div>
      )}

      {sections.map((s) => (
        <div key={s} className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: FOREST }}>{s}</p>
          {lines.filter((l) => l.section === s).map((l, i) => (
            <div key={i} className="py-1.5" style={{ borderBottom: `1px dashed ${HAIRLINE}` }}>
              <div className="flex justify-between text-[13px] font-semibold" style={{ color: INK }}>
                <span className="pr-2">{l.label}</span><span>{fmtMoney(l.amount)}</span>
              </div>
              {l.sub && <p className="text-[11px]" style={{ color: INK_SOFT }}>{l.sub}</p>}
            </div>
          ))}
        </div>
      ))}

      <div className="mt-5 rounded-2xl px-4 py-3 flex items-center justify-between text-white" style={{ background: FOREST }}>
        <span className="text-[12px] font-semibold">Total to pay</span>
        <span className="text-xl font-semibold" style={{ fontFamily: FONT_DISPLAY }}>{fmtMoney(amount)}</span>
      </div>

      <button onClick={onPay} disabled={busy}
        className="mt-4 w-full flex items-center justify-center gap-2 text-white font-semibold rounded-xl py-3 text-sm disabled:opacity-60"
        style={{ background: `linear-gradient(135deg, #E0824F, ${CLAY})` }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {busy ? "Starting payment…" : `Pay now ${fmtMoney(amount)}`}
      </button>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const BookingPage = () => {
  useInjectFonts();

  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate     = useNavigate();
  const goBack       = useSafeBack();
  const { toast }    = useToast();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();

  // ?inquiry=<id> → the host already accepted; the guest is here to PAY, not to fill the form again.
  const inquiryId = searchParams.get("inquiry");

  const isAdventureType = type === "adventure_place" || type === "adventure" || type === "hotel";

  const [item, setItem]                                 = useState<any>(null);
  const [loading, setLoading]                           = useState(true);
  const [isProcessing, setIsProcessing]                 = useState(false);
  const [isVerifying, setIsVerifying]                   = useState(false);
  const [isCompleted, setIsCompleted]                   = useState(false);
  const [showSuccessDialog, setShowSuccessDialog]       = useState(false);
  const [paymentReference, setPaymentReference]         = useState("");
  const [completedBookingData, setCompletedBookingData] = useState<any>(null);
  const [inquiry, setInquiry]                           = useState<any>(null);
  const [inquiryLoading, setInquiryLoading]             = useState(!!inquiryId);

  // Marking the inquiry paid, the "Completed" notifications and the confirmation emails all happen
  // on the server inside paystack-verify, so nothing extra is needed here after payment.

  const { initiatePayment, launchPaystack, isLoading: isPaymentLoading, showPaystackContainer } =
    usePaystackPopup({
      onSuccess: (reference, bookingData) => {
        setPaymentReference(reference);
        setCompletedBookingData(bookingData);
        setIsVerifying(false);
        setIsCompleted(true);
        setIsProcessing(false);
        setShowSuccessDialog(true);
      },
      onVerifying: () => setIsVerifying(true),
      onError: error => {
        toast({ title: "Payment Error", description: error, variant: "destructive" });
        setIsProcessing(false); setIsVerifying(false);
      },
      onClose: () => { setIsProcessing(false); setIsVerifying(false); },
    });

  useEffect(() => {
    if (showPaystackContainer) {
      const t = setTimeout(() => launchPaystack("paystack-checkout-container"), 300);
      return () => clearTimeout(t);
    }
  }, [showPaystackContainer, launchPaystack]);

  useEffect(() => {
    if (showPaystackContainer && !isCompleted && !isVerifying) {
      document.body.style.paddingTop = "calc(64px + env(safe-area-inset-top, 0px))";
    } else {
      document.body.style.paddingTop = "";
    }
    return () => { document.body.style.paddingTop = ""; };
  }, [showPaystackContainer, isCompleted, isVerifying]);

  useEffect(() => {
    if (id && type) fetchItem();
    window.scrollTo(0, 0);
  }, [id, type]);

  // Load the accepted inquiry we're paying for
  useEffect(() => {
    if (!inquiryId) return;
    if (authLoading) return;
    if (!user) { setInquiryLoading(false); return; }
    (supabase as any).from("availability_inquiries").select("*").eq("id", inquiryId).maybeSingle()
      .then(({ data }: any) => { setInquiry(data); setInquiryLoading(false); });
  }, [inquiryId, user?.id, authLoading]);

  const fetchItem = async () => {
    if (!id || !type) return;
    try {
      let data: any = null;
      let error: any = null;

      if (type === "trip" || type === "event") {
        const r = await supabase.from("trips").select(
          "id,name,location,place,country,image_url,date,is_custom_date," +
          "is_flexible_date,slot_limit_type,price,price_child,available_tickets," +
          "description,activities,phone_number,email,created_by,opening_hours," +
          "closing_hours,days_opened,type,approval_status,is_hidden,ticket_types," +
          "allow_children,event_category,inclusions,exclusions"
        ).eq("id", id).maybeSingle();
        data = r.data; error = r.error;
      } else if (isAdventureType) {
        const r = await supabase.from("adventure_places").select(
          "id,name,location,place,country,image_url,description,amenities," +
          "facilities,activities,phone_numbers,email,opening_hours,closing_hours," +
          "days_opened,approval_status,is_hidden,entry_fee,entry_fee_type," +
          "available_slots,created_by,registration_number," +
          "non_citizen_entry_fee,non_citizen_child_entry_fee," +
          "has_non_citizen_pricing,special_entry_prices," +
          "child_entry_fee"
        ).eq("id", id).maybeSingle();
        data = r.data; error = r.error;
      }

      if (error) {
        toast({ title: "Item not found", description: "Could not load booking details.", variant: "destructive" });
        navigate(-1); return;
      }
      if (!data) {
        toast({ title: "Item not found", description: "The item you're trying to book doesn't exist.", variant: "destructive" });
        navigate(-1); return;
      }
      if (data.is_hidden || (data.approval_status && data.approval_status !== "approved")) {
        toast({ title: "Unavailable", description: "This item is not currently available for booking.", variant: "destructive" });
        navigate("/"); return;
      }
      setItem(data);
    } catch {
      toast({ title: "Item not found", variant: "destructive" });
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const getBookingType = (): BookingType => {
    if (type === "trip")    return "trip";
    if (type === "event")   return "event";
    if (isAdventureType)    return "adventure_place";
    return "attraction";
  };

  const getHostContact = () => {
    if (!item) return { phone: "", email: "" };
    if (type === "trip" || type === "event") return { phone: item.phone_number || "", email: item.email || "" };
    const phones: string[] = Array.isArray(item.phone_numbers) ? item.phone_numbers : [];
    return { phone: phones[0] || "", email: item.email || "" };
  };

  const getItemTypeLabel = () => {
    if (!item || !type) return "Booking";
    const isGuided = type === "trip" && (item.type === "guided" || item.is_guided === true);
    if (type === "trip")    return isGuided ? "Tour" : "Trip";
    if (type === "event")   return "Event";
    if (type === "hotel")   return "Hotel";
    if (type === "adventure_place" || type === "adventure") return "Adventure Place";
    return "Booking";
  };

  // Listing fields stored with every booking (same for normal and accepted-inquiry bookings)
  const itemDetails = (isFacilityOnly: boolean) => ({
    item_name:           item.name,
    name:                item.name,
    location:            item.location,
    place:               item.place,
    country:             item.country,
    opening_hours:       item.opening_hours       || "",
    closing_hours:       item.closing_hours       || "",
    days_opened:         item.days_opened         || [],
    email:               item.email               || "",
    phone_number:        item.phone_number        || "",
    phone_numbers:       item.phone_numbers       || [],
    event_category:      item.event_category      || "",
    registration_number: item.registration_number || "",
    entry_fee_type:      item.entry_fee_type      || "",
    is_facility_only:    isFacilityOnly,
  });

  const handleBookingSubmit = async (formData: BookingFormData) => {
    if (!item || !type) return;
    setIsProcessing(true);
    try {
      let totalAmount = 0;
      const bookingType    = getBookingType();
      const isFacilityOnly = searchParams.get("skipToFacility") === "true";

      if (type === "trip" || type === "event") {
        if (formData.ticketSelections?.length) {
          formData.ticketSelections.forEach(t => (totalAmount += t.price * t.quantity));
        } else {
          totalAmount = formData.num_adults * item.price + formData.num_children * (item.price_child || 0);
        }
      } else if (isAdventureType) {
        if (!isFacilityOnly) {
          if (formData.entryTicketSelections?.length) {
            formData.entryTicketSelections.forEach(t => (totalAmount += t.price * t.quantity));
          } else {
            totalAmount = (formData.num_adults + formData.num_children) * (item.entry_fee || 0);
          }
        }
        formData.selectedActivities?.forEach(a => (totalAmount += a.price * a.numberOfPeople));
        formData.selectedFacilities?.forEach(f => {
          if (f.startDate && f.endDate) {
            const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000);
            totalAmount += f.price * Math.max(days, 1);
          }
        });
      }

      if (totalAmount <= 0) {
        toast({
          title: "Nothing to book",
          description: isAdventureType
            ? "This visit has free entry, so please add at least one paid activity or facility to book."
            : "Please select at least one paid item to continue.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const slotsBooked = isFacilityOnly
        ? formData.selectedFacilities?.length || 1
        : (formData.entryTicketSelections?.reduce((s, t) => s + t.quantity, 0) ||
           formData.num_adults + formData.num_children);

      let visitDate = formData.visit_date || item.date;
      if (isFacilityOnly && formData.selectedFacilities?.length && formData.selectedFacilities[0].startDate) {
        visitDate = formData.selectedFacilities[0].startDate;
      }

      const hostContact = getHostContact();
      const metaType = type === "hotel" ? "hotel" : bookingType;
      const { typeLabel, contactLabel } = getBookingMeta(metaType, formData);

      const bookingData = {
        item_id:       item.id,
        booking_type:  bookingType,
        type_label:    typeLabel,
        contact_label: contactLabel,
        total_amount:  totalAmount,
        booking_details: {
          ...formData,
          ...itemDetails(isFacilityOnly),
          adults:                  formData.num_adults,
          children:                formData.num_children,
          facilities:              formData.selectedFacilities,
          selectedFacilities:      formData.selectedFacilities,
          activities:              formData.selectedActivities,
          selectedActivities:      formData.selectedActivities,
          entry_ticket_selections: formData.entryTicketSelections,
          entryTicketSelections:   formData.entryTicketSelections,
        },
        user_id:              user?.id || null,
        is_guest_booking:     !user,
        guest_name:           formData.guest_name,
        guest_email:          formData.guest_email,
        guest_phone:          formData.guest_phone || "",
        visit_date:           visitDate,
        slots_booked:         slotsBooked,
        host_id:              item.created_by,
        referral_tracking_id: getReferralTrackingId(),
        host_phone:           hostContact.phone,
        host_email:           hostContact.email,
        emailData: {
          itemName: item.name, typeLabel, contactLabel,
          hostPhone: hostContact.phone, hostEmail: hostContact.email,
        },
      };

      await initiatePayment(formData.guest_email, totalAmount, bookingData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  // Pay for an inquiry the host accepted. Uses the saved form data + the FINAL (possibly host-adjusted) price.
  const handleInquiryPay = async () => {
    if (!item || !inquiry || !user) return;
    setIsProcessing(true);
    try {
      const amount = inquiryAmount(inquiry);
      if (amount <= 0) {
        toast({ title: "Nothing to pay", description: "This request has no amount set. Contact the host.", variant: "destructive" });
        setIsProcessing(false); return;
      }
      const saved = inquiryBookingDetails(inquiry);
      const bookingType = getBookingType();
      const hostContact = getHostContact();
      const metaType = type === "hotel" ? "hotel" : bookingType;
      const { typeLabel, contactLabel } = getBookingMeta(metaType, saved);
      const guestEmail = inquiry.guest_email || saved.guest_email || user.email || "";

      const bookingData = {
        item_id:       item.id,
        booking_type:  bookingType,
        type_label:    typeLabel,
        contact_label: contactLabel,
        total_amount:  amount,
        inquiry_id:    inquiry.id,
        booking_details: {
          ...saved,
          ...itemDetails(!!saved.is_facility_only),
          adults:   saved.adults   ?? saved.num_adults,
          children: saved.children ?? saved.num_children,
          inquiry_id:        inquiry.id,
          is_custom_booking: true,
          agreed_amount:     amount,
        },
        user_id:              user.id,
        is_guest_booking:     false,
        guest_name:           inquiry.guest_name  || saved.guest_name  || "",
        guest_email:          guestEmail,
        guest_phone:          inquiry.guest_phone || saved.guest_phone || "",
        visit_date:           inquiry.visit_date  || saved.visit_date  || item.date,
        slots_booked:         inquiry.slots_booked || inquiry.guests || saved.slots_booked || 1,
        host_id:              item.created_by,
        referral_tracking_id: getReferralTrackingId(),
        host_phone:           hostContact.phone || inquiry.host_phone || "",
        host_email:           hostContact.email || inquiry.host_email || "",
        emailData: {
          itemName: item.name, typeLabel, contactLabel,
          hostPhone: hostContact.phone || inquiry.host_phone || "",
          hostEmail: hostContact.email || inquiry.host_email || "",
        },
      };

      await initiatePayment(guestEmail, amount, bookingData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  const handlePaystackBack = () => {
    setIsProcessing(false);
    setIsVerifying(false);
    window.location.reload();
  };

  if (loading || inquiryLoading) {
    return (
      <div
        className={`${LOCK_LIGHT_CLASS} flex flex-col items-center justify-center min-h-screen`}
        style={{ background: `linear-gradient(160deg, ${FOREST} 0%, ${FOREST_DEEP} 100%)`, paddingTop: "env(safe-area-inset-top, 0px)", colorScheme: "light" }}
      >
        <ForceLightModeStyles />
        <Loader2 className="h-10 w-10 animate-spin text-white mb-4" />
        <p className="text-sm font-semibold text-white/90 animate-pulse" style={{ fontFamily: FONT_BODY }}>Loading…</p>
      </div>
    );
  }

  if (!item) return null;

  const getMultiStepProps = () => {
    const baseProps = {
      onSubmit:         handleBookingSubmit,
      isProcessing:     isProcessing || isPaymentLoading,
      isCompleted,
      itemName:         item.name,
      itemId:           item.id,
      hostId:           item.created_by || "",
      onPaymentSuccess: () => setIsCompleted(true),
      primaryColor:     COLORS.TEAL,
      accentColor:      COLORS.CORAL,
      separateActivitiesAndFacilities: true,
    };

    if (type === "trip" || type === "event") {
      const parsedTicketTypes = Array.isArray(item.ticket_types)
        ? (item.ticket_types as any[]).map((t: any) => ({ name: t.name, price: Number(t.price) }))
        : [];
      return {
        ...baseProps,
        bookingType:       type,
        priceAdult:        item.price,
        priceChild:        item.price_child,
        activities:        item.activities || [],
        skipFacilitiesAndActivities: true,
        skipDateSelection: !item.is_custom_date && !item.is_flexible_date,
        fixedDate:         item.is_flexible_date ? "" : item.date,
        totalCapacity:     item.available_tickets || 0,
        slotLimitType:     item.slot_limit_type || (item.is_flexible_date ? "per_booking" : "inventory"),
        isFlexibleDate:    item.is_flexible_date || false,
        ticketTypes:       parsedTicketTypes,
        allowChildren:     item.allow_children !== false,
      };
    }

    if (isAdventureType) {
      return {
        ...baseProps,
        bookingType:             "adventure_place",
        priceAdult:              item.entry_fee       || 0,
        priceChild:              item.child_entry_fee || item.entry_fee || 0,
        nonCitizenEntryFee:      item.non_citizen_entry_fee       || 0,
        nonCitizenChildEntryFee: item.non_citizen_child_entry_fee || 0,
        hasNonCitizenPricing:    item.has_non_citizen_pricing     || false,
        specialEntryPrices:      Array.isArray(item.special_entry_prices) ? item.special_entry_prices : [],
        entranceType:            item.entry_fee_type || "paid",
        facilities:              item.facilities     || [],
        activities:              item.activities     || [],
        totalCapacity:           item.available_slots || 0,
        workingDays:             item.days_opened    || [],
        skipDateSelection:       false,
        allowChildren:           true,
      };
    }

    return baseProps;
  };

  const paystackIsActive = showPaystackContainer && !isCompleted && !isVerifying;
  const itemTypeLabel    = getItemTypeLabel();

  // Can this guest pay for this inquiry?
  const inquiryPayable = !!(inquiry && user && inquiry.guest_id === user.id &&
    inquiry.status === "accepted" && inquiry.payment_status !== "paid");
  const inquiryBlockedMsg = !inquiryId ? "" :
    !user ? "Please log in with the account you used to send the request, then open this link again." :
    !inquiry ? "We couldn't find this request." :
    inquiry.guest_id !== user.id ? "This request belongs to a different account." :
    inquiry.payment_status === "paid" ? "This booking is already paid. You'll find it in your bookings." :
    inquiry.status !== "accepted" ? "This request hasn't been accepted by the host yet." : "";

  return (
    <div className={`${LOCK_LIGHT_CLASS} min-h-screen`} style={{ background: CANVAS, colorScheme: "light" }}>
      <ForceLightModeStyles />

      {paystackIsActive && item && <PaystackFloatingHeader itemName={item.name} onBack={handlePaystackBack} />}

      {!isCompleted && !showPaystackContainer && (
        <div
          className="sticky top-0 z-50 bg-white/85 backdrop-blur-lg"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", borderBottom: `1px solid ${HAIRLINE}`, fontFamily: FONT_BODY }}
        >
          <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost" size="icon"
              onClick={() => {
                if (isProcessing || isVerifying) { setIsProcessing(false); setIsVerifying(false); }
                else goBack();
              }}
              className="rounded-full hover:bg-transparent"
              style={{ background: FOREST_SOFT }}
            >
              <ArrowLeft className="h-5 w-5" style={{ color: FOREST }} />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate" style={{ fontFamily: FONT_DISPLAY, color: INK }}>
                {isVerifying ? "Checkout" : inquiryId ? `Pay — ${item.name}` : `Book ${itemTypeLabel} — ${item.name}`}
              </h1>
              <p className="text-[13px] truncate" style={{ color: INK_SOFT }}>
                {isVerifying ? "Processing payment…" : `${item.location}, ${item.country}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {isVerifying && !isCompleted && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6" style={{ paddingTop: "env(safe-area-inset-top, 0px)", fontFamily: FONT_BODY }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 animate-pulse" style={{ background: FOREST_SOFT }}>
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: FOREST }} />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-center" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Processing your booking</h2>
          <p className="text-sm text-center max-w-xs" style={{ color: INK_SOFT }}>Please wait while we verify your payment and confirm your booking…</p>
          <div className="mt-6 flex items-center gap-2">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-2 h-2 rounded-full animate-bounce" style={{ background: CLAY, animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
      )}

      {showPaystackContainer && !isCompleted && !isVerifying && (
        <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-[28px] overflow-hidden" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 30px rgba(28,43,34,0.08)", fontFamily: FONT_BODY }}>
            <div className="p-6" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
              <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: FONT_DISPLAY, color: INK }}>Complete payment</h2>
              <p className="text-[13px]" style={{ color: INK_SOFT }}>Enter your payment details below to complete your booking</p>
            </div>
            <div id="paystack-checkout-container" className="w-full min-h-[400px]" />
          </div>
        </div>
      )}

      {!isCompleted && !isVerifying && !showPaystackContainer && (
        <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-[28px]" style={{ border: `1px solid ${HAIRLINE}`, boxShadow: "0 8px 30px rgba(28,43,34,0.06)" }}>
            {!inquiryId ? (
              <MultiStepBooking {...getMultiStepProps()} />
            ) : inquiryPayable ? (
              <InquiryPayCard
                inquiry={inquiry}
                itemName={item.name}
                amount={inquiryAmount(inquiry)}
                busy={isProcessing || isPaymentLoading}
                onPay={handleInquiryPay}
              />
            ) : (
              <div className="p-8 text-center" style={{ fontFamily: FONT_BODY }}>
                <p className="text-sm mb-4" style={{ color: INK_SOFT }}>{inquiryBlockedMsg}</p>
                <Button onClick={() => navigate("/bookings")} className="rounded-xl text-white" style={{ background: FOREST }}>
                  Go to my bookings
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <PaymentSuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        bookingData={completedBookingData}
        reference={paymentReference}
      />
    </div>
  );
};

export default BookingPage;

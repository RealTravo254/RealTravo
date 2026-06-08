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
import { ArrowLeft, Loader2 } from "lucide-react";
import { PaymentSuccessDialog } from "@/components/booking/PaymentSuccessDialog";
import { jsPDF } from "jspdf";

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50" };

type BookingType = "trip" | "event" | "hotel" | "adventure_place" | "attraction";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) => "KES " + Math.round(n).toLocaleString("en-KE");

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
  });

const fmtShort = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });

const getBookingMeta = (
  bookingType: string,
  bookingDetails?: any
): { typeLabel: string; contactLabel: string } => {
  const raw = (bookingType || "").toLowerCase();
  const d   = bookingDetails || {};
  const isGuidedTrip =
    raw === "trip" &&
    (d.trip_type === "guided" || d.tripType === "guided" ||
     d.is_guided === true   || d.isGuided === true);

  switch (raw) {
    case "trip":
      return isGuidedTrip
        ? { typeLabel: "Tour",            contactLabel: "Tour Organizer" }
        : { typeLabel: "Trip",            contactLabel: "Trip Organizer" };
    case "event":
      return { typeLabel: "Event",          contactLabel: "Event Organizer" };
    case "adventure_place":
    case "adventure":
      return { typeLabel: "Adventure Place", contactLabel: "Premises Owner / Operator" };
    case "hotel":
      return { typeLabel: "Hotel",          contactLabel: "Hotel Management" };
    default:
      return { typeLabel: "Booking",        contactLabel: "Organizer" };
  }
};

// ── QR code ───────────────────────────────────────────────────────────────────
const generateQRDataUrl = (text: string, size = 120): Promise<string> =>
  new Promise((resolve) => {
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=008080&bgcolor=ffffff&margin=4`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.drawImage(img, 0, 0, size, size); resolve(canvas.toDataURL("image/png")); }
        else resolve("");
      };
      img.onerror = () => resolve("");
      img.src = url;
    } catch { resolve(""); }
  });

// ── PDF generator ─────────────────────────────────────────────────────────────
export const generateBookingPDF = async (bookingData: any, reference: string) => {
  const d   = bookingData?.booking_details || bookingData || {};
  const rawType = bookingData?.booking_type || d.booking_type || "booking";
  const { typeLabel, contactLabel } = getBookingMeta(rawType, d);

  const itemName =
    d.item_name     || d.name       ||
    d.trip_name     || d.event_name ||
    d.hotel_name    || d.place_name || "Booking";

  const listingLocation = d.location      || d.locationName  || "";
  const listingPlace    = d.place         || "";
  const listingCountry  = d.country       || "";
  const openingHours    = d.opening_hours || d.openingHours  || "";
  const closingHours    = d.closing_hours || d.closingHours  || "";
  const daysOpened      = d.days_opened   || d.workingDays   || [];
  const eventCategory   = d.event_category || "";
  const registrationNum = d.registration_number || d.registrationNumber || "";
  const entranceFeeType = d.entry_fee_type || d.entranceFeeType || "";

  const hostPhone =
    bookingData?.host_phone      ||
    d.host_phone                 ||
    bookingData?.emailData?.hostPhone ||
    d.emailData?.hostPhone       ||
    d.phone_number               ||
    (Array.isArray(d.phone_numbers) ? d.phone_numbers[0] : "") ||
    "";

  const hostEmail =
    bookingData?.host_email      ||
    d.host_email                 ||
    bookingData?.emailData?.hostEmail ||
    d.emailData?.hostEmail       ||
    d.email                      ||
    "";

  const gName  = bookingData?.guest_name  || d.guest_name;
  const gEmail = bookingData?.guest_email || d.guest_email;
  const gPhone = bookingData?.guest_phone || d.guest_phone;

  const ticketSelections   = d.ticketSelections   || d.ticket_selections   || [];
  const selectedActivities = d.selectedActivities || d.selected_activities || d.activities || [];
  const selectedFacilities = d.selectedFacilities || d.selected_facilities || d.facilities || [];
  const visitDate          = bookingData?.visit_date || d.visit_date || d.date || "";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();

  const TEAL_RGB:  [number,number,number] = [0,128,128];
  const CORAL_RGB: [number,number,number] = [255,127,80];
  const SLATE_RGB: [number,number,number] = [51,65,85];
  const LIGHT_RGB: [number,number,number] = [248,249,250];
  const MUTED_RGB: [number,number,number] = [100,116,139];
  const AMBER_RGB: [number,number,number] = [180,120,0];
  const WHITE:     [number,number,number] = [255,255,255];

  let y = 0;
  const M  = 36;
  const CW = W - M * 2;

  const newPage = (need = 40) => {
    if (y > H - need - 60) { doc.addPage(); y = 40; }
  };

  const section = (title: string) => {
    newPage(50);
    y += 4;
    doc.setFillColor(...TEAL_RGB);
    doc.rect(M, y, 3, 13, "F");
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(M + 3, y, CW - 3, 13, 2, 2, "F");
    doc.setTextColor(...TEAL_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(title, M + 10, y + 9.5);
    y += 22;
  };

  const infoRow = (label: string, value: string | number | null | undefined) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    newPage(28);
    const valStr  = String(value);
    const maxW    = CW - 100;
    const lines: string[] = doc.splitTextToSize(valStr, maxW);
    const rowH    = lines.length > 1 ? 14 + lines.length * 11 : 22;
    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(M, y, CW, rowH, 3, 3, "F");
    doc.setTextColor(...MUTED_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(String(label).toUpperCase(), M + 8, y + 9);
    doc.setTextColor(...SLATE_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (lines.length > 1) {
      lines.forEach((ln: string, i: number) =>
        doc.text(ln, W - M - 8, y + 14 + i * 11, { align: "right" })
      );
    } else {
      doc.text(valStr, W - M - 8, y + 15, { align: "right" });
    }
    y += rowH + 5;
  };

  const tableHeader = (left: string, right: string) => {
    newPage(22);
    doc.setFillColor(...TEAL_RGB);
    doc.roundedRect(M, y, CW, 18, 3, 3, "F");
    doc.setTextColor(...WHITE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(left,  M + 8,     y + 12);
    doc.text(right, W - M - 8, y + 12, { align: "right" });
    y += 22;
  };

  const tableRow = (left: string, right: string, sub?: string) => {
    newPage(36);
    const rowH = sub ? 32 : 22;
    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(M, y, CW, rowH, 3, 3, "F");
    doc.setTextColor(...SLATE_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const maxL: string[] = doc.splitTextToSize(left, CW - 100);
    maxL.slice(0, 2).forEach((ln: string, i: number) =>
      doc.text(ln, M + 8, y + 13 + i * 10)
    );
    if (sub) {
      doc.setTextColor(...MUTED_RGB);
      doc.setFontSize(7);
      doc.text(sub, M + 8, y + 26, { maxWidth: CW - 100 });
    }
    doc.setTextColor(...TEAL_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(right, W - M - 8, y + (sub ? 17 : 14), { align: "right" });
    y += rowH + 4;
  };

  // Header
  doc.setFillColor(...TEAL_RGB);
  doc.rect(0, 0, W, 96, "F");
  doc.setFillColor(...CORAL_RGB);
  doc.triangle(W - 110, 0, W, 0, W, 96, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("REALTRAVO", M, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("BOOKING CONFIRMATION", M, 56);
  doc.setFontSize(7);
  doc.text(`Ref: ${reference}`, M, 70);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, M, 82);

  y = 108;

  doc.setFillColor(16, 185, 129);
  doc.roundedRect(W - 132, 98, 96, 22, 11, 11, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CONFIRMED", W - 84, 113, { align: "center" });

  doc.setTextColor(...TEAL_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text(itemName, M, y, { maxWidth: W - M * 2 - 110 });
  y += 18;

  doc.setTextColor(...MUTED_RGB);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${typeLabel.toUpperCase()} BOOKING`, M, y);
  y += 10;

  if (listingLocation || listingPlace || listingCountry) {
    const loc = [listingLocation, listingPlace, listingCountry].filter(Boolean).join(", ");
    doc.setFontSize(7.5);
    doc.text(`📍 ${loc}`, M, y + 6);
    y += 14;
  }
  y += 10;

  doc.setDrawColor(...TEAL_RGB);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 14;

  section("BOOKING INFORMATION");
  infoRow("Payment Reference", reference);
  infoRow("Payment Status",    "PAID");
  infoRow("Total Amount",      fmtMoney(bookingData?.total_amount ?? 0));
  infoRow("Booked On",         fmtDate(new Date().toISOString()));
  if (visitDate)               infoRow("Visit Date",     fmtDate(visitDate));
  if (eventCategory)           infoRow("Event Category", eventCategory);
  if (registrationNum)         infoRow("Reg. Number",    registrationNum);
  if (entranceFeeType)         infoRow("Entrance Type",  entranceFeeType.toUpperCase());
  if (openingHours && closingHours) infoRow("Operating Hours", `${openingHours} – ${closingHours}`);
  if (Array.isArray(daysOpened) && daysOpened.length)
                               infoRow("Open Days",      daysOpened.join(", "));
  y += 6;

  if (gName || gEmail || gPhone) {
    section("GUEST DETAILS");
    infoRow("Name",  gName);
    infoRow("Email", gEmail);
    infoRow("Phone", gPhone);
    y += 6;
  }

  const adults   = d.adults   || d.num_adults;
  const children = d.children || d.num_children;
  section("BOOKING DETAILS");
  infoRow("Adults",       adults);
  infoRow("Children",     children);
  infoRow("Slots Booked", bookingData?.slots_booked);
  infoRow("Location",     d.location || d.locationName);
  y += 6;

  if (ticketSelections.length) {
    section("TICKETS");
    tableHeader("TICKET TYPE", "SUBTOTAL");
    ticketSelections.forEach((t: any) => {
      const qty = t.quantity || 1;
      tableRow(t.name, fmtMoney(t.price * qty), `${qty} person${qty > 1 ? "s" : ""} × ${fmtMoney(t.price)} per ticket`);
    });
    y += 6;
  }

  if (selectedActivities.length) {
    section("ACTIVITIES");
    tableHeader("ACTIVITY  /  PEOPLE", "SUBTOTAL");
    selectedActivities.forEach((a: any) => {
      const ppl = a.numberOfPeople || a.number_of_people || 1;
      tableRow(a.name, fmtMoney((a.price || 0) * ppl), `${ppl} person${ppl > 1 ? "s" : ""} × ${fmtMoney(a.price || 0)} per person`);
    });
    y += 6;
  }

  if (selectedFacilities.length) {
    section("FACILITIES");
    tableHeader("FACILITY  /  DATES", "PRICE");
    selectedFacilities.forEach((f: any) => {
      let sub   = "";
      let price = f.price || 0;
      if (f.startDate && f.endDate) {
        const days = Math.max(1, Math.ceil(
          (new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000
        ));
        price = (f.price || 0) * days;
        sub   = `From: ${fmtShort(f.startDate)}  →  To: ${fmtShort(f.endDate)}  (${days} day${days > 1 ? "s" : ""} × ${fmtMoney(f.price || 0)}/day)`;
      }
      const ppl = f.numberOfPeople || f.number_of_people;
      if (ppl) sub += (sub ? "  ·  " : "") + `${ppl} person${ppl > 1 ? "s" : ""}`;
      tableRow(f.name, fmtMoney(price), sub || undefined);
    });
    y += 6;
  }

  if (hostPhone || hostEmail) {
    section(`${contactLabel.toUpperCase()} CONTACT`);
    newPage(60);
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(M, y, CW, 50, 5, 5, "F");
    doc.setDrawColor(...AMBER_RGB);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 50, 5, 5, "S");
    doc.setTextColor(...AMBER_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`Contact the ${contactLabel} below for any inquiries,`, M + 10, y + 15);
    doc.text("cancellations, refunds, or booking transfers.", M + 10, y + 27);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Please have your booking reference ready when contacting.", M + 10, y + 40);
    y += 58;
    infoRow("Phone", hostPhone);
    infoRow("Email", hostEmail);
    y += 6;
  }

  newPage(60);
  y += 10;
  doc.setFillColor(...TEAL_RGB);
  doc.roundedRect(M, y, CW, 48, 6, 6, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL AMOUNT PAID", M + 14, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(179, 230, 230);
  doc.text("CONFIRMED & PAID", M + 14, y + 32);
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(fmtMoney(bookingData?.total_amount ?? 0), W - M - 14, y + 32, { align: "right" });
  y += 62;

  const qrText = `REALTRAVO|${reference}|${itemName}|${gName || ""}|KES ${Math.round(bookingData?.total_amount ?? 0)}|${visitDate || new Date().toISOString().split("T")[0]}`;
  const qrDataUrl = await generateQRDataUrl(qrText, 120);
  if (qrDataUrl) {
    newPage(140);
    y += 8;
    doc.setFillColor(...LIGHT_RGB);
    doc.roundedRect(M, y, CW, 130, 8, 8, "F");
    doc.setDrawColor(...TEAL_RGB);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 130, 8, 8, "S");
    doc.addImage(qrDataUrl, "PNG", M + 14, y + 15, 100, 100);
    doc.setTextColor(...TEAL_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("BOOKING QR CODE", M + 130, y + 32);
    doc.setTextColor(...MUTED_RGB);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    ["Scan this QR code at the venue to verify",
     "your booking. Present this PDF or the QR",
     "code on your mobile device to the host."]
      .forEach((ln, i) => doc.text(ln, M + 130, y + 50 + i * 13));
    doc.setTextColor(...SLATE_RGB);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(`Booking Ref: ${reference}`, M + 130, y + 108);
    y += 146;
  }

  const footerY = H - 52;
  doc.setFillColor(240, 253, 250);
  doc.rect(0, footerY - 12, W, 64, "F");
  doc.setDrawColor(...TEAL_RGB);
  doc.setLineWidth(1.2);
  doc.line(0, footerY - 12, W, footerY - 12);
  doc.setFillColor(...TEAL_RGB);
  doc.circle(M, footerY + 10, 3, "F");
  doc.setFillColor(...CORAL_RGB);
  doc.circle(M + 10, footerY + 10, 3, "F");
  doc.setTextColor(...TEAL_RGB);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("realtravo.com", W / 2, footerY + 4, { align: "center" });
  doc.setTextColor(...MUTED_RGB);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Thank you for booking with Realtravo!  ·  support@realtravo.com", W / 2, footerY + 18, { align: "center" });
  doc.text(`Booking Ref: ${reference}`, W / 2, footerY + 30, { align: "center" });

  doc.save(`realtravo-booking-${reference.slice(0, 8)}.pdf`);
};

// ── Portal header ─────────────────────────────────────────────────────────────
const PaystackFloatingHeader = ({ itemName, onBack }: { itemName: string; onBack: () => void }) =>
  createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 2147483647,
      pointerEvents: "auto", backgroundColor: "#ffffff",
      borderBottom: "1px solid #f1f5f9", boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
      paddingTop: "max(env(safe-area-inset-top, 0px), 10px)",
      paddingBottom: "10px", paddingLeft: "16px", paddingRight: "16px",
      display: "flex", alignItems: "center", gap: "12px",
    }}>
      <button onClick={onBack} aria-label="Back to checkout" style={{
        width: 36, height: 36, borderRadius: "50%", backgroundColor: "#f1f5f9",
        border: "none", cursor: "pointer", display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f1f5f9")}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Back to Checkout</p>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: COLORS.TEAL, textTransform: "uppercase", letterSpacing: "-0.03em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemName}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#f0fdfa", color: "#0f766e", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 999, flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        Secure Pay
      </div>
    </div>,
    document.body
  );

// ── Main page ─────────────────────────────────────────────────────────────────
const BookingPage = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate     = useNavigate();
  const goBack       = useSafeBack();
  const { toast }    = useToast();
  const { user }     = useAuth();

  const [item, setItem]                         = useState<any>(null);
  const [loading, setLoading]                   = useState(true);
  const [isProcessing, setIsProcessing]         = useState(false);
  const [isVerifying, setIsVerifying]           = useState(false);
  const [isCompleted, setIsCompleted]           = useState(false);
  const [searchParams]                          = useSearchParams();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [completedBookingData, setCompletedBookingData] = useState<any>(null);

  // ── Read pre-selected facility from URL param ──────────────────
  const preSelectedFacilityName = searchParams.get("facilityName") || "";

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
      onError: (error) => {
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
    if (showPaystackContainer && !isCompleted && !isVerifying)
      document.body.style.paddingTop = "64px";
    else document.body.style.paddingTop = "";
    return () => { document.body.style.paddingTop = ""; };
  }, [showPaystackContainer, isCompleted, isVerifying]);

  useEffect(() => { if (id && type) fetchItem(); window.scrollTo(0, 0); }, [id, type]);

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
          "closing_hours,days_opened,type,approval_status,is_hidden,ticket_types,allow_children," +
          "event_category,inclusions,exclusions"
        ).eq("id", id).maybeSingle();
        data = r.data; error = r.error;
      } else if (type === "adventure_place" || type === "adventure") {
        const r = await supabase.from("adventure_places").select(
          "id,name,location,place,country,image_url,description,amenities," +
          "facilities,activities,phone_numbers,email,opening_hours,closing_hours," +
          "days_opened,approval_status,is_hidden,entry_fee,entry_fee_type,available_slots,created_by," +
          "registration_number,entry_fee_type"
        ).eq("id", id).maybeSingle();
        data = r.data; error = r.error;
      } else if (type === "hotel") {
        const r = await supabase.from("hotels").select(
          "id,name,location,place,country,image_url,description,amenities," +
          "facilities,activities,phone_numbers,email,opening_hours,closing_hours," +
          "days_opened,approval_status,is_hidden,available_rooms,created_by," +
          "establishment_type,general_booking_link"
        ).eq("id", id).maybeSingle();
        data = r.data; error = r.error;
      }

      if (error) { toast({ title: "Item not found", description: "Could not load booking details.", variant: "destructive" }); navigate(-1); return; }
      if (!data)  { toast({ title: "Item not found", description: "The item you're trying to book doesn't exist.", variant: "destructive" }); navigate(-1); return; }
      if (data.is_hidden || (data.approval_status && data.approval_status !== "approved")) {
        toast({ title: "Unavailable", description: "This item is not currently available for booking.", variant: "destructive" }); navigate("/"); return;
      }
      setItem(data);
    } catch { toast({ title: "Item not found", variant: "destructive" }); navigate(-1); }
    finally { setLoading(false); }
  };

  const getBookingType = (): BookingType => {
    if (type === "trip")    return "trip";
    if (type === "event")   return "event";
    if (type === "adventure_place" || type === "adventure") return "adventure_place";
    if (type === "hotel")   return "hotel";
    return "attraction";
  };

  const getHostContact = () => {
    if (!item) return { phone: "", email: "" };
    if (type === "trip" || type === "event") {
      return { phone: item.phone_number || "", email: item.email || "" };
    }
    const phones: string[] = Array.isArray(item.phone_numbers) ? item.phone_numbers : [];
    return { phone: phones[0] || "", email: item.email || "" };
  };

  const getItemTypeLabel = () => {
    if (!item || !type) return "Booking";
    const isGuided = type === "trip" && (item.type === "guided" || item.is_guided === true);
    if (type === "trip")    return isGuided ? "Tour" : "Trip";
    if (type === "event")   return "Event";
    if (type === "adventure_place" || type === "adventure") return "Adventure Place";
    if (type === "hotel")   return "Hotel";
    return "Booking";
  };

  const handleBookingSubmit = async (formData: BookingFormData) => {
    if (!item || !type) return;
    setIsProcessing(true);
    try {
      let totalAmount = 0;
      const bookingType   = getBookingType();
      const isFacilityOnly = searchParams.get("skipToFacility") === "true";

      if (type === "trip" || type === "event") {
        if (formData.ticketSelections?.length) {
          formData.ticketSelections.forEach((t) => (totalAmount += t.price * t.quantity));
        } else {
          totalAmount = formData.num_adults * item.price + formData.num_children * (item.price_child || 0);
        }
      } else if (type === "adventure_place" || type === "adventure") {
        if (!isFacilityOnly) totalAmount = (formData.num_adults + formData.num_children) * (item.entry_fee || 0);
        formData.selectedActivities?.forEach((a) => (totalAmount += a.price * a.numberOfPeople));
        formData.selectedFacilities?.forEach((f) => {
          if (f.startDate && f.endDate) {
            const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000);
            totalAmount += f.price * Math.max(days, 1);
          }
        });
      } else if (type === "hotel") {
        formData.selectedActivities?.forEach((a) => (totalAmount += a.price * a.numberOfPeople));
        formData.selectedFacilities?.forEach((f) => {
          if (f.startDate && f.endDate) {
            const days = Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / 86400000);
            totalAmount += f.price * Math.max(days, 1);
          }
        });
      }

      const slotsBooked = isFacilityOnly
        ? formData.selectedFacilities?.length || 1
        : formData.num_adults + formData.num_children;

      let visitDate = formData.visit_date || item.date;
      if (isFacilityOnly && formData.selectedFacilities?.length && formData.selectedFacilities[0].startDate)
        visitDate = formData.selectedFacilities[0].startDate;

      const hostContact              = getHostContact();
      const { typeLabel, contactLabel } = getBookingMeta(bookingType, formData);

      const bookingData = {
        item_id:      item.id,
        booking_type: bookingType,
        type_label:   typeLabel,
        contact_label: contactLabel,
        total_amount: totalAmount,
        booking_details: {
          ...formData,
          item_name:      item.name,
          name:           item.name,
          location:       item.location,
          place:          item.place,
          country:        item.country,
          opening_hours:  item.opening_hours  || "",
          closing_hours:  item.closing_hours  || "",
          days_opened:    item.days_opened    || [],
          email:          item.email          || "",
          phone_number:   item.phone_number   || "",
          phone_numbers:  item.phone_numbers  || [],
          event_category: item.event_category || "",
          registration_number: item.registration_number || "",
          entry_fee_type: item.entry_fee_type || "",
          is_facility_only: isFacilityOnly,
          adults:    formData.num_adults,
          children:  formData.num_children,
          facilities: formData.selectedFacilities,
          activities: formData.selectedActivities,
        },
        user_id:          user?.id || null,
        is_guest_booking: !user,
        guest_name:       formData.guest_name,
        guest_email:      formData.guest_email,
        guest_phone:      formData.guest_phone || "",
        visit_date:       visitDate,
        slots_booked:     slotsBooked,
        host_id:          item.created_by,
        referral_tracking_id: getReferralTrackingId(),
        host_phone: hostContact.phone,
        host_email: hostContact.email,
        emailData: {
          itemName:     item.name,
          typeLabel,
          contactLabel,
          hostPhone:    hostContact.phone,
          hostEmail:    hostContact.email,
        },
      };

      await initiatePayment(formData.guest_email, totalAmount, bookingData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    }
  };

  const handlePaystackBack = () => {
    setIsProcessing(false); setIsVerifying(false);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F9FA]">
        <Loader2 className="h-10 w-10 animate-spin text-[#008080] mb-4" />
        <p className="text-sm font-black uppercase tracking-tighter animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!item) return null;

  const getMultiStepProps = () => {
    const baseProps = {
      onSubmit: handleBookingSubmit,
      isProcessing: isProcessing || isPaymentLoading,
      isCompleted,
      itemName:  item.name,
      itemId:    item.id,
      hostId:    item.created_by || "",
      onPaymentSuccess: () => setIsCompleted(true),
      primaryColor: COLORS.TEAL,
      accentColor:  COLORS.CORAL,
      // ── pass pre-selected facility ──────────────────────────────
      preSelectedFacilityName,
    };

    if (type === "trip" || type === "event") {
      const parsedTicketTypes = Array.isArray(item.ticket_types)
        ? (item.ticket_types as any[]).map((t: any) => ({ name: t.name, price: Number(t.price) }))
        : [];
      return {
        ...baseProps, bookingType: type,
        priceAdult: item.price, priceChild: item.price_child,
        activities: item.activities || [],
        skipFacilitiesAndActivities: true,
        skipDateSelection: !item.is_custom_date && !item.is_flexible_date,
        fixedDate: item.is_flexible_date ? "" : item.date,
        totalCapacity: item.available_tickets || 0,
        slotLimitType: item.slot_limit_type || (item.is_flexible_date ? "per_booking" : "inventory"),
        isFlexibleDate: item.is_flexible_date || false,
        ticketTypes:   parsedTicketTypes,
        allowChildren: item.allow_children !== false,
      };
    }

    if (type === "adventure_place" || type === "adventure") {
      return {
        ...baseProps, bookingType: "adventure_place",
        priceAdult: item.entry_fee || 0, priceChild: item.entry_fee || 0,
        entranceType: item.entry_fee_type || "paid",
        facilities:   item.facilities    || [],
        activities:   item.activities    || [],
        totalCapacity: item.available_slots || 0,
        workingDays:  item.days_opened   || [],
        skipDateSelection: false,
      };
    }

    if (type === "hotel") {
      return {
        ...baseProps, bookingType: "hotel",
        priceAdult: 0, priceChild: 0, entranceType: "free",
        facilities:   item.facilities   || [],
        activities:   item.activities   || [],
        totalCapacity: item.available_rooms || 0,
        workingDays:  item.days_opened  || [],
      };
    }

    return baseProps;
  };

  const paystackIsActive = showPaystackContainer && !isCompleted && !isVerifying;
  const itemTypeLabel    = getItemTypeLabel();

  return (
    <div className="min-h-screen bg-[#F8F9FA]">

      {paystackIsActive && item && (
        <PaystackFloatingHeader itemName={item.name} onBack={handlePaystackBack} />
      )}

      {!isCompleted && !showPaystackContainer && (
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
          <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="icon"
              onClick={() => {
                if (isProcessing || isVerifying) { setIsProcessing(false); setIsVerifying(false); }
                else goBack();
              }}
              className="rounded-full bg-slate-100 hover:bg-slate-200">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black uppercase tracking-tight truncate" style={{ color: COLORS.TEAL }}>
                {isVerifying ? "Checkout" : `Book ${itemTypeLabel} — ${item.name}`}
              </h1>
              <p className="text-xs text-slate-500 truncate">
                {isVerifying ? "Processing payment..." : `${item.location}, ${item.country}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {isVerifying && !isCompleted && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-2 text-center">Processing Your Booking</h2>
          <p className="text-sm text-muted-foreground text-center max-w-xs">Please wait while we verify your payment and confirm your booking...</p>
          <div className="mt-6 flex items-center gap-2">
            {[0, 150, 300].map((delay) => (
              <div key={delay} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
      )}

      {showPaystackContainer && !isCompleted && !isVerifying && (
        <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-black uppercase tracking-tight mb-1" style={{ color: COLORS.TEAL }}>Complete Payment</h2>
              <p className="text-xs text-slate-500">Enter your payment details below to complete your booking</p>
            </div>
            <div id="paystack-checkout-container" className="w-full min-h-[400px]" />
          </div>
        </div>
      )}

      {!isCompleted && !isVerifying && !showPaystackContainer && (
        <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
          <div className="bg-white rounded-[32px] shadow-xl border border-slate-100">
            <MultiStepBooking {...getMultiStepProps()} />
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
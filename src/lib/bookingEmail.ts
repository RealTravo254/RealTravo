import { supabase } from "@/integrations/supabase/client";
import { getBookingLines, fmtShort, type BookingLine } from "@/lib/bookingPdf";

export type InquiryEmailKind = "pending_payment";

/**
 * Asks the `send-booking-email` edge function to send the email.
 * (The paid/confirmed emails are already sent by your existing paystack-verify → send-booking-confirmation.)
 * - pending_payment   → guest gets "Accepted – waiting for payment" + Pay now link
 * Never throws: a failed email must not break accepting / paying.
 */
export const sendInquiryEmail = async (inquiryId: string, kind: InquiryEmailKind) => {
  try {
    await supabase.functions.invoke("send-booking-email", { body: { inquiry_id: inquiryId, kind } });
  } catch (e) {
    console.error("send-booking-email failed:", e);
  }
};

/**
 * Where "Pay now" goes. This is BookingPage with ?inquiry=<id>.
 * ⚠ Change "/booking" below if BookingPage is mounted on a different route in your router.
 */
export const BOOKING_ROUTE_PREFIX = "/booking";

/** Route type + item id. Your table stores them as item_type / place_id; item_id / booking_type are filled by a trigger. */
export const inquiryPayPath = (row: any) =>
  `${BOOKING_ROUTE_PREFIX}/${row.booking_type || row.item_type || "adventure_place"}/${row.item_id || row.place_id}?inquiry=${row.id}`;

/**
 * The amount the guest must pay, in priority order:
 * host-adjusted price → guest's offered price → total_amount → listing's current price.
 */
export const inquiryAmount = (row: any) =>
  Number(row?.agreed_amount ?? row?.offered_price ?? row?.total_amount ?? row?.current_price ?? 0) || 0;

/**
 * booking_details with a guaranteed priced line. Your inquiries store a date, guests and a price
 * (no ticket form), so when there are no lines we create one "agreed price" ticket. Because the
 * booking is saved with it, the PDF, emails, Bookings page and scanner all show it.
 */
export const inquiryBookingDetails = (row: any) => {
  const d = { ...(row?.booking_details || {}) };
  const guests = Number(row?.guests ?? row?.slots_booked ?? 0) || 1;
  if (getBookingLines(d).length === 0) {
    d.ticketSelections = [{
      name: `${row?.item_name || "Custom booking"} — agreed price`,
      price: inquiryAmount(row),
      quantity: 1,
    }];
  }
  if (d.adults === undefined && d.num_adults === undefined) d.adults = guests;
  if (d.visit_date === undefined && row?.visit_date) d.visit_date = row.visit_date;
  if (row?.note && d.note === undefined) d.note = row.note;
  return d;
};

export const inquiryLines = (row: any): BookingLine[] => {
  const lines = getBookingLines(row?.booking_details);
  if (lines.length) return lines;
  const amount = inquiryAmount(row);
  if (amount <= 0) return [];
  const guests = Number(row?.guests ?? row?.slots_booked ?? 0) || 1;
  return [{
    section: "Tickets",
    label: `${row?.item_name || "Custom booking"} — agreed price`,
    sub: `${guests} guest${guests > 1 ? "s" : ""}${row?.visit_date ? " · " + fmtShort(row.visit_date) : ""}`,
    amount,
  }];
};
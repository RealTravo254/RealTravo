import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface FacilityDetail {
  name: string;
  price: number;
  startDate?: string;
  endDate?: string;
}

export interface ActivityDetail {
  name: string;
  price: number;
  numberOfPeople?: number;
}

export interface BookingPDFData {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  hostName?: string;
  /** Host email — fetched in BookingPage for PDF/receipt only, never shown in UI */
  hostEmail?: string;
  /** Host phone — fetched in BookingPage for PDF/receipt only, never shown in UI */
  hostPhone?: string;
  itemName: string;
  bookingType: string;
  visitDate: string;
  totalAmount: number;
  adults?: number;
  children?: number;
  slotsBooked?: number;
  paymentStatus: string;
  facilities?: FacilityDetail[];
  activities?: ActivityDetail[];
}

export const downloadBookingAsPDF = async (
  booking: BookingPDFData,
  qrCodeDataUrl: string
): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(0, 128, 128);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Booking Confirmation", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Your booking has been confirmed", pageWidth / 2, 32, { align: "center" });

  // ── Booking ID strip ─────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(14, 48, pageWidth - 28, 20, 3, 3, "F");

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Booking ID", pageWidth / 2, 56, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 128, 128);
  doc.text(booking.bookingId, pageWidth / 2, 64, { align: "center" });

  let yPos = 78;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const addRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(label, 14, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(value, pageWidth - 14, yPos, { align: "right" });
    yPos += 8;
  };

  const sectionHeader = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(title, 14, yPos);
    doc.setDrawColor(240, 240, 240);
    doc.line(14, yPos + 3, pageWidth - 14, yPos + 3);
    yPos += 12;
  };

  // ── Guest Information ────────────────────────────────────────────────────────
  sectionHeader("GUEST INFORMATION");
  addRow("Name", booking.guestName);
  addRow("Email", booking.guestEmail);
  if (booking.guestPhone) addRow("Phone", booking.guestPhone);
  yPos += 6;

  // ── Booking Details ──────────────────────────────────────────────────────────
  sectionHeader("BOOKING DETAILS");
  addRow("Item Booked", booking.itemName);
  addRow(
    "Type",
    booking.bookingType.charAt(0).toUpperCase() + booking.bookingType.slice(1)
  );
  addRow("Visit Date", format(new Date(booking.visitDate), "PPP"));
  if (booking.slotsBooked) addRow("Number of People", String(booking.slotsBooked));
  if (booking.adults !== undefined) addRow("Adults", String(booking.adults));
  if (booking.children !== undefined && booking.children > 0)
    addRow("Children", String(booking.children));

  // Payment status (coloured)
  const statusColor =
    booking.paymentStatus === "paid" || booking.paymentStatus === "completed"
      ? ([34, 197, 94] as [number, number, number])
      : ([234, 179, 8] as [number, number, number]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Payment Status", 14, yPos);
  doc.setTextColor(...statusColor);
  doc.setFont("helvetica", "bold");
  doc.text(booking.paymentStatus.toUpperCase(), pageWidth - 14, yPos, { align: "right" });
  yPos += 12;

  // ── Host Contact (PDF only — never shown in the app UI) ──────────────────────
  if (booking.hostName || booking.hostEmail || booking.hostPhone) {
    sectionHeader("HOST CONTACT");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (booking.hostName)  addRow("Host",        booking.hostName);
    if (booking.hostEmail) addRow("Host Email",  booking.hostEmail);
    if (booking.hostPhone) addRow("Host Phone",  booking.hostPhone);
    yPos += 4;
  }

  // ── Facilities ───────────────────────────────────────────────────────────────
  if (booking.facilities && booking.facilities.length > 0) {
    sectionHeader("FACILITIES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    booking.facilities.forEach((f) => {
      const dateRange =
        f.startDate && f.endDate
          ? ` (${format(new Date(f.startDate), "MMM dd")} - ${format(
              new Date(f.endDate),
              "MMM dd, yyyy"
            )})`
          : "";
      const price = f.price === 0 ? "Free" : `KES ${f.price.toLocaleString()}/day`;
      doc.text(`• ${f.name}${dateRange} - ${price}`, 18, yPos);
      yPos += 7;
    });
    yPos += 5;
  }

  // ── Activities ───────────────────────────────────────────────────────────────
  if (booking.activities && booking.activities.length > 0) {
    sectionHeader("ACTIVITIES");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    booking.activities.forEach((a) => {
      const people = a.numberOfPeople
        ? ` × ${a.numberOfPeople} ${a.numberOfPeople === 1 ? "person" : "people"}`
        : "";
      const price = a.price === 0 ? "Free" : `KES ${a.price.toLocaleString()}/person`;
      doc.text(`• ${a.name}${people} - ${price}`, 18, yPos);
      yPos += 7;
    });
    yPos += 5;
  }

  // ── Total Amount ─────────────────────────────────────────────────────────────
  doc.setFillColor(0, 128, 128);
  doc.roundedRect(14, yPos, pageWidth - 28, 25, 3, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Total Amount", 20, yPos + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(
    `KES ${booking.totalAmount.toLocaleString()}`,
    pageWidth - 20,
    yPos + 16,
    { align: "right" }
  );
  yPos += 35;

  // ── QR Code ──────────────────────────────────────────────────────────────────
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(14, yPos, pageWidth - 28, 65, 3, 3, "F");

  const qrSize = 45;
  const qrX = (pageWidth - qrSize) / 2;
  doc.addImage(qrCodeDataUrl, "PNG", qrX, yPos + 5, qrSize, qrSize);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 128, 128);
  doc.text("CHECK-IN QR CODE", pageWidth / 2, yPos + 55, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Show this QR code at the venue for quick check-in",
    pageWidth / 2,
    yPos + 61,
    { align: "center" }
  );

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Thank you for booking with us!", pageWidth / 2, footerY - 5, {
    align: "center",
  });
  doc.text(
    `Generated on ${format(new Date(), "PPP")}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // ── Save ─────────────────────────────────────────────────────────────────────
  const safeId = booking.bookingId.slice(0, 8);
  doc.save(`booking-${safeId}.pdf`);
};

export const generateQRCodeData = (booking: BookingPDFData): string => {
  return JSON.stringify({
    bookingId: booking.bookingId,
    visitDate: booking.visitDate,
    email: booking.guestEmail,
  });
};
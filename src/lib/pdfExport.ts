import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface BookingForExport {
  id: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  visit_date: string | null;
  total_amount: number | null;
  slots_booked: number | null;
  booking_type: string | null;
  payment_status: string | null; 
  status: string | null;
  created_at: string | null;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
}

export const exportBookingsToPDF = async (
  bookings: BookingForExport[],
  itemName: string
): Promise<void> => {
  const doc = new jsPDF();
  const dateStr = format(new Date(), "yyyy-MM-dd");

  // Title
  doc.setFontSize(20);
  doc.setTextColor(0, 128, 128); // Teal color
  doc.text(`Bookings Report: ${itemName}`, 14, 20);

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${format(new Date(), "PPP 'at' p")}`, 14, 28);
  doc.text(`Total Bookings: ${bookings.length}`, 14, 34);

  // Calculate totals
  const totalRevenue = bookings.reduce(
    (sum, b) => sum + (b.total_amount || 0),
    0
  );
  const totalGuests = bookings.reduce(
    (sum, b) => sum + (b.slots_booked || 1),
    0
  );
  const checkedInCount = bookings.filter((b) => b.checked_in).length;

  // Summary stats
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total Revenue: KES ${totalRevenue.toLocaleString()}`, 14, 42);
  doc.text(`Total Guests: ${totalGuests}`, 14, 48);
  doc.text(`Checked In: ${checkedInCount} / ${bookings.length}`, 14, 54);

  // Table data
  const tableData = bookings.map((booking) => [
    booking.id.slice(0, 8) + "...",
    booking.guest_name || "N/A",
    booking.guest_email || "N/A",
    booking.guest_phone || "N/A",
    booking.visit_date
      ? format(new Date(booking.visit_date), "dd MMM yyyy")
      : "N/A",
    String(booking.slots_booked || 1),
    `KES ${(booking.total_amount || 0).toLocaleString()}`,
    booking.payment_status || "N/A",
    booking.status || "N/A",
    booking.checked_in ? "Yes" : "No",
    booking.created_at
      ? format(new Date(booking.created_at), "dd MMM yyyy")
      : "N/A",
  ]);

  // Generate table
  autoTable(doc, {
    startY: 62,
    head: [
      [
        "ID",
        "Guest Name",
        "Email",
        "Phone",
        "Visit Date",
        "People",
        "Amount",
        "Payment",
        "Status",
        "Checked In",
        "Booked On",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [0, 128, 128],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    bodyStyles: {
      fontSize: 6,
    },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 20 },
      4: { cellWidth: 18 },
      5: { cellWidth: 12 },
      6: { cellWidth: 18 },
      7: { cellWidth: 14 },
      8: { cellWidth: 14 },
      9: { cellWidth: 14 },
      10: { cellWidth: 18 },
    },
    margin: { left: 8, right: 8 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save
  const safeItemName = itemName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`bookings_${safeItemName}_${dateStr}.pdf`);
};

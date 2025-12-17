import { format } from "date-fns";

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

export const exportBookingsToCSV = (bookings: BookingForExport[], itemName: string) => {
  const headers = [
    "Booking ID",
    "Guest Name",
    "Guest Email",
    "Guest Phone",
    "Visit Date",
    "People",
    "Total Amount (KES)",
    "Payment Status",
    "Booking Status",
    "Checked In",
    "Checked In At",
    "Booked On"
  ];

  const rows = bookings.map(booking => [
    booking.id,
    booking.guest_name || "",
    booking.guest_email || "",
    booking.guest_phone || "",
    booking.visit_date ? format(new Date(booking.visit_date), "yyyy-MM-dd") : "",
    booking.slots_booked || 1,
    booking.total_amount || 0,
    booking.payment_status || "",
    booking.status || "",
    booking.checked_in ? "Yes" : "No",
    booking.checked_in_at ? format(new Date(booking.checked_in_at), "yyyy-MM-dd HH:mm") : "",
    booking.created_at ? format(new Date(booking.created_at), "yyyy-MM-dd HH:mm") : ""
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  const safeItemName = itemName.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = format(new Date(), "yyyy-MM-dd");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `bookings_${safeItemName}_${dateStr}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

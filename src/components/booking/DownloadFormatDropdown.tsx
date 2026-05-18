import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportBookingsToCSV } from "@/lib/csvExport";
import { exportBookingsToPDF } from "@/lib/pdfExport";
import { toast } from "sonner";

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

interface DownloadFormatDropdownProps {
  bookings: BookingForExport[];
  itemName: string;
  className?: string;
}

export const DownloadFormatDropdown = ({
  bookings,
  itemName,
  className,
}: DownloadFormatDropdownProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleCSVDownload = () => {
    try {
      exportBookingsToCSV(bookings, itemName);
      toast.success("CSV downloaded successfully");
    } catch (error) {
      console.error("CSV export error:", error);
      toast.error("Failed to download CSV");
    }
  };

  const handlePDFDownload = async () => {
    setIsExporting(true);
    try {
      await exportBookingsToPDF(bookings, itemName);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to download PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={`bg-[#008080] hover:bg-[#006666] text-white rounded-xl px-6 py-6 font-black uppercase tracking-widest text-xs flex items-center gap-2 ${className}`}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download All ({bookings.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCSVDownload} className="cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
          <span className="font-semibold">Download as CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDFDownload} className="cursor-pointer">
          <FileText className="h-4 w-4 mr-2 text-red-600" />
          <span className="font-semibold">Download as PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

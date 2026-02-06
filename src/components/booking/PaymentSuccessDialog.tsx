import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, X } from "lucide-react";
import { BookingDownloadButton } from "./BookingDownloadButton";
import { BookingPDFData } from "@/lib/pdfBookingExport";
import { useNavigate } from "react-router-dom";

interface PaymentSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingData: any;
  reference: string;
}

export const PaymentSuccessDialog = ({
  open,
  onOpenChange,
  bookingData,
  reference,
}: PaymentSuccessDialogProps) => {
  const navigate = useNavigate();

  const pdfData: BookingPDFData | null = bookingData ? {
    bookingId: bookingData.bookingId || reference,
    guestName: bookingData.guestName || bookingData.guest_name || 'Guest',
    guestEmail: bookingData.guestEmail || bookingData.guest_email || '',
    guestPhone: bookingData.guestPhone || bookingData.guest_phone,
    itemName: bookingData.itemName || bookingData.emailData?.itemName || 'Booking',
    bookingType: bookingData.bookingType || bookingData.booking_type || 'booking',
    visitDate: bookingData.visitDate || bookingData.visit_date || new Date().toISOString(),
    totalAmount: bookingData.amount || bookingData.total_amount || 0,
    adults: bookingData.adults || bookingData.booking_details?.adults,
    children: bookingData.children || bookingData.booking_details?.children,
    slotsBooked: bookingData.slotsBooked || bookingData.slots_booked,
    paymentStatus: 'completed',
    facilities: bookingData.facilities || bookingData.booking_details?.facilities,
    activities: bookingData.activities || bookingData.booking_details?.activities,
  } : null;

  const handleViewBookings = () => {
    onOpenChange(false);
    navigate('/bookings');
  };

  const handleClose = () => {
    onOpenChange(false);
    navigate(-1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[24px] p-6">
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-popup-accent">
              Payment Successful!
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Your booking has been confirmed. Download your ticket below.
          </p>
          
          {/* Payment Details */}
          {bookingData && (
            <div className="bg-muted rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Booking Details
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reference</span>
                  <span className="text-sm font-bold">{reference}</span>
                </div>
                {(bookingData.amount || bookingData.total_amount) && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="text-sm font-bold">
                      KES {(bookingData.amount || bookingData.total_amount)?.toLocaleString()}
                    </span>
                  </div>
                )}
                {(bookingData.itemName || bookingData.emailData?.itemName) && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Item</span>
                    <span className="text-sm font-bold truncate max-w-[150px]">
                      {bookingData.itemName || bookingData.emailData?.itemName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            {/* Download Button - Critical for guests */}
            {pdfData && (
              <BookingDownloadButton
                booking={pdfData}
                variant="default"
                size="lg"
                className="w-full h-12 rounded-2xl font-black uppercase tracking-widest"
              />
            )}
            
            <Button
              onClick={handleViewBookings}
              variant="outline"
              className="w-full h-12 rounded-2xl font-black uppercase tracking-widest border-popup-accent text-popup-accent"
            >
              View My Bookings
            </Button>
            
            <Button
              onClick={handleClose}
              variant="ghost"
              className="w-full h-10 text-sm text-muted-foreground"
            >
              Continue Browsing
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

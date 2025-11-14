import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { guestBookingSchema, paymentPhoneSchema } from "@/lib/validation";

interface Event {
  id: string;
  name: string;
  price_vvip: number;
  price_vip: number;
  price_regular: number;
  price_child: number;
  date: string;
  available_tickets: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
}

export const BookEventDialog = ({ open, onOpenChange, event }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [vvip, setVvip] = useState(0);
  const [vip, setVip] = useState(0);
  const [regular, setRegular] = useState(0);
  const [children, setChildren] = useState(0);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPeople = vvip + vip + regular + children;
  const totalAmount = 
    (vvip * event.price_vvip) +
    (vip * event.price_vip) +
    (regular * event.price_regular) +
    (children * event.price_child);

  const handleStepOne = () => {
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (eventDate < today) {
      toast({
        title: "Event date has passed",
        description: "Cannot book events with past dates",
        variant: "destructive",
      });
      return;
    }

    if (totalPeople === 0) {
      toast({
        title: "Select tickets",
        description: "Please select at least one ticket",
        variant: "destructive",
      });
      return;
    }

    if (totalPeople > event.available_tickets) {
      toast({
        title: "Not enough tickets",
        description: `Only ${event.available_tickets} tickets available`,
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      const validation = guestBookingSchema.safeParse({
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
      });

      if (!validation.success) {
        toast({
          title: "Invalid input",
          description: validation.error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setStep(2);
  };

  const handleBooking = async () => {
    if (!paymentMethod) {
      toast({
        title: "Select payment method",
        description: "Please choose how you'd like to pay",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "mpesa" || paymentMethod === "airtel") {
      const phoneValidation = paymentPhoneSchema.safeParse(paymentPhone);
      if (!phoneValidation.success) {
        toast({
          title: "Invalid phone number",
          description: phoneValidation.error.issues[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("bookings").insert({
        user_id: user?.id || null,
        booking_type: "event",
        item_id: event.id,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_phone: paymentPhone || null,
        is_guest_booking: !user,
        guest_name: !user ? guestName : null,
        guest_email: !user ? guestEmail : null,
        guest_phone: !user ? guestPhone : null,
        booking_details: {
          event_name: event.name,
          date: event.date,
          vvip,
          vip,
          regular,
          children,
        },
      } as any);

      if (error) throw error;

      toast({
        title: "Booking successful!",
        description: "Your event has been booked. Check your email for confirmation.",
      });

      onOpenChange(false);
      if (user) {
        navigate("/bookings");
      }
    } catch (error) {
      console.error("Booking error:", error);
      toast({
        title: "Booking failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book {event.name}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            {event.price_vvip > 0 && (
              <div>
                <Label htmlFor="vvip">VVIP Tickets</Label>
                <Input
                  id="vvip"
                  type="number"
                  min="0"
                  value={vvip}
                  onChange={(e) => setVvip(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground mt-1">${event.price_vvip} per ticket</p>
              </div>
            )}

            {event.price_vip > 0 && (
              <div>
                <Label htmlFor="vip">VIP Tickets</Label>
                <Input
                  id="vip"
                  type="number"
                  min="0"
                  value={vip}
                  onChange={(e) => setVip(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground mt-1">${event.price_vip} per ticket</p>
              </div>
            )}

            {event.price_regular > 0 && (
              <div>
                <Label htmlFor="regular">Regular Tickets</Label>
                <Input
                  id="regular"
                  type="number"
                  min="0"
                  value={regular}
                  onChange={(e) => setRegular(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground mt-1">${event.price_regular} per ticket</p>
              </div>
            )}

            {event.price_child > 0 && (
              <div>
                <Label htmlFor="children">Child Tickets</Label>
                <Input
                  id="children"
                  type="number"
                  min="0"
                  value={children}
                  onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                />
                <p className="text-sm text-muted-foreground mt-1">${event.price_child} per ticket</p>
              </div>
            )}

            {!user && (
              <>
                <div>
                  <Label htmlFor="guestName">Your Name</Label>
                  <Input
                    id="guestName"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="guestPhone">Phone Number</Label>
                  <Input
                    id="guestPhone"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="guestEmail">Email</Label>
                  <Input
                    id="guestEmail"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </>
            )}

            <div className="bg-secondary p-4 rounded-lg">
              <div className="flex justify-between font-semibold">
                <span>Total Amount:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {totalPeople} ticket{totalPeople !== 1 ? 's' : ''}
              </p>
            </div>

            <Button onClick={handleStepOne} className="w-full">
              Continue to Payment
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-secondary p-4 rounded-lg">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total to Pay:</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <Label>Select Payment Method</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Button
                  variant={paymentMethod === "mpesa" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("mpesa")}
                >
                  M-Pesa
                </Button>
                <Button
                  variant={paymentMethod === "airtel" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("airtel")}
                >
                  Airtel
                </Button>
                <Button
                  variant={paymentMethod === "card" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("card")}
                >
                  Card
                </Button>
              </div>
            </div>

            {(paymentMethod === "mpesa" || paymentMethod === "airtel") && (
              <div>
                <Label htmlFor="paymentPhone">Phone Number</Label>
                <Input
                  id="paymentPhone"
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleBooking} disabled={loading} className="flex-1">
                {loading ? "Processing..." : "Complete Booking"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { guestBookingSchema, paymentPhoneSchema } from "@/lib/validation";

interface Activity {
  name: string;
  price: number;
}

interface Trip {
  id: string;
  name: string;
  price: number;
  price_child: number;
  date: string;
  available_tickets: number;
  activities?: Activity[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip;
}

export const BookTripDialog = ({ open, onOpenChange, trip }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState<Activity[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [tripNote, setTripNote] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleActivity = (activity: Activity, checked: boolean) => {
    if (checked) {
      setSelectedActivities([...selectedActivities, activity]);
    } else {
      setSelectedActivities(selectedActivities.filter(a => a.name !== activity.name));
    }
  };

  const totalPeople = adults + children;
  const totalAmount = (adults * trip.price) + (children * (trip.price_child || 0)) + selectedActivities.reduce((sum, a) => sum + a.price, 0);

  const handleStepOne = () => {
    const tripDate = new Date(trip.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (tripDate < today) {
      toast({
        title: "Trip date has passed",
        description: "Cannot book trips with past dates",
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

    if (totalPeople > trip.available_tickets) {
      toast({
        title: "Not enough tickets",
        description: `Only ${trip.available_tickets} tickets available`,
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
        booking_type: "trip",
        item_id: trip.id,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        payment_phone: paymentPhone || null,
        is_guest_booking: !user,
        guest_name: !user ? guestName : null,
        guest_email: !user ? guestEmail : null,
        guest_phone: !user ? guestPhone : null,
        booking_details: {
          trip_name: trip.name,
          date: trip.date,
          adults,
          children,
          activities: selectedActivities,
          trip_note: tripNote,
        },
      } as any);

      if (error) throw error;

      toast({
        title: "Booking successful!",
        description: "Your trip has been booked. Check your email for confirmation.",
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Book {trip.name}</DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 px-4">

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <Label>Trip Date</Label>
              <Input value={new Date(trip.date).toLocaleDateString()} disabled />
            </div>

            <div>
              <Label htmlFor="adults">Number of Adults</Label>
              <Input
                id="adults"
                type="number"
                min="1"
                value={adults}
                onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
              />
              <p className="text-sm text-muted-foreground mt-1">${trip.price} per adult</p>
            </div>

            <div>
              <Label htmlFor="children">Number of Children</Label>
              <Input
                id="children"
                type="number"
                min="0"
                value={children}
                onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
              />
              <p className="text-sm text-muted-foreground mt-1">
                ${trip.price_child || 0} per child
              </p>
            </div>

            {trip.activities && trip.activities.length > 0 && (
              <div>
                <Label>Select Activities</Label>
                <div className="space-y-2 mt-2">
                  {trip.activities.map((activity) => (
                    <div key={activity.name} className="flex items-center justify-between border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`activity-${activity.name}`}
                          checked={selectedActivities.some(a => a.name === activity.name)}
                          onCheckedChange={(checked) => toggleActivity(activity, checked as boolean)}
                        />
                        <label htmlFor={`activity-${activity.name}`} className="cursor-pointer">
                          {activity.name}
                        </label>
                      </div>
                      <span className="text-sm font-semibold">${activity.price}</span>
                    </div>
                  ))}
                </div>
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
              <Label htmlFor="tripNote">Trip Note (Optional)</Label>
              <Input
                id="tripNote"
                value={tripNote}
                onChange={(e) => setTripNote(e.target.value)}
                placeholder="Any special requests or notes"
              />
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
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};

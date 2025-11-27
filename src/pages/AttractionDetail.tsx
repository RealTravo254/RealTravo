import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock, DollarSign, Phone, Mail, Share2, Calendar, Users, ArrowLeft, Loader2, Navigation, Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { SimilarItems } from "@/components/SimilarItems";

import { AvailabilityCalendar } from "@/components/booking/AvailabilityCalendar";
import { Checkbox } from "@/components/ui/checkbox";
import { ReviewSection } from "@/components/ReviewSection";
import Autoplay from "embla-carousel-autoplay";
import { useSavedItems } from "@/hooks/useSavedItems";

interface Attraction {
  id: string;
  location_name: string;
  local_name: string | null;
  country: string;
  description: string | null;
  email: string | null;
  phone_number: string | null;
  location_link: string | null;
  opening_hours: string | null;
  closing_hours: string | null;
  days_opened: string[];
  entrance_type: string;
  price_child: number;
  price_adult: number;
  photo_urls: string[];
  gallery_images: string[];
  facilities?: Array<{name: string, price: number, capacity: number}>;
}

export default function AttractionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const { savedItems, handleSave: handleSaveItem } = useSavedItems();
  const isSaved = savedItems.has(id || "");
  const [selectedFacilities, setSelectedFacilities] = useState<Array<{name: string, price: number, capacity: number}>>([]);
  
  const [bookingData, setBookingData] = useState({
    visit_date: "",
    num_adults: 1,
    num_children: 0,
    guest_name: "",
    guest_email: "",
    guest_phone: "",
    payment_method: "mpesa",
    payment_phone: "",
    card_number: "",
    card_expiry: "",
    card_cvv: "",
  });

  useEffect(() => {
    fetchAttraction();
  }, [id]);

  const fetchAttraction = async () => {
    try {
      const { data, error } = await supabase
        .from('attractions')
        .select('*')
        .eq('id', id)
        .eq('approval_status', 'approved')
        .single();

      if (error) throw error;
      setAttraction(data as any);
    } catch (error: any) {
      console.error('Error fetching attraction:', error);
      toast({
        title: "Error",
        description: "Failed to load attraction details",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!attraction || attraction.entrance_type === 'free') {
      let facilityTotal = 0;
      selectedFacilities.forEach(f => {
        facilityTotal += f.price;
      });
      return facilityTotal;
    }
    const entranceFee = (bookingData.num_adults * attraction.price_adult) + (bookingData.num_children * attraction.price_child);
    let facilityTotal = 0;
    selectedFacilities.forEach(f => {
      facilityTotal += f.price;
    });
    return entranceFee + facilityTotal;
  };

  const toggleFacility = (facility: {name: string, price: number, capacity: number}, checked: boolean) => {
    if (checked) {
      setSelectedFacilities([...selectedFacilities, facility]);
    } else {
      setSelectedFacilities(selectedFacilities.filter(f => f.name !== facility.name));
    }
  };

  const handleSave = () => {
    if (id) {
      handleSaveItem(id, "attraction");
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: attraction?.location_name,
        text: attraction?.description || '',
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Attraction link copied to clipboard",
      });
    }
  };

  const handleBooking = async () => {
    if (!bookingData.visit_date) {
      toast({
        title: "Missing information",
        description: "Please select a visit date",
        variant: "destructive",
      });
      return;
    }

    if (!user && (!bookingData.guest_name || !bookingData.guest_email || !bookingData.guest_phone)) {
      toast({
        title: "Missing information",
        description: "Please fill in all guest details",
        variant: "destructive",
      });
      return;
    }

    if (!bookingData.payment_method || (bookingData.payment_method === 'mpesa' && !bookingData.payment_phone)) {
      toast({
        title: "Payment required",
        description: "Please provide payment details",
        variant: "destructive",
      });
      return;
    }

    setBookingLoading(true);

    try {
      // Initiate M-Pesa STK Push if M-Pesa is selected
      if (bookingData.payment_method === "mpesa" && bookingData.payment_phone) {
        const { data: mpesaResponse, error: mpesaError } = await supabase.functions.invoke("mpesa-stk-push", {
          body: {
            phoneNumber: bookingData.payment_phone,
            amount: calculateTotal(),
            accountReference: `ATTRACTION-${id}`,
            transactionDesc: `Booking for ${attraction?.local_name || 'attraction'}`,
          },
        });

        if (mpesaError || !mpesaResponse?.success) {
          throw new Error(mpesaResponse?.error || "M-Pesa payment failed");
        }

        toast({
          title: "Payment initiated",
          description: "Please check your phone to complete the payment",
        });
      }

      const { error } = await supabase.from('bookings').insert([{
        user_id: user?.id || null,
        item_id: id,
        booking_type: 'attraction',
        visit_date: bookingData.visit_date,
        total_amount: calculateTotal(),
        booking_details: {
          num_adults: bookingData.num_adults,
          num_children: bookingData.num_children,
          facilities: selectedFacilities.length > 0 ? selectedFacilities : null,
        },
        is_guest_booking: !user,
        guest_name: user ? null : bookingData.guest_name,
        guest_email: user ? null : bookingData.guest_email,
        guest_phone: user ? null : bookingData.guest_phone,
        payment_method: bookingData.payment_method,
        payment_phone: bookingData.payment_phone,
        status: 'pending',
        payment_status: 'pending',
      }]);

      if (error) throw error;

      toast({
        title: "Booking successful!",
        description: "Your booking has been submitted",
      });
      
      setBookingOpen(false);
      if (user) {
        navigate('/bookings');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "Booking failed",
        description: error.message || "Failed to create booking",
        variant: "destructive",
      });
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-0">
        <Header />
        <main className="container mx-auto px-4 py-6 max-w-6xl">
          <div className="space-y-6">
            <div className="w-full h-64 md:h-96 bg-muted animate-pulse rounded-lg" />
            <div className="space-y-4">
              <div className="h-8 bg-muted animate-pulse rounded w-1/2" />
              <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
              <div className="h-20 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  if (!attraction) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <p>Attraction not found</p>
        </div>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  const images = attraction.gallery_images?.length > 0 ? attraction.gallery_images : attraction.photo_urls;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <Header />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        {/* Two Column Layout on Large Screens */}
        <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column: Image Gallery with border-radius */}
        <div className="w-full relative">
          <Badge className="absolute top-4 left-4 bg-primary text-primary-foreground z-20 text-xs font-bold px-3 py-1">
            ATTRACTION
          </Badge>
          <Carousel
            opts={{ loop: true }}
            plugins={[Autoplay({ delay: 3000 })]}
            className="w-full rounded-2xl overflow-hidden"
            setApi={(api) => {
              if (api) {
                api.on("select", () => {
                  setCurrent(api.selectedScrollSnap());
                });
              }
            }}
          >
            <CarouselContent>
              {images?.map((url, index) => (
                <CarouselItem key={index}>
                  <img src={url} alt={`${attraction.location_name} ${index + 1}`} className="w-full h-64 md:h-96 object-cover" />
                </CarouselItem>
              ))}
            </CarouselContent>

            {images && images.length > 1 && (
              <>
                <CarouselPrevious 
                  className="left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" 
                />
                <CarouselNext 
                  className="right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white border-none" 
                />
              </>
            )}
            
            {images && images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                {images.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === current ? 'bg-white' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            )}
          </Carousel>
        </div>

        {/* Right Column: Item Details */}
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-3xl font-bold">{attraction.location_name}</h1>
            {attraction.local_name && (
              <p className="text-xl text-muted-foreground">{attraction.local_name}</p>
            )}
            <p className="text-sm md:text-base text-muted-foreground">
              {attraction.country}
            </p>
            
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => {
                if (attraction.location_link) {
                  window.open(attraction.location_link, '_blank');
                } else {
                  const query = encodeURIComponent(`${attraction.location_name}, ${attraction.country}`);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                }
              }}
              className="gap-2"
            >
              <Navigation className="h-4 w-4" />
              Location
            </Button>
            <Button
              variant="outline"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              className={isSaved ? "bg-red-500 text-white hover:bg-red-600" : ""}
            >
              <Heart className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
            </Button>
          </div>

          {/* Entrance Fee Card */}
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Entrance Fee
            </h2>
            {attraction.entrance_type === 'free' ? (
              <p className="text-lg font-semibold text-green-600">Free Entry</p>
            ) : (
              <div className="space-y-2">
                <p>Adults: ${attraction.price_adult}</p>
                <p>Children: ${attraction.price_child}</p>
              </div>
            )}
          </Card>

          {/* Contact Info Card */}
          {(attraction.email || attraction.phone_number || attraction.location_link) && (
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-3">Contact</h2>
              <div className="space-y-2">
                {attraction.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${attraction.email}`} className="text-primary hover:underline">
                      {attraction.email}
                    </a>
                  </p>
                )}
                {attraction.phone_number && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${attraction.phone_number}`} className="text-primary hover:underline">
                      {attraction.phone_number}
                    </a>
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Book Now Button - Hidden on small, shown on large */}
          <Button size="lg" className="w-full hidden md:flex" onClick={() => setBookingOpen(true)}>
            <Calendar className="mr-2 h-5 w-5" />
            Book Now
          </Button>
        </div>
      </div>

        {/* Description Below Image Gallery on Left Side */}
        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          {/* Description - Left Column */}
          {attraction.description && (
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-3">About</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{attraction.description}</p>
            </Card>
          )}

          {/* Operating Hours - Right Column */}
          {(attraction.opening_hours || attraction.closing_hours || attraction.days_opened?.length > 0) && (
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Operating Hours
              </h2>
              <div className="space-y-2">
                {attraction.opening_hours && attraction.closing_hours && (
                  <p>Hours: {attraction.opening_hours} - {attraction.closing_hours}</p>
                )}
                {attraction.days_opened?.length > 0 && (
                  <p>Open: {attraction.days_opened.join(', ')}</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Facilities Section */}
        {attraction.facilities && Array.isArray(attraction.facilities) && attraction.facilities.length > 0 && (
          <Card className="p-6 mt-6">
            <h2 className="text-2xl font-semibold mb-3">Available Facilities</h2>
            <div className="grid gap-3">
              {attraction.facilities.map((facility: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-4 bg-background flex justify-between items-center">
                  <div>
                    <span className="font-medium">{facility.name}</span>
                    <p className="text-sm text-muted-foreground">Capacity: {facility.capacity} people</p>
                  </div>
                  <span className="font-bold">${facility.price}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <ReviewSection itemId={attraction.id} itemType="attraction" />

        {/* Book Now Button for Small Screens - Below Operating Hours */}
        <div className="md:hidden mt-6">
          <Button size="lg" className="w-full" onClick={() => setBookingOpen(true)}>
            <Calendar className="mr-2 h-5 w-5" />
            Book Now
          </Button>
        </div>

        {/* Similar Items */}
        {attraction && <SimilarItems currentItemId={attraction.id} itemType="attraction" country={attraction.country} />}
      </main>

      {/* Booking Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Your Visit</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="visit_date">Visit Date</Label>
              <Input
                id="visit_date"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={bookingData.visit_date}
                onChange={(e) => setBookingData({...bookingData, visit_date: e.target.value})}
                required
              />
            </div>

            <div>
              <Label htmlFor="num_adults">Number of Adults</Label>
              <Input
                id="num_adults"
                type="number"
                min="0"
                value={bookingData.num_adults}
                onChange={(e) => setBookingData({...bookingData, num_adults: parseInt(e.target.value) || 0})}
              />
            </div>

            <div>
              <Label htmlFor="num_children">Number of Children</Label>
              <Input
                id="num_children"
                type="number"
                min="0"
                value={bookingData.num_children}
                onChange={(e) => setBookingData({...bookingData, num_children: parseInt(e.target.value) || 0})}
              />
            </div>

            {/* Facilities Selection */}
            {attraction.facilities && Array.isArray(attraction.facilities) && attraction.facilities.length > 0 && (
              <div className="space-y-3">
                <Label>Select Facilities (Optional)</Label>
                {attraction.facilities.map((facility: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between border rounded p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedFacilities.some(f => f.name === facility.name)}
                        onCheckedChange={(checked) => toggleFacility(facility, !!checked)}
                      />
                      <div>
                        <p className="font-medium">{facility.name}</p>
                        <p className="text-xs text-muted-foreground">Capacity: {facility.capacity} people</p>
                      </div>
                    </div>
                    <span className="font-bold">${facility.price}</span>
                  </div>
                ))}
              </div>
            )}

            {!user && (
              <>
                <div>
                  <Label htmlFor="guest_name">Your Name</Label>
                  <Input
                    id="guest_name"
                    value={bookingData.guest_name}
                    onChange={(e) => setBookingData({...bookingData, guest_name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="guest_email">Email</Label>
                  <Input
                    id="guest_email"
                    type="email"
                    value={bookingData.guest_email}
                    onChange={(e) => setBookingData({...bookingData, guest_email: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="guest_phone">Phone Number</Label>
                  <Input
                    id="guest_phone"
                    type="tel"
                    value={bookingData.guest_phone}
                    onChange={(e) => setBookingData({...bookingData, guest_phone: e.target.value})}
                    required
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="payment_method">Payment Method</Label>
              <select
                id="payment_method"
                className="w-full border rounded-md p-2"
                value={bookingData.payment_method}
                onChange={(e) => setBookingData({...bookingData, payment_method: e.target.value})}
              >
                <option value="mpesa">M-Pesa</option>
                <option value="airtel">Airtel</option>
                <option value="card">Card</option>
              </select>
            </div>

            {(bookingData.payment_method === 'mpesa' || bookingData.payment_method === 'airtel') && (
              <div>
                <Label htmlFor="payment_phone">Phone Number</Label>
                <Input
                  id="payment_phone"
                  type="tel"
                  value={bookingData.payment_phone}
                  onChange={(e) => setBookingData({...bookingData, payment_phone: e.target.value})}
                  placeholder="+1234567890"
                  required
                />
              </div>
            )}

            {bookingData.payment_method === 'card' && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="card_number">Card Number</Label>
                  <Input
                    id="card_number"
                    value={bookingData.card_number}
                    onChange={(e) => setBookingData({...bookingData, card_number: e.target.value})}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="card_expiry">Expiry Date</Label>
                    <Input
                      id="card_expiry"
                      value={bookingData.card_expiry}
                      onChange={(e) => setBookingData({...bookingData, card_expiry: e.target.value})}
                      placeholder="MM/YY"
                      maxLength={5}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="card_cvv">CVV</Label>
                    <Input
                      id="card_cvv"
                      type="password"
                      value={bookingData.card_cvv}
                      onChange={(e) => setBookingData({...bookingData, card_cvv: e.target.value})}
                      placeholder="123"
                      maxLength={4}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <p className="text-lg font-semibold">
                Total Amount: ${calculateTotal().toFixed(2)}
              </p>
            </div>

            <Button onClick={handleBooking} className="w-full" disabled={bookingLoading}>
              {bookingLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Complete Booking"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <MobileBottomBar />
    </div>
  );
}

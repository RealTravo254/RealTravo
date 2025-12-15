import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getReferralTrackingId } from "@/lib/referralUtils";

interface BookingData {
  itemId: string;
  itemName: string;
  bookingType: 'trip' | 'event' | 'hotel' | 'adventure_place' | 'attraction';
  totalAmount: number;
  slotsBooked: number;
  visitDate: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  bookingDetails: Record<string, any>;
  hostId?: string | null;
}

export const useBookingSubmit = () => {
  const { user } = useAuth();

  const submitBooking = async (data: BookingData) => {
    // 1. Insert booking into bookings table
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        user_id: user?.id || null,
        item_id: data.itemId,
        booking_type: data.bookingType,
        total_amount: data.totalAmount,
        status: 'confirmed',
        payment_status: 'pending',
        is_guest_booking: !user,
        guest_name: data.guestName,
        guest_email: data.guestEmail,
        guest_phone: data.guestPhone || null, // Handle empty string as null
        slots_booked: data.slotsBooked,
        visit_date: data.visitDate,
        referral_tracking_id: getReferralTrackingId(),
        booking_details: data.bookingDetails,
        payment_phone: data.guestPhone || null, // Handle empty string as null
      }])
      .select()
      .single();

    if (bookingError) throw bookingError;

    // 2. Create notification for user (if logged in)
    if (user?.id) {
      const details = data.bookingDetails;
      const totalPeople = (details.adults || 0) + (details.children || 0);
      
      // Build facilities and activities summary
      const facilitiesList = details.selectedFacilities?.map((f: any) => f.name).join(', ') || '';
      const activitiesList = details.selectedActivities?.map((a: any) => a.name).join(', ') || '';
      
      let messageDetails = `Booked by: ${data.guestName}. People: ${totalPeople} (${details.adults || 0} adults, ${details.children || 0} children).`;
      if (facilitiesList) messageDetails += ` Facilities: ${facilitiesList}.`;
      if (activitiesList) messageDetails += ` Activities: ${activitiesList}.`;
      messageDetails += ` Total: KES ${data.totalAmount}. Payment is pending.`;
      
      await supabase.from('notifications').insert([{
        user_id: user.id,
        type: 'booking_created',
        title: `Booking for ${data.itemName}`,
        message: messageDetails,
        data: {
          booking_id: booking.id,
          item_id: data.itemId,
          booking_type: data.bookingType,
          total_amount: data.totalAmount,
          visit_date: data.visitDate,
          guest_name: data.guestName,
          total_people: totalPeople,
          adults: details.adults || 0,
          children: details.children || 0,
          facilities: details.selectedFacilities || [],
          activities: details.selectedActivities || []
        }
      }]);
    }

    // 3. Send confirmation email to user
    try {
      await supabase.functions.invoke('send-booking-confirmation', {
        body: {
          bookingId: booking.id,
          email: data.guestEmail,
          guestName: data.guestName,
          bookingType: data.bookingType,
          itemName: data.itemName,
          totalAmount: data.totalAmount,
          bookingDetails: {
            ...data.bookingDetails,
            phone: data.guestPhone
          },
          visitDate: data.visitDate
        }
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't throw - booking is still created
    }

    return booking;
  };

  return { submitBooking };
};

import { supabase } from "@/integrations/supabase/client";

/**
 * Slugify email name for public referral links
 */
const slugifyEmailName = (email: string): string => {
  const namePart = email.split('@')[0];
  return namePart.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

/**
 * Check if user is a verified host (required for referral eligibility)
 */
export const checkReferralEligibility = async (): Promise<{
  isEligible: boolean;
  reason: string | null;
}> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { isEligible: false, reason: 'You must be logged in to use referrals.' };
  }

  // Check host verification status
  const { data: verification, error } = await supabase
    .from('host_verifications')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error checking host verification:', error);
    return { isEligible: false, reason: 'Failed to verify host status.' };
  }

  if (!verification) {
    return { isEligible: false, reason: 'You must be a verified host to use the referral program.' };
  }

  if (verification.status !== 'approved') {
    return { 
      isEligible: false, 
      reason: verification.status === 'pending' 
        ? 'Your host verification is pending. Referrals will be enabled once approved.'
        : 'Your host verification was rejected. Please resubmit to use referrals.'
    };
  }

  return { isEligible: true, reason: null };
};

/**
 * Generate referral link based on user status
 * - Guests: Clean base URL only
 * - Verified hosts: Base URL + ?ref={slugified-email-name}
 * - Non-verified users: Clean base URL only (referrals disabled)
 */
export const generateReferralLink = async (
  itemId: string,
  itemType: string,
  itemSlug?: string
): Promise<string> => {
  const baseUrl = window.location.origin;
  let path = "";
  
  switch (itemType) {
    case "trip":
      path = `/trip/${itemSlug || itemId}`;
      break;
    case "event":
      path = `/event/${itemSlug || itemId}`;
      break;
    case "hotel":
      path = `/hotel/${itemSlug || itemId}`;
      break;
    case "adventure":
    case "adventure_place":
      path = `/adventure/${itemSlug || itemId}`;
      break;
    case "attraction":
      path = `/attraction/${itemSlug || itemId}`;
      break;
    default:
      path = `/`;
  }
  
  const cleanUrl = `${baseUrl}${path}`;
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user?.email) {
    // Guest user - return clean URL without referral parameter
    return cleanUrl;
  }

  // Check referral eligibility (must be verified host)
  const { isEligible } = await checkReferralEligibility();
  
  if (!isEligible) {
    // Not a verified host - return clean URL without referral parameter
    return cleanUrl;
  }
  
  // Verified host - append slugified email name as ref parameter
  const refSlug = slugifyEmailName(user.email);
  return `${cleanUrl}?ref=${refSlug}`;
};

/**
 * Track referral click using slugified email name from URL
 * Looks up user by email slug, retrieves internal_referral_id_digits for tracking
 */
export const trackReferralClick = async (
  refSlug: string,
  itemId?: string,
  itemType?: string,
  referralType: "booking" | "host" = "booking"
) => {
  try {
    console.log('[ReferralUtils] trackReferralClick called with:', { refSlug, itemId, itemType, referralType });
    
    // Check if item_id is provided first
    if (!itemId) {
      console.log('[ReferralUtils] Skipping - no item_id provided');
      return null;
    }

    if (!refSlug) {
      console.log('[ReferralUtils] Skipping - no refSlug provided');
      return null;
    }

    // Check if we already have a tracking record for this in session
    const existingTrackingId = sessionStorage.getItem("referral_tracking_id");
    if (existingTrackingId) {
      console.log('[ReferralUtils] Already have tracking ID in session:', existingTrackingId);
      return { id: existingTrackingId };
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    
    // Use edge function to track referral (bypasses RLS for profile lookup)
    const { data, error } = await supabase.functions.invoke('track-referral-click', {
      body: {
        refSlug,
        itemId,
        itemType: itemType || 'unknown',
        referralType,
        userId: user?.id || null,
      },
    });

    if (error) {
      console.error('[ReferralUtils] Error calling track-referral-click:', error);
      return null;
    }

    if (!data?.success) {
      console.log('[ReferralUtils] Tracking failed:', data?.error);
      return null;
    }
    
    // Store tracking ID and internal digit ID in session storage
    if (data.data?.trackingId) {
      sessionStorage.setItem("referral_tracking_id", data.data.trackingId);
      if (data.data.internalReferralId) {
        sessionStorage.setItem("referral_internal_id", data.data.internalReferralId);
      }
      console.log('[ReferralUtils] Successfully stored tracking ID in session:', data.data.trackingId);
    }
    
    return { id: data.data?.trackingId };
  } catch (error) {
    console.error("[ReferralUtils] Error tracking referral:", error);
    return null;
  }
};

export const getReferralTrackingId = (): string | null => {
  const trackingId = sessionStorage.getItem("referral_tracking_id");
  console.log('[ReferralUtils] getReferralTrackingId:', trackingId);
  return trackingId;
};

export const clearReferralTracking = () => {
  sessionStorage.removeItem("referral_tracking_id");
};

export const calculateAndAwardCommission = async (
  bookingId: string,
  bookingAmount: number,
  referralTrackingId: string | null
) => {
  if (!referralTrackingId) return;

  try {
    // Get referral tracking details
    const { data: tracking, error: trackingError } = await supabase
      .from("referral_tracking")
      .select("*")
      .eq("id", referralTrackingId)
      .single();

    if (trackingError || !tracking) return;

    // Get commission settings
    const { data: settings, error: settingsError } = await supabase
      .from("referral_settings")
      .select("*")
      .single();

    if (settingsError || !settings) return;

    // Determine service fee and commission rate based on item type
    let serviceFeeRate = 20.0; // default fallback
    let commissionRate = 5.0; // default fallback
    
    if (tracking.item_type === 'trip') {
      serviceFeeRate = Number(settings.trip_service_fee);
      commissionRate = Number(settings.trip_commission_rate);
    } else if (tracking.item_type === 'event') {
      serviceFeeRate = Number(settings.event_service_fee);
      commissionRate = Number(settings.event_commission_rate);
    } else if (tracking.item_type === 'hotel') {
      serviceFeeRate = Number(settings.hotel_service_fee);
      commissionRate = Number(settings.hotel_commission_rate);
    } else if (tracking.item_type === 'attraction') {
      serviceFeeRate = Number(settings.attraction_service_fee);
      commissionRate = Number(settings.attraction_commission_rate);
    } else if (tracking.item_type === 'adventure' || tracking.item_type === 'adventure_place') {
      serviceFeeRate = Number(settings.adventure_place_service_fee);
      commissionRate = Number(settings.adventure_place_commission_rate);
    }
    
    const commissionType = "booking";

    // Calculate service fee from gross booking amount
    const serviceFeeAmount = (bookingAmount * serviceFeeRate) / 100;
    
    // Calculate commission from service fee using category-specific commission rate
    const commissionAmount = (serviceFeeAmount * commissionRate) / 100;

    // Create commission record
    const { error: commissionError } = await supabase
      .from("referral_commissions")
      .insert({
        referrer_id: tracking.referrer_id,
        referred_user_id: tracking.referred_user_id,
        booking_id: bookingId,
        referral_tracking_id: referralTrackingId,
        commission_type: commissionType,
        commission_amount: commissionAmount,
        commission_rate: commissionRate,
        booking_amount: bookingAmount,
        status: "paid",
        paid_at: new Date().toISOString(),
      });

    if (commissionError) throw commissionError;

    // Update tracking status
    await supabase
      .from("referral_tracking")
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
      })
      .eq("id", referralTrackingId);

    // Clear session storage
    clearReferralTracking();
  } catch (error) {
    console.error("Error calculating commission:", error);
  }
};

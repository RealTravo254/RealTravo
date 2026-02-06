import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { refSlug, itemId, itemType, referralType, userId } = body;

    console.log("Track referral click:", { refSlug, itemId, itemType, referralType, userId });

    if (!refSlug || !itemId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up referrer by slugified email name
    const { data: profiles, error: lookupError } = await supabase
      .from("profiles")
      .select("id, email, internal_referral_id_digits")
      .not("email", "is", null);

    if (lookupError) {
      console.error("Error looking up profiles:", lookupError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to lookup referrer" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No profiles found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find matching profile by slugifying each email
    const referrerProfile = profiles.find((profile: any) => {
      if (!profile.email) return false;
      const slugifiedEmail = profile.email.split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return slugifiedEmail === refSlug;
    });

    if (!referrerProfile) {
      console.log("No matching referrer found for slug:", refSlug);
      return new Response(
        JSON.stringify({ success: false, error: "Referrer not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found referrer:", referrerProfile.id);

    // Don't track if the referrer is clicking their own link
    if (userId && userId === referrerProfile.id) {
      console.log("Skipping - user is clicking their own link");
      return new Response(
        JSON.stringify({ success: false, error: "Cannot refer yourself" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert referral tracking record
    const { data: tracking, error: insertError } = await supabase
      .from("referral_tracking")
      .insert({
        referrer_id: referrerProfile.id,
        referred_user_id: userId || null,
        referral_type: referralType || "booking",
        item_id: itemId,
        item_type: itemType || "unknown",
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting tracking:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create tracking record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Created tracking record:", tracking.id);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          trackingId: tracking.id,
          referrerId: referrerProfile.id,
          internalReferralId: referrerProfile.internal_referral_id_digits,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in track-referral-click:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

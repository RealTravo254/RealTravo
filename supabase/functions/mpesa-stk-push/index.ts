import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const bookingDataSchema = z.object({
  item_id: z.string().uuid("Invalid item ID"),
  booking_type: z.enum(['trip', 'event', 'hotel', 'adventure_place', 'adventure', 'attraction']),
  total_amount: z.number().positive().max(10000000, "Amount too large"),
  booking_details: z.any(),
  user_id: z.string().uuid().optional().nullable(),
  is_guest_booking: z.boolean().optional(),
  guest_name: z.string().min(1).max(100).optional(),
  guest_email: z.string().email().max(255).optional().nullable(),
  guest_phone: z.string().max(20).optional().nullable(),
  visit_date: z.string().optional().nullable(),
  slots_booked: z.number().int().positive().max(100).optional(),
  host_id: z.string().uuid().optional().nullable(),
  referral_tracking_id: z.string().uuid().optional().nullable(),
  emailData: z.any().optional(),
});

const stkPushRequestSchema = z.object({
  phoneNumber: z.string()
    .min(9, "Phone number too short")
    .max(15, "Phone number too long")
    .regex(/^(\+?254|0)?[17]\d{8}$/, "Invalid Kenyan phone number format"),
  amount: z.number()
    .positive("Amount must be positive")
    .min(1, "Minimum amount is 1")
    .max(150000, "Maximum M-Pesa transaction is 150,000"), // M-Pesa transaction limit
  accountReference: z.string().min(1).max(12),
  transactionDesc: z.string().min(1).max(13),
  bookingData: bookingDataSchema,
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawData = await req.json();
    
    let validatedData;
    try {
      validatedData = stkPushRequestSchema.parse(rawData);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.error("Validation error:", validationError.errors);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Invalid input", 
            details: validationError.errors 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw validationError;
    }

    const { phoneNumber, amount, accountReference, transactionDesc, bookingData } = validatedData;

    console.log('STK Push request received:', { phoneNumber, amount, accountReference });

    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    const shortcode = Deno.env.get('MPESA_SHORTCODE');

    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      throw new Error('M-Pesa credentials not configured');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify item exists before proceeding
    let tableName = 'trips';
    if (bookingData.booking_type === 'hotel') {
      tableName = 'hotels';
    } else if (bookingData.booking_type === 'adventure' || bookingData.booking_type === 'adventure_place') {
      tableName = 'adventure_places';
    }

    const { data: item, error: itemError } = await supabaseClient
      .from(tableName)
      .select('id, created_by, approval_status')
      .eq('id', bookingData.item_id)
      .single();

    if (itemError || !item) {
      console.error("Item not found:", bookingData.item_id, itemError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Item not found or does not exist" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify item is approved
    if (item.approval_status !== 'approved') {
      console.error("Item not approved:", bookingData.item_id, item.approval_status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Item is not available for booking" 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Get OAuth token
    const auth = btoa(`${consumerKey}:${consumerSecret}`);
    const tokenResponse = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to get OAuth token');
    }

    const { access_token } = await tokenResponse.json();
    console.log('OAuth token obtained successfully');

    // Step 2: Generate timestamp
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    
    // Step 3: Generate password
    const password = btoa(`${shortcode}${passkey}${timestamp}`);

    // Format phone number (remove leading 0 or +254, ensure starts with 254)
    let formattedPhone = phoneNumber.replace(/\s/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+254')) {
      formattedPhone = formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('254')) {
      formattedPhone = '254' + formattedPhone;
    }

    // Step 4: Initiate STK Push
    const callbackURL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`;
    console.log('🔗 Callback URL being used:', callbackURL);
    
    const stkPushPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackURL,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc,
    };

    console.log('Initiating STK Push:', { ...stkPushPayload, Password: '[REDACTED]', CallBackURL: callbackURL });

    const stkResponse = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stkPushPayload),
      }
    );

    const stkData = await stkResponse.json();
    console.log('STK Push response:', stkData);

    // Handle non-zero ResponseCode - FAILED immediately
    if (!stkResponse.ok || stkData.ResponseCode !== '0') {
      console.error('❌ STK Push failed with ResponseCode:', stkData.ResponseCode);
      
      // Save failed payment record to database for tracking
      await supabaseClient.from('payments').insert({
        checkout_request_id: stkData.CheckoutRequestID || `FAILED-${Date.now()}`,
        merchant_request_id: stkData.MerchantRequestID || null,
        phone_number: formattedPhone,
        amount: Math.round(amount),
        account_reference: accountReference,
        transaction_desc: transactionDesc,
        booking_data: bookingData,
        payment_status: 'failed',
        result_code: stkData.ResponseCode || 'HTTP_ERROR',
        result_desc: stkData.ResponseDescription || stkData.errorMessage || 'STK Push request failed',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: stkData.ResponseDescription || stkData.errorMessage || 'STK Push failed',
          responseCode: stkData.ResponseCode,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // ResponseCode = 0: Success - Create booking with PENDING status and save to payments
    console.log('✅ STK Push successful, creating pending booking');
    
    // Create booking with pending payment status
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .insert({
        item_id: bookingData.item_id,
        booking_type: bookingData.booking_type,
        total_amount: bookingData.total_amount,
        booking_details: bookingData.booking_details,
        user_id: bookingData.user_id || null,
        is_guest_booking: bookingData.is_guest_booking || !bookingData.user_id,
        guest_name: bookingData.guest_name,
        guest_email: bookingData.guest_email,
        guest_phone: bookingData.guest_phone || null,
        visit_date: bookingData.visit_date || null,
        slots_booked: bookingData.slots_booked || 1,
        payment_status: 'pending',
        payment_method: 'mpesa',
        payment_phone: formattedPhone,
        status: 'pending',
        referral_tracking_id: bookingData.referral_tracking_id || null,
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating pending booking:', bookingError);
    } else {
      console.log('✅ Pending booking created:', booking.id);
    }

    // Save to payments table for callback tracking (include booking_id and host_id)
    const { error: dbError } = await supabaseClient.from('payments').insert({
      checkout_request_id: stkData.CheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      phone_number: formattedPhone,
      amount: Math.round(amount),
      account_reference: accountReference,
      transaction_desc: transactionDesc,
      booking_data: {
        ...bookingData,
        booking_id: booking?.id,
        host_id: item.created_by, // Add host_id from the item
      },
      payment_status: 'pending',
      user_id: bookingData.user_id || null,
      host_id: item.created_by, // Store host_id directly
    });

    if (dbError) {
      console.error('Error saving payment:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'STK Push initiated successfully',
        checkoutRequestId: stkData.CheckoutRequestID,
        merchantRequestId: stkData.MerchantRequestID,
        bookingId: booking?.id,
        data: {
          MerchantRequestID: stkData.MerchantRequestID,
          CheckoutRequestID: stkData.CheckoutRequestID,
          ResponseCode: stkData.ResponseCode,
          ResponseDescription: stkData.ResponseDescription,
          CustomerMessage: stkData.CustomerMessage,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in mpesa-stk-push function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

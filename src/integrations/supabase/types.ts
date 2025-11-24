export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      adventure_places: {
        Row: {
          activities: Json | null
          admin_notes: string | null
          allowed_admin_emails: string[] | null
          amenities: Json | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          available_slots: number | null
          closing_hours: string | null
          country: string
          created_at: string
          created_by: string | null
          days_opened: string[] | null
          description: string | null
          email: string | null
          entry_fee: number | null
          entry_fee_type: string | null
          facilities: Json | null
          gallery_images: string[] | null
          id: string
          image_url: string
          images: string[] | null
          is_hidden: boolean | null
          location: string
          map_link: string | null
          name: string
          opening_hours: string | null
          phone_numbers: string[] | null
          place: string
          registration_number: string | null
        }
        Insert: {
          activities?: Json | null
          admin_notes?: string | null
          allowed_admin_emails?: string[] | null
          amenities?: Json | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_slots?: number | null
          closing_hours?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          days_opened?: string[] | null
          description?: string | null
          email?: string | null
          entry_fee?: number | null
          entry_fee_type?: string | null
          facilities?: Json | null
          gallery_images?: string[] | null
          id?: string
          image_url: string
          images?: string[] | null
          is_hidden?: boolean | null
          location: string
          map_link?: string | null
          name: string
          opening_hours?: string | null
          phone_numbers?: string[] | null
          place: string
          registration_number?: string | null
        }
        Update: {
          activities?: Json | null
          admin_notes?: string | null
          allowed_admin_emails?: string[] | null
          amenities?: Json | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_slots?: number | null
          closing_hours?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          days_opened?: string[] | null
          description?: string | null
          email?: string | null
          entry_fee?: number | null
          entry_fee_type?: string | null
          facilities?: Json | null
          gallery_images?: string[] | null
          id?: string
          image_url?: string
          images?: string[] | null
          is_hidden?: boolean | null
          location?: string
          map_link?: string | null
          name?: string
          opening_hours?: string | null
          phone_numbers?: string[] | null
          place?: string
          registration_number?: string | null
        }
        Relationships: []
      }
      attractions: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          closing_hours: string | null
          country: string
          created_at: string
          created_by: string | null
          days_opened: string[] | null
          description: string | null
          email: string | null
          entrance_type: string
          gallery_images: string[] | null
          id: string
          is_hidden: boolean | null
          latitude: number | null
          local_name: string | null
          location_link: string | null
          location_name: string
          longitude: number | null
          opening_hours: string | null
          phone_number: string | null
          photo_urls: string[] | null
          price_adult: number | null
          price_child: number | null
          registration_number: string
          registration_type: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          closing_hours?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          days_opened?: string[] | null
          description?: string | null
          email?: string | null
          entrance_type?: string
          gallery_images?: string[] | null
          id?: string
          is_hidden?: boolean | null
          latitude?: number | null
          local_name?: string | null
          location_link?: string | null
          location_name: string
          longitude?: number | null
          opening_hours?: string | null
          phone_number?: string | null
          photo_urls?: string[] | null
          price_adult?: number | null
          price_child?: number | null
          registration_number: string
          registration_type: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          closing_hours?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          days_opened?: string[] | null
          description?: string | null
          email?: string | null
          entrance_type?: string
          gallery_images?: string[] | null
          id?: string
          is_hidden?: boolean | null
          latitude?: number | null
          local_name?: string | null
          location_link?: string | null
          location_name?: string
          longitude?: number | null
          opening_hours?: string | null
          phone_number?: string | null
          photo_urls?: string[] | null
          price_adult?: number | null
          price_child?: number | null
          registration_number?: string
          registration_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attractions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attractions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_details: {
        Row: {
          account_holder_name: string
          account_number: string
          bank_name: string
          created_at: string | null
          id: string
          last_updated: string | null
          previous_account_holder_name: string | null
          previous_account_number: string | null
          previous_bank_name: string | null
          previous_verified_at: string | null
          rejection_reason: string | null
          user_id: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder_name: string
          account_number: string
          bank_name: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          previous_account_holder_name?: string | null
          previous_account_number?: string | null
          previous_bank_name?: string | null
          previous_verified_at?: string | null
          rejection_reason?: string | null
          user_id: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          previous_account_holder_name?: string | null
          previous_account_number?: string | null
          previous_bank_name?: string | null
          previous_verified_at?: string | null
          rejection_reason?: string | null
          user_id?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          booking_details: Json
          booking_type: string
          created_at: string
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_guest_booking: boolean | null
          item_id: string
          payment_method: string | null
          payment_phone: string | null
          payment_status: string | null
          referral_tracking_id: string | null
          slots_booked: number | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string | null
          visit_date: string | null
        }
        Insert: {
          booking_details: Json
          booking_type: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_guest_booking?: boolean | null
          item_id: string
          payment_method?: string | null
          payment_phone?: string | null
          payment_status?: string | null
          referral_tracking_id?: string | null
          slots_booked?: number | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id?: string | null
          visit_date?: string | null
        }
        Update: {
          booking_details?: Json
          booking_type?: string
          created_at?: string
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_guest_booking?: boolean | null
          item_id?: string
          payment_method?: string | null
          payment_phone?: string | null
          payment_status?: string | null
          referral_tracking_id?: string | null
          slots_booked?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_referral_tracking_id_fkey"
            columns: ["referral_tracking_id"]
            isOneToOne: false
            referencedRelation: "referral_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      host_verifications: {
        Row: {
          created_at: string
          document_back_url: string | null
          document_front_url: string
          document_type: string
          id: string
          legal_name: string
          rejection_reason: string | null
          residential_address: string
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string
          status: string
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_back_url?: string | null
          document_front_url: string
          document_type: string
          id?: string
          legal_name: string
          rejection_reason?: string | null
          residential_address: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_back_url?: string | null
          document_front_url?: string
          document_type?: string
          id?: string
          legal_name?: string
          rejection_reason?: string | null
          residential_address?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string
          status?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          activities: Json | null
          admin_notes: string | null
          allowed_admin_emails: string[] | null
          amenities: string[] | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          available_rooms: number | null
          closing_hours: string | null
          country: string
          created_at: string
          created_by: string | null
          days_opened: string[] | null
          description: string | null
          email: string | null
          establishment_type: string | null
          facilities: Json | null
          gallery_images: string[] | null
          id: string
          image_url: string
          images: string[] | null
          is_hidden: boolean | null
          location: string
          map_link: string | null
          name: string
          opening_hours: string | null
          phone_numbers: string[] | null
          place: string
          registration_number: string | null
        }
        Insert: {
          activities?: Json | null
          admin_notes?: string | null
          allowed_admin_emails?: string[] | null
          amenities?: string[] | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_rooms?: number | null
          closing_hours?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          days_opened?: string[] | null
          description?: string | null
          email?: string | null
          establishment_type?: string | null
          facilities?: Json | null
          gallery_images?: string[] | null
          id?: string
          image_url: string
          images?: string[] | null
          is_hidden?: boolean | null
          location: string
          map_link?: string | null
          name: string
          opening_hours?: string | null
          phone_numbers?: string[] | null
          place: string
          registration_number?: string | null
        }
        Update: {
          activities?: Json | null
          admin_notes?: string | null
          allowed_admin_emails?: string[] | null
          amenities?: string[] | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_rooms?: number | null
          closing_hours?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          days_opened?: string[] | null
          description?: string | null
          email?: string | null
          establishment_type?: string | null
          facilities?: Json | null
          gallery_images?: string[] | null
          id?: string
          image_url?: string
          images?: string[] | null
          is_hidden?: boolean | null
          location?: string
          map_link?: string | null
          name?: string
          opening_hours?: string | null
          phone_numbers?: string[] | null
          place?: string
          registration_number?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          name: string
          phone_number: string | null
          phone_verified: boolean | null
          profile_picture_url: string | null
          referrer_id: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id: string
          name: string
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_picture_url?: string | null
          referrer_id?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          name?: string
          phone_number?: string | null
          phone_verified?: boolean | null
          profile_picture_url?: string | null
          referrer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          subscription_data: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          subscription_data: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          subscription_data?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          booking_amount: number
          booking_id: string | null
          commission_amount: number
          commission_rate: number
          commission_type: string
          created_at: string | null
          id: string
          paid_at: string | null
          referral_tracking_id: string | null
          referred_user_id: string | null
          referrer_id: string
          status: string | null
        }
        Insert: {
          booking_amount: number
          booking_id?: string | null
          commission_amount: number
          commission_rate: number
          commission_type: string
          created_at?: string | null
          id?: string
          paid_at?: string | null
          referral_tracking_id?: string | null
          referred_user_id?: string | null
          referrer_id: string
          status?: string | null
        }
        Update: {
          booking_amount?: number
          booking_id?: string | null
          commission_amount?: number
          commission_rate?: number
          commission_type?: string
          created_at?: string | null
          id?: string
          paid_at?: string | null
          referral_tracking_id?: string | null
          referred_user_id?: string | null
          referrer_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "creator_booking_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_referral_tracking_id_fkey"
            columns: ["referral_tracking_id"]
            isOneToOne: false
            referencedRelation: "referral_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          booking_commission_rate: number
          created_at: string | null
          host_commission_duration_days: number
          host_commission_rate: number
          id: string
          updated_at: string | null
        }
        Insert: {
          booking_commission_rate?: number
          created_at?: string | null
          host_commission_duration_days?: number
          host_commission_rate?: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          booking_commission_rate?: number
          created_at?: string | null
          host_commission_duration_days?: number
          host_commission_rate?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      referral_tracking: {
        Row: {
          clicked_at: string | null
          converted_at: string | null
          created_at: string | null
          id: string
          item_id: string | null
          item_type: string | null
          referral_type: string
          referred_user_id: string | null
          referrer_id: string
          status: string | null
        }
        Insert: {
          clicked_at?: string | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          referral_type: string
          referred_user_id?: string | null
          referrer_id: string
          status?: string | null
        }
        Update: {
          clicked_at?: string | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          item_type?: string | null
          referral_type?: string
          referred_user_id?: string | null
          referrer_id?: string
          status?: string | null
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          created_at: string
          id: string
          query: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          activities: Json | null
          admin_notes: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          available_tickets: number | null
          country: string
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          email: string | null
          gallery_images: string[] | null
          id: string
          image_url: string
          images: string[] | null
          is_custom_date: boolean | null
          is_hidden: boolean | null
          location: string
          map_link: string | null
          name: string
          phone_number: string | null
          place: string
          price: number
          price_child: number | null
          type: string | null
        }
        Insert: {
          activities?: Json | null
          admin_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_tickets?: number | null
          country: string
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          email?: string | null
          gallery_images?: string[] | null
          id?: string
          image_url: string
          images?: string[] | null
          is_custom_date?: boolean | null
          is_hidden?: boolean | null
          location: string
          map_link?: string | null
          name: string
          phone_number?: string | null
          place: string
          price: number
          price_child?: number | null
          type?: string | null
        }
        Update: {
          activities?: Json | null
          admin_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          available_tickets?: number | null
          country?: string
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          email?: string | null
          gallery_images?: string[] | null
          id?: string
          image_url?: string
          images?: string[] | null
          is_custom_date?: boolean | null
          is_hidden?: boolean | null
          location?: string
          map_link?: string | null
          name?: string
          phone_number?: string | null
          place?: string
          price?: number
          price_child?: number | null
          type?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vlogs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string
          title: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url: string
          title: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string
          title?: string
          video_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      creator_booking_summary: {
        Row: {
          booking_details: Json | null
          booking_type: string | null
          created_at: string | null
          guest_email_limited: string | null
          guest_name_masked: string | null
          guest_phone_limited: string | null
          id: string | null
          is_guest_booking: boolean | null
          item_id: string | null
          payment_method: string | null
          payment_status: string | null
          slots_booked: number | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          booking_details?: Json | null
          booking_type?: string | null
          created_at?: string | null
          guest_email_limited?: never
          guest_name_masked?: never
          guest_phone_limited?: never
          id?: string | null
          is_guest_booking?: boolean | null
          item_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          slots_booked?: number | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          booking_details?: Json | null
          booking_type?: string | null
          created_at?: string | null
          guest_email_limited?: never
          guest_name_masked?: never
          guest_phone_limited?: never
          id?: string | null
          is_guest_booking?: boolean | null
          item_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          slots_booked?: number | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_date_availability: {
        Args: { p_date: string; p_item_id: string; p_item_type: string }
        Returns: Json
      }
      get_trending_searches: {
        Args: { limit_count?: number }
        Returns: {
          query: string
          search_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_pin: { Args: { pin_text: string }; Returns: string }
      verify_item_credentials: {
        Args: {
          p_item_id: string
          p_item_type: string
          p_pin_attempt: string
          p_reg_number_attempt: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "guest" | "user" | "business" | "admin"
      business_account_type:
        | "hotel_accommodation"
        | "trip_event"
        | "place_destination"
      gender_type: "male" | "female" | "other" | "prefer_not_to_say"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["guest", "user", "business", "admin"],
      business_account_type: [
        "hotel_accommodation",
        "trip_event",
        "place_destination",
      ],
      gender_type: ["male", "female", "other", "prefer_not_to_say"],
    },
  },
} as const

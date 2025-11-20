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
          country: string
          created_at: string
          created_by: string | null
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
          country: string
          created_at?: string
          created_by?: string | null
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
          country?: string
          created_at?: string
          created_by?: string | null
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
          phone_numbers?: string[] | null
          place?: string
          registration_number?: string | null
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
          slots_booked: number | null
          status: string
          total_amount: number
          updated_at: string
          user_id: string | null
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
          slots_booked?: number | null
          status?: string
          total_amount: number
          updated_at?: string
          user_id?: string | null
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
          slots_booked?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
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
          is_hidden: boolean | null
          location: string
          map_link: string | null
          name: string
          phone_number: string | null
          place: string
          price: number
          price_child: number | null
          price_regular: number | null
          price_vip: number | null
          price_vvip: number | null
        }
        Insert: {
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
          is_hidden?: boolean | null
          location: string
          map_link?: string | null
          name: string
          phone_number?: string | null
          place: string
          price: number
          price_child?: number | null
          price_regular?: number | null
          price_vip?: number | null
          price_vvip?: number | null
        }
        Update: {
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
          is_hidden?: boolean | null
          location?: string
          map_link?: string | null
          name?: string
          phone_number?: string | null
          place?: string
          price?: number
          price_child?: number | null
          price_regular?: number | null
          price_vip?: number | null
          price_vvip?: number | null
        }
        Relationships: []
      }
      hotels: {
        Row: {
          admin_notes: string | null
          allowed_admin_emails: string[] | null
          amenities: string[] | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          country: string
          created_at: string
          created_by: string | null
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
          phone_numbers: string[] | null
          place: string
          registration_number: string | null
        }
        Insert: {
          admin_notes?: string | null
          allowed_admin_emails?: string[] | null
          amenities?: string[] | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          country: string
          created_at?: string
          created_by?: string | null
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
          phone_numbers?: string[] | null
          place: string
          registration_number?: string | null
        }
        Update: {
          admin_notes?: string | null
          allowed_admin_emails?: string[] | null
          amenities?: string[] | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
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
          profile_picture_url: string | null
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
          profile_picture_url?: string | null
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
          profile_picture_url?: string | null
          updated_at?: string
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
      trips: {
        Row: {
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
          is_hidden: boolean | null
          location: string
          map_link: string | null
          name: string
          phone_number: string | null
          place: string
          price: number
          price_child: number | null
        }
        Insert: {
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
          is_hidden?: boolean | null
          location: string
          map_link?: string | null
          name: string
          phone_number?: string | null
          place: string
          price: number
          price_child?: number | null
        }
        Update: {
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
          is_hidden?: boolean | null
          location?: string
          map_link?: string | null
          name?: string
          phone_number?: string | null
          place?: string
          price?: number
          price_child?: number | null
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

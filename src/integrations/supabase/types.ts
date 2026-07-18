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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content_html: string
          created_at: string
          creator_id: string
          id: string
          order_index: number
          owner_id: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          creator_id: string
          id?: string
          order_index?: number
          owner_id?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          created_at?: string
          creator_id?: string
          id?: string
          order_index?: number
          owner_id?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      booking_cancellations: {
        Row: {
          booking_id: string
          cancellation_comment: string | null
          cancellation_reasons: string[] | null
          cancelled_at: string
          cancelled_by: string
          id: string
          product_id: string
          product_title: string
          schedule_id: string | null
          schedule_title: string | null
          slot_date: string
          slot_time: string
          user_id: string | null
          user_name: string
          user_phone: string | null
        }
        Insert: {
          booking_id: string
          cancellation_comment?: string | null
          cancellation_reasons?: string[] | null
          cancelled_at?: string
          cancelled_by?: string
          id?: string
          product_id: string
          product_title: string
          schedule_id?: string | null
          schedule_title?: string | null
          slot_date: string
          slot_time: string
          user_id?: string | null
          user_name: string
          user_phone?: string | null
        }
        Update: {
          booking_id?: string
          cancellation_comment?: string | null
          cancellation_reasons?: string[] | null
          cancelled_at?: string
          cancelled_by?: string
          id?: string
          product_id?: string
          product_title?: string
          schedule_id?: string | null
          schedule_title?: string | null
          slot_date?: string
          slot_time?: string
          user_id?: string | null
          user_name?: string
          user_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_cancellations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_cancellations_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reminders: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          product_title: string | null
          reminder_type: string
          scheduled_at: string
          sent_at: string | null
          slot_date: string | null
          slot_time: string | null
          target_role: string
          user_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          product_title?: string | null
          reminder_type: string
          scheduled_at: string
          sent_at?: string | null
          slot_date?: string | null
          slot_time?: string | null
          target_role?: string
          user_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          product_title?: string | null
          reminder_type?: string
          scheduled_at?: string
          sent_at?: string | null
          slot_date?: string | null
          slot_time?: string | null
          target_role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      booking_reschedules: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string
          id: string
          new_date: string
          new_time: string
          old_date: string
          old_time: string
          product_id: string
          product_title: string
          reasons: string[] | null
          rescheduled_by: string
          schedule_id: string | null
          user_id: string | null
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string
          id?: string
          new_date: string
          new_time: string
          old_date: string
          old_time: string
          product_id: string
          product_title: string
          reasons?: string[] | null
          rescheduled_by?: string
          schedule_id?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          new_date?: string
          new_time?: string
          old_date?: string
          old_time?: string
          product_id?: string
          product_title?: string
          reasons?: string[] | null
          rescheduled_by?: string
          schedule_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          id: string
          schedule_id: string
          status: string
          time_slot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          schedule_id: string
          status?: string
          time_slot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          schedule_id?: string
          status?: string
          time_slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_time_slot_id_fkey"
            columns: ["time_slot_id"]
            isOneToOne: false
            referencedRelation: "time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      material_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          file_path: string
          id: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          file_path: string
          id?: string
          token: string
          used?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          file_path?: string
          id?: string
          token?: string
          used?: boolean
        }
        Relationships: []
      }
      material_bookmarks: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          material_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          material_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          material_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_bookmarks_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      material_unlocks: {
        Row: {
          id: string
          material_id: string | null
          material_title: string
          product_id: string | null
          product_title: string
          unlocked_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          material_id?: string | null
          material_title: string
          product_id?: string | null
          product_title: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          material_id?: string | null
          material_title?: string
          product_id?: string | null
          product_title?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_unlocks_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_unlocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          allow_download: boolean
          allow_view: boolean
          available_at: string | null
          content: string | null
          created_at: string
          deleted_at: string | null
          file_size: number | null
          file_url: string | null
          id: string
          order_index: number
          original_parent_id: string | null
          parent_id: string | null
          product_id: string
          teacher_allow_download: boolean
          teacher_id: string | null
          title: string
          type: Database["public"]["Enums"]["material_type"]
        }
        Insert: {
          allow_download?: boolean
          allow_view?: boolean
          available_at?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          order_index?: number
          original_parent_id?: string | null
          parent_id?: string | null
          product_id: string
          teacher_allow_download?: boolean
          teacher_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["material_type"]
        }
        Update: {
          allow_download?: boolean
          allow_view?: boolean
          available_at?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          order_index?: number
          original_parent_id?: string | null
          parent_id?: string | null
          product_id?: string
          teacher_allow_download?: boolean
          teacher_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["material_type"]
        }
        Relationships: [
          {
            foreignKeyName: "materials_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          morning_time: string
          reminder_24h: boolean
          reminder_2h: boolean
          reminder_morning: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          morning_time?: string
          reminder_24h?: boolean
          reminder_2h?: boolean
          reminder_morning?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          morning_time?: string
          reminder_24h?: boolean
          reminder_2h?: boolean
          reminder_morning?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_teachers: {
        Row: {
          created_at: string
          id: string
          product_id: string
          teacher_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          teacher_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_teachers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          access_duration_days: number | null
          created_at: string
          creator_id: string
          description: string | null
          faq: Json
          group_link_label: string | null
          has_schedule: boolean
          headline: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_paused: boolean
          kaspi_link: string | null
          kaspi_phone: string | null
          owner_id: string | null
          paused_message: string | null
          price: number
          slug: string | null
          telegram_link: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          access_duration_days?: number | null
          created_at?: string
          creator_id: string
          description?: string | null
          faq?: Json
          group_link_label?: string | null
          has_schedule?: boolean
          headline?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_paused?: boolean
          kaspi_link?: string | null
          kaspi_phone?: string | null
          owner_id?: string | null
          paused_message?: string | null
          price?: number
          slug?: string | null
          telegram_link?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          access_duration_days?: number | null
          created_at?: string
          creator_id?: string
          description?: string | null
          faq?: Json
          group_link_label?: string | null
          has_schedule?: boolean
          headline?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_paused?: boolean
          kaspi_link?: string | null
          kaspi_phone?: string | null
          owner_id?: string | null
          paused_message?: string | null
          price?: number
          slug?: string | null
          telegram_link?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_role: Database["public"]["Enums"]["app_role"] | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          login: string | null
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          login?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          login?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_intent_id: string | null
          product_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_intent_id?: string | null
          product_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_intent_id?: string | null
          product_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_info: string | null
          fcm_token: string
          id: string
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          fcm_token: string
          id?: string
          updated_at?: string
          user_id: string
          user_role?: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          fcm_token?: string
          id?: string
          updated_at?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      reschedule_requests: {
        Row: {
          booking_id: string
          comment: string | null
          created_at: string | null
          id: string
          new_date: string
          new_time: string
          old_date: string
          old_time: string
          product_id: string
          product_title: string
          reasons: string[] | null
          requested_by: string
          responded_at: string | null
          response_comment: string | null
          schedule_id: string | null
          status: string
          teacher_id: string | null
          user_id: string | null
        }
        Insert: {
          booking_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          new_date: string
          new_time: string
          old_date: string
          old_time: string
          product_id: string
          product_title: string
          reasons?: string[] | null
          requested_by?: string
          responded_at?: string | null
          response_comment?: string | null
          schedule_id?: string | null
          status?: string
          teacher_id?: string | null
          user_id?: string | null
        }
        Update: {
          booking_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          new_date?: string
          new_time?: string
          old_date?: string
          old_time?: string
          product_id?: string
          product_title?: string
          reasons?: string[] | null
          requested_by?: string
          responded_at?: string | null
          response_comment?: string | null
          schedule_id?: string | null
          status?: string
          teacher_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          max_participants: number | null
          product_id: string
          teacher_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          max_participants?: number | null
          product_id: string
          teacher_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          max_participants?: number | null
          product_id?: string
          teacher_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      school_teachers: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          school_user_id: string
          teacher_user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          school_user_id: string
          teacher_user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          school_user_id?: string
          teacher_user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          read_at: string | null
          sender: string
          text: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          read_at?: string | null
          sender: string
          text: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          read_at?: string | null
          sender?: string
          text?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          created_at: string
          display_name: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          unread_for_moderator: number
          unread_for_user: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          unread_for_moderator?: number
          unread_for_user?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          unread_for_moderator?: number
          unread_for_user?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      teacher_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          school_user_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          school_user_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          school_user_id?: string
          token?: string
        }
        Relationships: []
      }
      time_slots: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          is_available: boolean
          lesson_link: string | null
          max_participants: number | null
          schedule_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          is_available?: boolean
          lesson_link?: string | null
          max_participants?: number | null
          schedule_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          is_available?: boolean
          lesson_link?: string | null
          max_participants?: number | null
          schedule_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_slots_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_product_teacher: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
      owns_product: {
        Args: { _product_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "creator"
        | "user"
        | "student"
        | "school_admin"
        | "teacher"
        | "moderator"
      event_type: "group" | "individual"
      material_type: "file" | "video" | "text" | "link" | "folder"
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
      app_role: [
        "admin",
        "creator",
        "user",
        "student",
        "school_admin",
        "teacher",
        "moderator",
      ],
      event_type: ["group", "individual"],
      material_type: ["file", "video", "text", "link", "folder"],
    },
  },
} as const

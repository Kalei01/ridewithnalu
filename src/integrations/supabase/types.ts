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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      calendar: {
        Row: {
          end_date: string | null
          friday: number | null
          monday: number | null
          saturday: number | null
          service_id: string
          start_date: string | null
          sunday: number | null
          thursday: number | null
          tuesday: number | null
          wednesday: number | null
        }
        Insert: {
          end_date?: string | null
          friday?: number | null
          monday?: number | null
          saturday?: number | null
          service_id: string
          start_date?: string | null
          sunday?: number | null
          thursday?: number | null
          tuesday?: number | null
          wednesday?: number | null
        }
        Update: {
          end_date?: string | null
          friday?: number | null
          monday?: number | null
          saturday?: number | null
          service_id?: string
          start_date?: string | null
          sunday?: number | null
          thursday?: number | null
          tuesday?: number | null
          wednesday?: number | null
        }
        Relationships: []
      }
      calendar_dates: {
        Row: {
          date: string
          exception_type: number | null
          service_id: string
        }
        Insert: {
          date: string
          exception_type?: number | null
          service_id: string
        }
        Update: {
          date?: string
          exception_type?: number | null
          service_id?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          route_id: string
          route_long_name: string | null
          route_short_name: string | null
          route_type: number | null
        }
        Insert: {
          route_id: string
          route_long_name?: string | null
          route_short_name?: string | null
          route_type?: number | null
        }
        Update: {
          route_id?: string
          route_long_name?: string | null
          route_short_name?: string | null
          route_type?: number | null
        }
        Relationships: []
      }
      stop_times: {
        Row: {
          arrival_time: string | null
          departure_time: string | null
          stop_id: string
          stop_sequence: number
          trip_id: string
        }
        Insert: {
          arrival_time?: string | null
          departure_time?: string | null
          stop_id: string
          stop_sequence: number
          trip_id: string
        }
        Update: {
          arrival_time?: string | null
          departure_time?: string | null
          stop_id?: string
          stop_sequence?: number
          trip_id?: string
        }
        Relationships: []
      }
      stops: {
        Row: {
          location_type: number | null
          stop_id: string
          stop_lat: number | null
          stop_lon: number | null
          stop_name: string | null
        }
        Insert: {
          location_type?: number | null
          stop_id: string
          stop_lat?: number | null
          stop_lon?: number | null
          stop_name?: string | null
        }
        Update: {
          location_type?: number | null
          stop_id?: string
          stop_lat?: number | null
          stop_lon?: number | null
          stop_name?: string | null
        }
        Relationships: []
      }
      trip_updates: {
        Row: {
          delay_seconds: number | null
          fetched_at: string
          stop_id: string
          trip_id: string
        }
        Insert: {
          delay_seconds?: number | null
          fetched_at?: string
          stop_id: string
          trip_id: string
        }
        Update: {
          delay_seconds?: number | null
          fetched_at?: string
          stop_id?: string
          trip_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          direction_id: number | null
          route_id: string | null
          service_id: string | null
          trip_headsign: string | null
          trip_id: string
        }
        Insert: {
          direction_id?: number | null
          route_id?: string | null
          service_id?: string | null
          trip_headsign?: string | null
          trip_id: string
        }
        Update: {
          direction_id?: number | null
          route_id?: string | null
          service_id?: string | null
          trip_headsign?: string | null
          trip_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_departures: {
        Args: { p_limit?: number; p_station_query: string }
        Returns: {
          delay_seconds: number
          departure_time: string
          realtime_fetched_at: string
          route_short_name: string
          stop_id: string
          stop_name: string
          trip_headsign: string
          trip_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

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
      debug_logs: {
        Row: {
          created_at: string
          device_id: string
          events: Json
          id: string
          reason: string
          session_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          events?: Json
          id?: string
          reason?: string
          session_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          events?: Json
          id?: string
          reason?: string
          session_id?: string
        }
        Relationships: []
      }
      import_log: {
        Row: {
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          id: number
          row_counts: Json | null
          success: boolean
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: number
          row_counts?: Json | null
          success: boolean
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          id?: number
          row_counts?: Json | null
          success?: boolean
        }
        Relationships: []
      }
      job_status: {
        Row: {
          job_id: string
          last_updated_at: string
          rows_completed: number
          started_at: string
          status: string
          table_name: string
          total_rows_estimated: number | null
        }
        Insert: {
          job_id: string
          last_updated_at?: string
          rows_completed?: number
          started_at?: string
          status?: string
          table_name: string
          total_rows_estimated?: number | null
        }
        Update: {
          job_id?: string
          last_updated_at?: string
          rows_completed?: number
          started_at?: string
          status?: string
          table_name?: string
          total_rows_estimated?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_deliveries: {
        Row: {
          dedupe_key: string
          id: string
          sent_at: string
          token: string
        }
        Insert: {
          dedupe_key: string
          id?: string
          sent_at?: string
          token: string
        }
        Update: {
          dedupe_key?: string
          id?: string
          sent_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_token_fkey"
            columns: ["token"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["token"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          categories: string[]
          created_at: string
          quiet_end_min: number | null
          quiet_start_min: number | null
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          categories?: string[]
          created_at?: string
          quiet_end_min?: number | null
          quiet_start_min?: number | null
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          categories?: string[]
          created_at?: string
          quiet_end_min?: number | null
          quiet_start_min?: number | null
          token?: string
          updated_at?: string
          user_id?: string | null
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
      staging_calendar: {
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
      staging_calendar_dates: {
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
      staging_routes: {
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
      staging_stop_times: {
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
      staging_stops: {
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
      staging_trips: {
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
      station_parking: {
        Row: {
          name_match: string
          note: string | null
          status: string
        }
        Insert: {
          name_match: string
          note?: string | null
          status: string
        }
        Update: {
          name_match?: string
          note?: string | null
          status?: string
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
      user_preferences: {
        Row: {
          last_setup: Json | null
          preferences: Json
          saved_places: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          last_setup?: Json | null
          preferences?: Json
          saved_places?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          last_setup?: Json | null
          preferences?: Json
          saved_places?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      access_legs: {
        Args: {
          p_allow_drive?: boolean
          p_board_radius_m?: number
          p_earliest?: number
          p_lat: number
          p_lon: number
          p_station?: string
          p_station_radius_m?: number
          p_walk_radius_m?: number
          p_window_sec?: number
        }
        Returns: {
          arrive_seconds: number
          board_seconds: number
          from_stop_id: string
          from_stop_name: string
          headsign: string
          leave_by_seconds: number
          minutes: number
          mode: string
          route_id: string
          route_long_name: string
          route_short_name: string
          station_name: string
          station_stop: string
          to_stop_id: string
          to_stop_name: string
        }[]
      }
      active_service_ids: {
        Args: never
        Returns: {
          service_id: string
        }[]
      }
      connecting_departures: {
        Args: {
          p_after_seconds?: number
          p_dest_stop: string
          p_lat: number
          p_limit?: number
          p_lon: number
          p_radius_m?: number
        }
        Returns: {
          arrive_seconds: number
          depart_seconds: number
          dest_stop_name: string
          distance_m: number
          headsign: string
          ride_minutes: number
          route_id: string
          route_long_name: string
          route_short_name: string
          stop_id: string
          stop_name: string
          walk_minutes: number
        }[]
      }
      directional_dest_stop: {
        Args: {
          p_lat: number
          p_lon: number
          p_radius_m?: number
          p_station_radius_m?: number
          p_toward_rail?: boolean
        }
        Returns: {
          direction_id: number
          distance_m: number
          headsign: string
          route_long_name: string
          route_short_name: string
          stop_id: string
          stop_lat: number
          stop_lon: number
          stop_name: string
        }[]
      }
      egress_legs: {
        Args: {
          p_allow_drive?: boolean
          p_earliest?: number
          p_lat: number
          p_lon: number
          p_point_radius_m?: number
          p_station: string
          p_station_radius_m?: number
          p_walk_radius_m?: number
          p_window_sec?: number
        }
        Returns: {
          arrive_seconds: number
          board_seconds: number
          from_stop_id: string
          from_stop_name: string
          headsign: string
          minutes: number
          mode: string
          route_id: string
          route_long_name: string
          route_short_name: string
          to_stop_id: string
          to_stop_name: string
        }[]
      }
      feeder_bus_to_station: {
        Args: {
          p_after_seconds: number
          p_lat: number
          p_lon: number
          p_station: string
        }
        Returns: {
          alight_stop_name: string
          arrive_seconds: number
          board_stop_name: string
          board_walk_m: number
          depart_seconds: number
          ride_minutes: number
          route_short_name: string
        }[]
      }
      gtfs_data_expiry: {
        Args: never
        Returns: {
          days_remaining: number
          expires_on: string
        }[]
      }
      gtfs_distance_m: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      gtfs_seconds: { Args: { p_time: string }; Returns: number }
      leg_stop_sequence: {
        Args: {
          p_depart_seconds: number
          p_from_name: string
          p_rail?: boolean
          p_route_short?: string
          p_to_name: string
          p_tolerance_seconds?: number
        }
        Returns: {
          arrival_seconds: number
          departure_seconds: number
          is_alight: boolean
          is_board: boolean
          stop_id: string
          stop_lat: number
          stop_lon: number
          stop_name: string
          stop_sequence: number
        }[]
      }
      nalu_maintenance: { Args: never; Returns: Json }
      nearby_stops: {
        Args: { p_lat: number; p_lon: number; p_radius_m: number }
        Returns: {
          distance_m: number
          stop_id: string
          stop_lat: number
          stop_lon: number
          stop_name: string
        }[]
      }
      nearby_transit_stops: {
        Args: {
          p_after_seconds?: number
          p_bus_limit?: number
          p_lat: number
          p_lon: number
          p_rail_limit?: number
        }
        Returns: {
          arrivals: Json
          distance_m: number
          route_type: number
          stop_id: string
          stop_lat: number
          stop_lon: number
          stop_name: string
        }[]
      }
      nearest_stop: {
        Args: { p_lat: number; p_lon: number; p_rail_only?: boolean }
        Returns: {
          distance_m: number
          stop_id: string
          stop_lat: number
          stop_lon: number
          stop_name: string
        }[]
      }
      next_departures: {
        Args: { p_limit?: number; p_station_query: string }
        Returns: {
          departure_time: string
          route_short_name: string
          stop_name: string
          trip_headsign: string
        }[]
      }
      plan_bus_direct: {
        Args: {
          p_after_seconds?: number
          p_dest_lat: number
          p_dest_lon: number
          p_dest_radius_m?: number
          p_limit?: number
          p_origin_lat: number
          p_origin_lon: number
          p_origin_radius_m?: number
        }
        Returns: {
          arrive_seconds: number
          depart_seconds: number
          leave_by_seconds: number
          legs: Json
          rail_trip_id: string
          total_minutes: number
        }[]
      }
      plan_transit_general: {
        Args: {
          p_after_seconds?: number
          p_dest_lat: number
          p_dest_lon: number
          p_dest_radius_m?: number
          p_limit?: number
          p_origin_lat: number
          p_origin_lon: number
          p_origin_radius_m?: number
          p_transfer_radius_m?: number
        }
        Returns: {
          arrive_seconds: number
          depart_seconds: number
          leave_by_seconds: number
          legs: Json
          rail_trip_id: string
          total_minutes: number
        }[]
      }
      plan_inbound: {
        Args: {
          p_after_seconds?: number
          p_allow_drive?: boolean
          p_dest_lat: number
          p_dest_lon: number
          p_home_lat: number
          p_home_lon: number
          p_limit?: number
          p_station: string
          p_transfer_buffer_seconds?: number
        }
        Returns: {
          arrive_seconds: number
          depart_seconds: number
          leave_by_seconds: number
          legs: Json
          rail_trip_id: string
          total_minutes: number
        }[]
      }
      plan_outbound: {
        Args: {
          p_after_seconds?: number
          p_allow_drive?: boolean
          p_bus_route_id?: string
          p_dest_lat?: number
          p_dest_lon?: number
          p_dest_radius_m?: number
          p_dest_stop: string
          p_limit?: number
          p_origin_lat: number
          p_origin_lon: number
          p_station: string
          p_transfer_buffer_seconds?: number
          p_transfer_radius_m?: number
        }
        Returns: {
          arrive_seconds: number
          depart_seconds: number
          leave_by_seconds: number
          legs: Json
          rail_trip_id: string
          total_minutes: number
        }[]
      }
      plan_rail_chains: {
        Args: {
          p_after_seconds?: number
          p_bus_route_id?: string
          p_dest_stop: string
          p_home_stop: string
          p_limit?: number
          p_transfer_buffer_seconds?: number
          p_transfer_radius_m?: number
        }
        Returns: {
          arrive_seconds: number
          arrive_time: string
          bus_depart_seconds: number
          bus_depart_time: string
          bus_headsign: string
          bus_route_id: string
          bus_route_long_name: string
          bus_route_short_name: string
          bus_stop_name: string
          depart_seconds: number
          depart_time: string
          dest_stop_name: string
          home_stop_name: string
          rail_arrive_seconds: number
          rail_arrive_time: string
          rail_headsign: string
          rail_route_long_name: string
          rail_route_short_name: string
          rail_trip_id: string
          total_minutes: number
          transfer_stop_id: string
          transfer_stop_name: string
        }[]
      }
      prune_import_log: { Args: never; Returns: undefined }
      rail_departures: {
        Args: {
          p_after_seconds?: number
          p_home_stop: string
          p_limit?: number
        }
        Returns: {
          departure_seconds: number
          departure_time: string
          direction_id: number
          direction_terminus: string
          ride_minutes: number
          route_id: string
          route_long_name: string
          route_short_name: string
          stop_name: string
          terminus_lon: number
          trip_headsign: string
          trip_id: string
        }[]
      }
      rail_line_stations: {
        Args: never
        Returns: {
          line_sequence: number
          stop_id: string
          stop_lat: number
          stop_lon: number
          stop_name: string
        }[]
      }
      rail_stations: {
        Args: never
        Returns: {
          stop_id: string
          stop_lat: number
          stop_lon: number
          stop_name: string
        }[]
      }
      routes_serving_stop: {
        Args: { p_stop_id: string }
        Returns: {
          route_id: string
          route_long_name: string
          route_short_name: string
          route_type: number
          sample_headsign: string
        }[]
      }
      service_hours: {
        Args: { p_route_type?: number; p_stop_id: string }
        Returns: {
          dow: number
          first_seconds: number
          last_seconds: number
        }[]
      }
      swap_gtfs_staging: { Args: never; Returns: Json }
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

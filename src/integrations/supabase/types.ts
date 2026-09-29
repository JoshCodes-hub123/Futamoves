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
      dispatch_events: {
        Row: {
          actor_id: string | null
          actor_role: string
          created_at: string
          dispatch_score: number | null
          event_type: string
          from_state: string | null
          id: string
          offer_id: string | null
          reason: Json | null
          rider_id: string | null
          to_state: string | null
          trip_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          dispatch_score?: number | null
          event_type: string
          from_state?: string | null
          id?: string
          offer_id?: string | null
          reason?: Json | null
          rider_id?: string | null
          to_state?: string | null
          trip_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string
          created_at?: string
          dispatch_score?: number | null
          event_type?: string
          from_state?: string | null
          id?: string
          offer_id?: string | null
          reason?: Json | null
          rider_id?: string | null
          to_state?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "ride_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_settings: {
        Row: {
          escalate_after_seconds: number
          fairness_window_days: number
          id: boolean
          max_offers: number
          offer_timeout_seconds: number
          updated_at: string
          updated_by: string | null
          weights: Json
        }
        Insert: {
          escalate_after_seconds?: number
          fairness_window_days?: number
          id?: boolean
          max_offers?: number
          offer_timeout_seconds?: number
          updated_at?: string
          updated_by?: string | null
          weights?: Json
        }
        Update: {
          escalate_after_seconds?: number
          fairness_window_days?: number
          id?: boolean
          max_offers?: number
          offer_timeout_seconds?: number
          updated_at?: string
          updated_by?: string | null
          weights?: Json
        }
        Relationships: []
      }
      fare_rule_history: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          destination_location_id: string
          fare_rule_id: string
          id: string
          new_active: boolean
          new_amount_kobo: number
          origin_location_id: string
          party_size: number | null
          previous_active: boolean | null
          previous_amount_kobo: number | null
          reason: string | null
          ride_type: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          destination_location_id: string
          fare_rule_id: string
          id?: string
          new_active: boolean
          new_amount_kobo: number
          origin_location_id: string
          party_size?: number | null
          previous_active?: boolean | null
          previous_amount_kobo?: number | null
          reason?: string | null
          ride_type: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          destination_location_id?: string
          fare_rule_id?: string
          id?: string
          new_active?: boolean
          new_amount_kobo?: number
          origin_location_id?: string
          party_size?: number | null
          previous_active?: boolean | null
          previous_amount_kobo?: number | null
          reason?: string | null
          ride_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fare_rule_history_fare_rule_id_fkey"
            columns: ["fare_rule_id"]
            isOneToOne: false
            referencedRelation: "fare_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      fare_rules: {
        Row: {
          active: boolean
          amount_kobo: number
          created_at: string
          destination_location_id: string
          id: string
          origin_location_id: string
          party_size: number | null
          ride_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          amount_kobo: number
          created_at?: string
          destination_location_id: string
          id?: string
          origin_location_id: string
          party_size?: number | null
          ride_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          amount_kobo?: number
          created_at?: string
          destination_location_id?: string
          id?: string
          origin_location_id?: string
          party_size?: number | null
          ride_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fare_rules_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fare_rules_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          funding_instructions: string
          id: boolean
          max_funding_kobo: number
          min_funding_kobo: number
          service_charge_bps: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          funding_instructions?: string
          id?: boolean
          max_funding_kobo?: number
          min_funding_kobo?: number
          service_charge_bps?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          funding_instructions?: string
          id?: boolean
          max_funding_kobo?: number
          min_funding_kobo?: number
          service_charge_bps?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      location_suggestions: {
        Row: {
          approved_location_id: string | null
          category: Database["public"]["Enums"]["location_category"]
          created_at: string
          description: string | null
          google_place_id: string | null
          id: string
          image_path: string | null
          latitude: number | null
          longitude: number | null
          name: string
          reason: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["location_suggestion_status"]
          submitted_by: string
          submitter_role: string
          updated_at: string
        }
        Insert: {
          approved_location_id?: string | null
          category: Database["public"]["Enums"]["location_category"]
          created_at?: string
          description?: string | null
          google_place_id?: string | null
          id?: string
          image_path?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          reason: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["location_suggestion_status"]
          submitted_by: string
          submitter_role: string
          updated_at?: string
        }
        Update: {
          approved_location_id?: string | null
          category?: Database["public"]["Enums"]["location_category"]
          created_at?: string
          description?: string | null
          google_place_id?: string | null
          id?: string
          image_path?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          reason?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["location_suggestion_status"]
          submitted_by?: string
          submitter_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_suggestions_approved_location_id_fkey"
            columns: ["approved_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          category: Database["public"]["Enums"]["location_category"]
          created_at: string
          description: string | null
          display_order: number
          google_place_id: string | null
          id: string
          image_url: string | null
          latitude: number | null
          location_type: string
          longitude: number | null
          name: string
          official_name: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: Database["public"]["Enums"]["location_category"]
          created_at?: string
          description?: string | null
          display_order?: number
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location_type: string
          longitude?: number | null
          name: string
          official_name?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: Database["public"]["Enums"]["location_category"]
          created_at?: string
          description?: string | null
          display_order?: number
          google_place_id?: string | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location_type?: string
          longitude?: number | null
          name?: string
          official_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          event_key: string | null
          id: string
          is_read: boolean
          notification_type: string
          recipient_id: string
          title: string
          trip_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          event_key?: string | null
          id?: string
          is_read?: boolean
          notification_type: string
          recipient_id: string
          title: string
          trip_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          event_key?: string | null
          id?: string
          is_read?: boolean
          notification_type?: string
          recipient_id?: string
          title?: string
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_group_members: {
        Row: {
          confirmed_version: number | null
          group_id: string
          id: string
          joined_at: string
          meeting_point_agreed: boolean
          request_id: string
          ride_confirmed_at: string | null
          student_id: string
        }
        Insert: {
          confirmed_version?: number | null
          group_id: string
          id?: string
          joined_at?: string
          meeting_point_agreed?: boolean
          request_id: string
          ride_confirmed_at?: string | null
          student_id: string
        }
        Update: {
          confirmed_version?: number | null
          group_id?: string
          id?: string
          joined_at?: string
          meeting_point_agreed?: boolean
          request_id?: string
          ride_confirmed_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_group_members_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_group_messages: {
        Row: {
          body: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_groups: {
        Row: {
          created_at: string
          created_by: string
          departure_time: string
          destination_text: string
          id: string
          is_private: boolean
          meeting_point_location_id: string | null
          meeting_point_note: string | null
          meeting_point_text: string
          meeting_point_version: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          departure_time: string
          destination_text: string
          id?: string
          is_private?: boolean
          meeting_point_location_id?: string | null
          meeting_point_note?: string | null
          meeting_point_text: string
          meeting_point_version?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          departure_time?: string
          destination_text?: string
          id?: string
          is_private?: boolean
          meeting_point_location_id?: string | null
          meeting_point_note?: string | null
          meeting_point_text?: string
          meeting_point_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_groups_meeting_point_location_id_fkey"
            columns: ["meeting_point_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_offers: {
        Row: {
          created_at: string
          dispatch_reason: Json | null
          dispatch_score: number | null
          expires_at: string
          id: string
          offered_at: string
          responded_at: string | null
          response: string
          response_reason: string | null
          rider_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispatch_reason?: Json | null
          dispatch_score?: number | null
          expires_at: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          response?: string
          response_reason?: string | null
          rider_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispatch_reason?: Json | null
          dispatch_score?: number | null
          expires_at?: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          response?: string
          response_reason?: string | null
          rider_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_offers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          created_at: string
          departure_time: string
          destination_latitude: number | null
          destination_location_id: string | null
          destination_longitude: number | null
          destination_point_id: string | null
          destination_text: string
          group_id: string | null
          id: string
          meeting_point_text: string | null
          origin_latitude: number | null
          origin_location_id: string | null
          origin_longitude: number | null
          origin_point_id: string | null
          origin_text: string
          party_size: number
          ride_type: string
          status: Database["public"]["Enums"]["ride_request_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          departure_time: string
          destination_latitude?: number | null
          destination_location_id?: string | null
          destination_longitude?: number | null
          destination_point_id?: string | null
          destination_text: string
          group_id?: string | null
          id?: string
          meeting_point_text?: string | null
          origin_latitude?: number | null
          origin_location_id?: string | null
          origin_longitude?: number | null
          origin_point_id?: string | null
          origin_text: string
          party_size?: number
          ride_type?: string
          status?: Database["public"]["Enums"]["ride_request_status"]
          student_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          departure_time?: string
          destination_latitude?: number | null
          destination_location_id?: string | null
          destination_longitude?: number | null
          destination_point_id?: string | null
          destination_text?: string
          group_id?: string | null
          id?: string
          meeting_point_text?: string | null
          origin_latitude?: number | null
          origin_location_id?: string | null
          origin_longitude?: number | null
          origin_point_id?: string | null
          origin_text?: string
          party_size?: number
          ride_type?: string
          status?: Database["public"]["Enums"]["ride_request_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_group_fk"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_applications: {
        Row: {
          avatar_path: string
          created_at: string
          full_name: string
          id: string
          id_document_path: string | null
          id_number: string | null
          id_type: string | null
          phone: string
          plate_number: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["rider_application_status"]
          updated_at: string
          user_id: string
          vehicle_description: string
          vehicle_photo_path: string | null
        }
        Insert: {
          avatar_path: string
          created_at?: string
          full_name: string
          id?: string
          id_document_path?: string | null
          id_number?: string | null
          id_type?: string | null
          phone: string
          plate_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["rider_application_status"]
          updated_at?: string
          user_id: string
          vehicle_description: string
          vehicle_photo_path?: string | null
        }
        Update: {
          avatar_path?: string
          created_at?: string
          full_name?: string
          id?: string
          id_document_path?: string | null
          id_number?: string | null
          id_type?: string | null
          phone?: string
          plate_number?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["rider_application_status"]
          updated_at?: string
          user_id?: string
          vehicle_description?: string
          vehicle_photo_path?: string | null
        }
        Relationships: []
      }
      rider_availability: {
        Row: {
          changed_at: string
          latitude: number | null
          location_accuracy_m: number | null
          location_at: string | null
          longitude: number | null
          rider_id: string
          status: string
        }
        Insert: {
          changed_at?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          location_at?: string | null
          longitude?: number | null
          rider_id: string
          status?: string
        }
        Update: {
          changed_at?: string
          latitude?: number | null
          location_accuracy_m?: number | null
          location_at?: string | null
          longitude?: number | null
          rider_id?: string
          status?: string
        }
        Relationships: []
      }
      rider_ratings: {
        Row: {
          created_at: string
          id: string
          rider_id: string
          stars: number
          student_id: string
          tags: string[]
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rider_id: string
          stars: number
          student_id: string
          tags?: string[]
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rider_id?: string
          stars?: number
          student_id?: string
          tags?: string[]
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_ratings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_wallets: {
        Row: {
          balance_kobo: number
          reserved_kobo: number
          rider_id: string
          updated_at: string
        }
        Insert: {
          balance_kobo?: number
          reserved_kobo?: number
          rider_id: string
          updated_at?: string
        }
        Update: {
          balance_kobo?: number
          reserved_kobo?: number
          rider_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          account_type: string
          avatar_path: string | null
          created_at: string
          current_submission_id: string | null
          department: string | null
          faculty: string | null
          full_name: string | null
          id: string
          matric_number: string | null
          phone: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["student_verification_status"]
          verified_at: string | null
        }
        Insert: {
          account_type?: string
          avatar_path?: string | null
          created_at?: string
          current_submission_id?: string | null
          department?: string | null
          faculty?: string | null
          full_name?: string | null
          id: string
          matric_number?: string | null
          phone?: string | null
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["student_verification_status"]
          verified_at?: string | null
        }
        Update: {
          account_type?: string
          avatar_path?: string | null
          created_at?: string
          current_submission_id?: string | null
          department?: string | null
          faculty?: string | null
          full_name?: string | null
          id?: string
          matric_number?: string | null
          phone?: string | null
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["student_verification_status"]
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_current_submission_fk"
            columns: ["current_submission_id"]
            isOneToOne: false
            referencedRelation: "verification_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_confirmations: {
        Row: {
          confirmation_type: string
          created_at: string
          id: string
          role: string
          trip_id: string
          trip_status: string
          user_id: string
        }
        Insert: {
          confirmation_type: string
          created_at?: string
          id?: string
          role: string
          trip_id: string
          trip_status: string
          user_id: string
        }
        Update: {
          confirmation_type?: string
          created_at?: string
          id?: string
          role?: string
          trip_id?: string
          trip_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_confirmations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_service_charges: {
        Row: {
          amount_kobo: number
          created_at: string
          fare_kobo: number
          id: string
          rider_id: string
          service_charge_bps: number
          status: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          fare_kobo: number
          id?: string
          rider_id: string
          service_charge_bps: number
          status: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          fare_kobo?: number
          id?: string
          rider_id?: string
          service_charge_bps?: number
          status?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_service_charges_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_status_history: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          from_status: string | null
          id: string
          reason: string | null
          rider_id: string | null
          to_status: string
          trip_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          rider_id?: string | null
          to_status: string
          trip_id: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          reason?: string | null
          rider_id?: string | null
          to_status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_status_history_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          accepted_at: string | null
          arrived_at: string | null
          arriving_at: string | null
          assigned_at: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          cancelled_from_status: string | null
          completed_at: string | null
          confirmed_at: string
          created_at: string
          departure_time: string
          destination_location_id: string | null
          destination_text: string
          dispatch_started_at: string
          dispatch_state: string
          escalated_at: string | null
          fare_kobo: number | null
          fare_locked_at: string | null
          fare_per_passenger_kobo: number | null
          fare_ride_type: string | null
          fare_rule_id: string | null
          group_id: string
          id: string
          meeting_point_location_id: string | null
          meeting_point_note: string | null
          meeting_point_text: string
          member_count: number
          passenger_count: number
          picked_up_at: string | null
          rider_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          arrived_at?: string | null
          arriving_at?: string | null
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          cancelled_from_status?: string | null
          completed_at?: string | null
          confirmed_at?: string
          created_at?: string
          departure_time: string
          destination_location_id?: string | null
          destination_text: string
          dispatch_started_at?: string
          dispatch_state?: string
          escalated_at?: string | null
          fare_kobo?: number | null
          fare_locked_at?: string | null
          fare_per_passenger_kobo?: number | null
          fare_ride_type?: string | null
          fare_rule_id?: string | null
          group_id: string
          id?: string
          meeting_point_location_id?: string | null
          meeting_point_note?: string | null
          meeting_point_text: string
          member_count: number
          passenger_count: number
          picked_up_at?: string | null
          rider_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          arrived_at?: string | null
          arriving_at?: string | null
          assigned_at?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          cancelled_from_status?: string | null
          completed_at?: string | null
          confirmed_at?: string
          created_at?: string
          departure_time?: string
          destination_location_id?: string | null
          destination_text?: string
          dispatch_started_at?: string
          dispatch_state?: string
          escalated_at?: string | null
          fare_kobo?: number | null
          fare_locked_at?: string | null
          fare_per_passenger_kobo?: number | null
          fare_ride_type?: string | null
          fare_rule_id?: string | null
          group_id?: string
          id?: string
          meeting_point_location_id?: string | null
          meeting_point_note?: string | null
          meeting_point_text?: string
          member_count?: number
          passenger_count?: number
          picked_up_at?: string | null
          rider_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_fare_rule_id_fkey"
            columns: ["fare_rule_id"]
            isOneToOne: false
            referencedRelation: "fare_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "ride_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_meeting_point_location_id_fkey"
            columns: ["meeting_point_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
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
      verification_submissions: {
        Row: {
          academic_title: string | null
          account_type: string
          avatar_path: string
          created_at: string
          department: string | null
          faculty: string
          full_name: string
          id: string
          id_card_path: string
          matric_number: string
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["student_verification_status"]
          student_id: string
        }
        Insert: {
          academic_title?: string | null
          account_type?: string
          avatar_path: string
          created_at?: string
          department?: string | null
          faculty: string
          full_name: string
          id?: string
          id_card_path: string
          matric_number: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["student_verification_status"]
          student_id: string
        }
        Update: {
          academic_title?: string | null
          account_type?: string
          avatar_path?: string
          created_at?: string
          department?: string | null
          faculty?: string
          full_name?: string
          id?: string
          id_card_path?: string
          matric_number?: string
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["student_verification_status"]
          student_id?: string
        }
        Relationships: []
      }
      wallet_funding_requests: {
        Row: {
          amount_kobo: number
          created_at: string
          id: string
          method: string
          paid_at: string | null
          payer_reference: string | null
          provider_reference: string | null
          receipt_path: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rider_id: string
          status: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_reference?: string | null
          provider_reference?: string | null
          receipt_path: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id: string
          status?: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          id?: string
          method?: string
          paid_at?: string | null
          payer_reference?: string | null
          provider_reference?: string | null
          receipt_path?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id?: string
          status?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_kobo: number
          balance_after_kobo: number
          balance_impact_kobo: number
          created_at: string
          created_by: string | null
          created_by_role: string
          description: string
          funding_request_id: string | null
          id: string
          reserved_after_kobo: number
          rider_id: string
          trip_id: string | null
          type: string
        }
        Insert: {
          amount_kobo: number
          balance_after_kobo: number
          balance_impact_kobo: number
          created_at?: string
          created_by?: string | null
          created_by_role: string
          description: string
          funding_request_id?: string | null
          id?: string
          reserved_after_kobo: number
          rider_id: string
          trip_id?: string | null
          type: string
        }
        Update: {
          amount_kobo?: number
          balance_after_kobo?: number
          balance_impact_kobo?: number
          created_at?: string
          created_by?: string | null
          created_by_role?: string
          description?: string
          funding_request_id?: string | null
          id?: string
          reserved_after_kobo?: number
          rider_id?: string
          trip_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_funding_request_id_fkey"
            columns: ["funding_request_id"]
            isOneToOne: false
            referencedRelation: "wallet_funding_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_group_member: { Args: { p_group_id: string }; Returns: Json }
      admin_assign_rider: {
        Args: { p_override?: boolean; p_rider_id: string; p_trip_id: string }
        Returns: undefined
      }
      admin_audit_log: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          actor_email: string
          at: string
          reason: string
          target: string
          trip_id: string
        }[]
      }
      admin_cancel_trip: {
        Args: { p_outcome: string; p_reason: string; p_trip_id: string }
        Returns: undefined
      }
      admin_complete_trip: {
        Args: { p_reason: string; p_trip_id: string }
        Returns: undefined
      }
      admin_dispatch_overview: {
        Args: never
        Returns: {
          candidate_count: number
          dispatch_state: string
          offers_cancelled: number
          offers_declined: number
          offers_timed_out: number
          offers_total: number
          pending_expires_at: string
          pending_rider_id: string
          trip_id: string
          waiting_seconds: number
        }[]
      }
      admin_list_eligible_riders: {
        Args: never
        Returns: {
          availability: string
          busy: boolean
          fairness: Json
          full_name: string
          has_pending_offer: boolean
          plate_number: string
          user_id: string
          vehicle_description: string
        }[]
      }
      admin_list_rider_applications: {
        Args: never
        Returns: {
          avatar_path: string
          created_at: string
          email: string
          full_name: string
          id: string
          id_document_path: string
          id_number: string
          id_type: string
          phone: string
          plate_number: string
          rejection_reason: string
          reviewed_at: string
          status: Database["public"]["Enums"]["rider_application_status"]
          user_id: string
          vehicle_description: string
          vehicle_photo_path: string
        }[]
      }
      admin_mark_rider_no_show: {
        Args: { p_reason: string; p_trip_id: string }
        Returns: undefined
      }
      admin_ops_overview: { Args: never; Returns: Json }
      admin_redispatch: { Args: { p_trip_id: string }; Returns: undefined }
      admin_reverse_service_charge: {
        Args: { p_reason: string; p_trip_id: string }
        Returns: undefined
      }
      admin_review_funding: {
        Args: { p_approve: boolean; p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_rider_pool: {
        Args: never
        Returns: {
          availability: string
          completed_rides: number
          current_trip_id: string
          current_trip_route: string
          current_trip_status: string
          location_updated_at: string
          rating_avg: number
          rating_count: number
          user_id: string
        }[]
      }
      admin_rider_wallets: {
        Args: never
        Returns: {
          balance_kobo: number
          full_name: string
          pending_kobo: number
          reserved_kobo: number
          rider_id: string
        }[]
      }
      admin_save_fare_rule: {
        Args: {
          p_amount_kobo: number
          p_dest: string
          p_id: string
          p_origin: string
          p_party: number
          p_reason: string
          p_ride_type: string
        }
        Returns: string
      }
      admin_set_fare_rule_active: {
        Args: { p_active: boolean; p_id: string; p_reason: string }
        Returns: undefined
      }
      admin_trip_dispatch: { Args: { p_trip_id: string }; Returns: Json }
      admin_trip_issues: {
        Args: never
        Returns: {
          issue: string
          since: string
          trip_id: string
        }[]
      }
      admin_trip_participants: {
        Args: never
        Returns: {
          assignment_method: string
          lecturers: number
          passenger_pickup_confirms: number
          rider_at_destination: boolean
          rider_availability: string
          rider_start_confirmed: boolean
          students: number
          trip_id: string
        }[]
      }
      admin_trip_passengers: {
        Args: never
        Returns: {
          passenger_names: string
          trip_id: string
        }[]
      }
      admin_update_dispatch_settings: {
        Args: {
          p_escalate_after_seconds: number
          p_fairness_window_days: number
          p_max_offers: number
          p_offer_timeout_seconds: number
          p_weights: Json
        }
        Returns: undefined
      }
      admin_update_financial_settings: {
        Args: {
          p_funding_instructions: string
          p_max_funding_kobo: number
          p_min_funding_kobo: number
          p_service_charge_bps: number
        }
        Returns: undefined
      }
      admin_wallet_adjust: {
        Args: {
          p_amount_kobo: number
          p_credit: boolean
          p_reason: string
          p_rider: string
        }
        Returns: undefined
      }
      agree_meeting_point: { Args: { p_group_id: string }; Returns: undefined }
      approve_location_suggestion: {
        Args: {
          p_category: Database["public"]["Enums"]["location_category"]
          p_description: string
          p_google_place_id: string
          p_latitude: number
          p_location_id: string
          p_location_type: string
          p_longitude: number
          p_mode: string
          p_name: string
          p_suggestion_id: string
        }
        Returns: string
      }
      can_view_rider_photo: { Args: { _path: string }; Returns: boolean }
      claim_lecturer_role: { Args: never; Returns: string }
      claim_student_role: { Args: never; Returns: string }
      compute_fare: {
        Args: {
          p_dest: string
          p_origin: string
          p_party: number
          p_ride_type: string
        }
        Returns: {
          fare_kobo: number
          per_passenger_kobo: number
          rule_id: string
        }[]
      }
      confirm_meeting_point: {
        Args: { p_group_id: string; p_version?: number }
        Returns: undefined
      }
      confirm_ride: { Args: { p_group_id: string }; Returns: Json }
      destinations_compatible: {
        Args: { _a: string; _b: string }
        Returns: boolean
      }
      dispatch_candidates: {
        Args: { _trip: string }
        Returns: {
          breakdown: Json
          rider_id: string
          score: number
        }[]
      }
      dispatch_escalate: {
        Args: { _trip: string; _why: string }
        Returns: undefined
      }
      dispatch_tick: { Args: never; Returns: undefined }
      dispatch_trip: { Args: { _trip: string }; Returns: undefined }
      dropoff_radius_m: { Args: never; Returns: number }
      emit_admin_notifications: {
        Args: {
          p_body: string
          p_event_key: string
          p_title: string
          p_trip_id: string
          p_type: string
        }
        Returns: undefined
      }
      emit_notification: {
        Args: {
          p_body: string
          p_event_key: string
          p_recipient_id: string
          p_title: string
          p_trip_id: string
          p_type: string
        }
        Returns: undefined
      }
      geo_distance_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      get_my_role: { Args: never; Returns: string }
      get_ride_group: { Args: { p_group_id: string }; Returns: Json }
      group_chat_open: { Args: { _group_id: string }; Returns: boolean }
      group_organizer: { Args: { _group_id: string }; Returns: string }
      group_passenger_count: { Args: { _group_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_verified_student: { Args: { _user_id: string }; Returns: boolean }
      leave_ride_group: { Args: { p_group_id: string }; Returns: undefined }
      list_group_messages: {
        Args: { p_group_id: string }
        Returns: {
          body: string
          created_at: string
          first_name: string
          id: string
          is_me: boolean
        }[]
      }
      log_dispatch: {
        Args: {
          _from: string
          _offer: string
          _reason: Json
          _rider: string
          _role: string
          _score: number
          _to: string
          _trip: string
          _type: string
        }
        Returns: undefined
      }
      log_trip_status: {
        Args: {
          _from: string
          _reason: string
          _role: string
          _to: string
          _trip: string
        }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      match_ride_request: { Args: { p_request_id: string }; Returns: Json }
      match_time_tolerance: { Args: never; Returns: string }
      normalize_place: { Args: { _t: string }; Returns: string }
      passenger_confirm_completion: {
        Args: { p_trip_id: string }
        Returns: Json
      }
      passenger_confirm_pickup: { Args: { p_trip_id: string }; Returns: Json }
      passenger_report_rider_late: {
        Args: { p_reason?: string; p_trip_id: string }
        Returns: undefined
      }
      pick_compatible_requests: {
        Args: {
          _exclude: string[]
          _group_id: string
          _ref: string
          _seats: number
        }
        Returns: string[]
      }
      pickup_radius_m: { Args: never; Returns: number }
      places_compatible: {
        Args: {
          a_id: string
          a_lat: number
          a_lng: number
          a_text: string
          b_id: string
          b_lat: number
          b_lng: number
          b_text: string
          radius_m: number
        }
        Returns: boolean
      }
      quote_fare: {
        Args: {
          p_dest: string
          p_origin: string
          p_party: number
          p_ride_type: string
        }
        Returns: Json
      }
      rate_rider: {
        Args: { p_stars: number; p_tags: string[]; p_trip_id: string }
        Returns: undefined
      }
      refresh_group_status: { Args: { _group_id: string }; Returns: undefined }
      reject_location_suggestion: {
        Args: { p_reason: string; p_suggestion_id: string }
        Returns: undefined
      }
      release_request_from_group: {
        Args: { _group_id: string; _request_id: string }
        Returns: undefined
      }
      requests_compatible: {
        Args: {
          a: Database["public"]["Tables"]["ride_requests"]["Row"]
          b: Database["public"]["Tables"]["ride_requests"]["Row"]
        }
        Returns: boolean
      }
      review_rider_application: {
        Args: { p_action: string; p_application_id: string; p_reason: string }
        Returns: undefined
      }
      review_verification: {
        Args: { p_approve: boolean; p_reason?: string; p_submission_id: string }
        Returns: undefined
      }
      ride_capacity: { Args: never; Returns: number }
      rider_advance_trip: {
        Args: { p_to: string; p_trip_id: string }
        Returns: undefined
      }
      rider_availability_of: { Args: { _uid: string }; Returns: string }
      rider_available_trips: {
        Args: never
        Returns: {
          confirmed_at: string
          departure_time: string
          destination_text: string
          id: string
          meeting_point_note: string
          meeting_point_text: string
          member_count: number
          passenger_count: number
        }[]
      }
      rider_charge_preview: {
        Args: { p_trip_ids: string[] }
        Returns: {
          charge_kobo: number
          fare_kobo: number
          trip_id: string
        }[]
      }
      rider_claim_trip: { Args: { p_trip_id: string }; Returns: undefined }
      rider_dispatch_score: { Args: { _uid: string }; Returns: Json }
      rider_is_busy: {
        Args: { _except?: string; _uid: string }
        Returns: boolean
      }
      rider_is_eligible: { Args: { _uid: string }; Returns: boolean }
      rider_my_offers: {
        Args: never
        Returns: {
          departure_time: string
          destination_text: string
          expires_at: string
          meeting_point_note: string
          meeting_point_text: string
          member_count: number
          offer_id: string
          offered_at: string
          passenger_count: number
          trip_id: string
        }[]
      }
      rider_report_passenger_no_show: {
        Args: { p_reason?: string; p_trip_id: string }
        Returns: undefined
      }
      rider_respond_assignment: {
        Args: { p_accept: boolean; p_reason?: string; p_trip_id: string }
        Returns: undefined
      }
      rider_respond_offer: {
        Args: { p_accept: boolean; p_offer_id: string; p_reason?: string }
        Returns: Json
      }
      rider_submit_funding: {
        Args: {
          p_amount_kobo: number
          p_paid_at: string
          p_receipt_path: string
          p_reference: string
        }
        Returns: string
      }
      rider_wallet_summary: { Args: never; Returns: Json }
      rider_withdraw_trip: {
        Args: { p_reason: string; p_trip_id: string }
        Returns: undefined
      }
      send_group_message: {
        Args: { p_body: string; p_group_id: string }
        Returns: string
      }
      service_charge_for: { Args: { p_fare: number }; Returns: number }
      set_meeting_point: {
        Args: { p_group_id: string; p_location_id: string; p_note?: string }
        Returns: undefined
      }
      set_my_availability: { Args: { p_status: string }; Returns: string }
      set_my_location: {
        Args: { p_accuracy: number; p_lat: number; p_lng: number }
        Returns: undefined
      }
      start_private_ride: { Args: { p_request_id: string }; Returns: Json }
      student_available_riders: { Args: { p_trip_id: string }; Returns: Json }
      student_dispatch_ping: {
        Args: { p_group_id: string }
        Returns: undefined
      }
      student_in_active_group: { Args: { _uid: string }; Returns: boolean }
      student_request_rider: {
        Args: { p_rider_id: string; p_trip_id: string }
        Returns: undefined
      }
      submit_lecturer_verification: {
        Args: {
          p_academic_title: string
          p_avatar_path: string
          p_department: string
          p_faculty: string
          p_full_name: string
          p_id_card_path: string
          p_phone: string
          p_staff_id: string
        }
        Returns: string
      }
      submit_location_suggestion: {
        Args: {
          p_category: Database["public"]["Enums"]["location_category"]
          p_description: string
          p_google_place_id: string
          p_image_path: string
          p_latitude: number
          p_longitude: number
          p_name: string
          p_reason: string
        }
        Returns: string
      }
      submit_rider_application: {
        Args: {
          p_avatar_path: string
          p_full_name: string
          p_id_document_path: string
          p_id_number: string
          p_id_type: string
          p_phone: string
          p_plate_number: string
          p_vehicle_description: string
          p_vehicle_photo_path: string
        }
        Returns: string
      }
      submit_verification: {
        Args: {
          p_avatar_path: string
          p_faculty: string
          p_full_name: string
          p_id_card_path: string
          p_matric: string
        }
        Returns: string
      }
      trip_is_terminal: { Args: { _s: string }; Returns: boolean }
      trip_rider_profile: { Args: { p_trip_id: string }; Returns: Json }
      try_start_trip: {
        Args: { _role: string; _trip: string }
        Returns: boolean
      }
      wallet_post: {
        Args: {
          p_actor: string
          p_actor_role: string
          p_amount: number
          p_balance_delta: number
          p_description: string
          p_funding: string
          p_reserved_delta: number
          p_rider: string
          p_trip: string
          p_type: string
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user" | "student" | "rider" | "lecturer"
      location_category: "GATE" | "ACADEMIC" | "HOSTEL"
      location_suggestion_status: "pending" | "approved" | "rejected"
      ride_request_status: "draft" | "searching" | "cancelled"
      rider_application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "suspended"
      student_verification_status: "pending" | "verified" | "rejected"
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
    Enums: {
      app_role: ["admin", "user", "student", "rider", "lecturer"],
      location_category: ["GATE", "ACADEMIC", "HOSTEL"],
      location_suggestion_status: ["pending", "approved", "rejected"],
      ride_request_status: ["draft", "searching", "cancelled"],
      rider_application_status: [
        "pending",
        "approved",
        "rejected",
        "suspended",
      ],
      student_verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const

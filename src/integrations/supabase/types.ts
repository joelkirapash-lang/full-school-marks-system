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
      activity_log: {
        Row: {
          action: string
          actor_name: string | null
          created_at: string
          details: Json | null
          entity: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_published: boolean
          name: string
          start_date: string | null
          submission_deadline: string | null
          term: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_published?: boolean
          name: string
          start_date?: string | null
          submission_deadline?: string | null
          term?: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_published?: boolean
          name?: string
          start_date?: string | null
          submission_deadline?: string | null
          term?: string
          year?: number
        }
        Relationships: []
      }
      grade_levels: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      grading_bands: {
        Row: {
          id: string
          label: string
          level_code: string
          max_score: number
          min_score: number
          sort_order: number
        }
        Insert: {
          id?: string
          label?: string
          level_code: string
          max_score: number
          min_score: number
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          level_code?: string
          max_score?: number
          min_score?: number
          sort_order?: number
        }
        Relationships: []
      }
      learners: {
        Row: {
          admission_no: string
          assessment_no: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string | null
          grade_level_id: string | null
          guardian_email: string | null
          guardian_name: string | null
          guardian_phone: string | null
          id: string
          is_active: boolean
          photo_url: string | null
          stream_id: string | null
          upi_number: string | null
        }
        Insert: {
          admission_no: string
          assessment_no?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender?: string | null
          grade_level_id?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          stream_id?: string | null
          upi_number?: string | null
        }
        Update: {
          admission_no?: string
          assessment_no?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string | null
          grade_level_id?: string | null
          guardian_email?: string | null
          guardian_name?: string | null
          guardian_phone?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          stream_id?: string | null
          upi_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learners_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          created_at: string
          entered_by: string | null
          exam_id: string
          grade_level_id: string
          id: string
          learner_id: string
          remarks: string | null
          score: number | null
          stream_id: string | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entered_by?: string | null
          exam_id: string
          grade_level_id: string
          id?: string
          learner_id: string
          remarks?: string | null
          score?: number | null
          stream_id?: string | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entered_by?: string | null
          exam_id?: string
          grade_level_id?: string
          id?: string
          learner_id?: string
          remarks?: string | null
          score?: number | null
          stream_id?: string | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      remark_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          text: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          text: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          text?: string
        }
        Relationships: []
      }
      report_card_sends: {
        Row: {
          error: string | null
          exam_id: string
          id: string
          learner_id: string
          recipient: string | null
          sent_at: string
          sent_by: string | null
          status: string
        }
        Insert: {
          error?: string | null
          exam_id: string
          id?: string
          learner_id: string
          recipient?: string | null
          sent_at?: string
          sent_by?: string | null
          status: string
        }
        Update: {
          error?: string | null
          exam_id?: string
          id?: string
          learner_id?: string
          recipient?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_card_sends_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_card_sends_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          address: string | null
          allow_parent_links: boolean
          email: string | null
          id: boolean
          logo_url: string | null
          motto: string | null
          next_term_begins: string | null
          phone: string | null
          report_footer_text: string | null
          school_name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_parent_links?: boolean
          email?: string | null
          id?: boolean
          logo_url?: string | null
          motto?: string | null
          next_term_begins?: string | null
          phone?: string | null
          report_footer_text?: string | null
          school_name?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_parent_links?: boolean
          email?: string | null
          id?: boolean
          logo_url?: string | null
          motto?: string | null
          next_term_begins?: string | null
          phone?: string | null
          report_footer_text?: string | null
          school_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      streams: {
        Row: {
          class_teacher_id: string | null
          created_at: string
          grade_level_id: string
          id: string
          name: string
        }
        Insert: {
          class_teacher_id?: string | null
          created_at?: string
          grade_level_id: string
          id?: string
          name: string
        }
        Update: {
          class_teacher_id?: string | null
          created_at?: string
          grade_level_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "streams_class_teacher_fk"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "streams_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          grade_level_id: string
          id: string
          max_score: number
          name: string
          short_name: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          grade_level_id: string
          id?: string
          max_score?: number
          name: string
          short_name?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          grade_level_id?: string
          id?: string
          max_score?: number
          name?: string
          short_name?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          created_at: string
          grade_level_id: string
          id: string
          stream_id: string | null
          subject_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          grade_level_id: string
          id?: string
          stream_id?: string | null
          subject_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          grade_level_id?: string
          id?: string
          stream_id?: string | null
          subject_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          home_grade_level_id: string | null
          home_stream_id: string | null
          id: string
          is_active: boolean
          phone: string | null
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          home_grade_level_id?: string | null
          home_stream_id?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          home_grade_level_id?: string | null
          home_stream_id?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_home_grade_level_id_fkey"
            columns: ["home_grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_home_stream_id_fkey"
            columns: ["home_stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_marks: {
        Args: {
          _grade_level_id: string
          _stream_id: string
          _subject_id: string
        }
        Returns: boolean
      }
      can_send_report: { Args: { _learner_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "teacher"
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
      app_role: ["admin", "teacher"],
    },
  },
} as const

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      asset_kpis: {
        Row: {
          annual_rent: number | null
          as_of_date: string
          asset_id: string
          id: string
          import_id: string
          ltv: number | null
          market_value: number | null
          occupancy_rate: number | null
          vacant_area_sqm: number | null
          valuation_date: string | null
        }
        Insert: {
          annual_rent?: number | null
          as_of_date: string
          asset_id: string
          id?: string
          import_id: string
          ltv?: number | null
          market_value?: number | null
          occupancy_rate?: number | null
          vacant_area_sqm?: number | null
          valuation_date?: string | null
        }
        Update: {
          annual_rent?: number | null
          as_of_date?: string
          asset_id?: string
          id?: string
          import_id?: string
          ltv?: number | null
          market_value?: number | null
          occupancy_rate?: number | null
          vacant_area_sqm?: number | null
          valuation_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_kpis_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_summary"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "asset_kpis_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_kpis_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          acquisition_date: string | null
          address: string
          asset_type: string
          cadastral_reference: string | null
          city: string
          code: string
          created_at: string
          description: string | null
          id: string
          investor_id: string
          lettable_area_sqm: number
          name: string
          parking_spaces: number | null
          photo_path: string | null
          postal_code: string | null
          strategy: string | null
          units_count: number | null
          updated_at: string
          year_built: number | null
          year_renovated: number | null
        }
        Insert: {
          acquisition_date?: string | null
          address: string
          asset_type: string
          cadastral_reference?: string | null
          city: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          investor_id: string
          lettable_area_sqm: number
          name: string
          parking_spaces?: number | null
          photo_path?: string | null
          postal_code?: string | null
          strategy?: string | null
          units_count?: number | null
          updated_at?: string
          year_built?: number | null
          year_renovated?: number | null
        }
        Update: {
          acquisition_date?: string | null
          address?: string
          asset_type?: string
          cadastral_reference?: string | null
          city?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          investor_id?: string
          lettable_area_sqm?: number
          name?: string
          parking_spaces?: number | null
          photo_path?: string | null
          postal_code?: string | null
          strategy?: string | null
          units_count?: number | null
          updated_at?: string
          year_built?: number | null
          year_renovated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      bp_versions: {
        Row: {
          asset_id: string
          comment: string | null
          id: string
          import_id: string
          initial_yield: number | null
          is_current: boolean
          target_irr: number | null
          version_date: string
          version_label: string
        }
        Insert: {
          asset_id: string
          comment?: string | null
          id?: string
          import_id: string
          initial_yield?: number | null
          is_current?: boolean
          target_irr?: number | null
          version_date: string
          version_label: string
        }
        Update: {
          asset_id?: string
          comment?: string | null
          id?: string
          import_id?: string
          initial_yield?: number | null
          is_current?: boolean
          target_irr?: number | null
          version_date?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_summary"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "bp_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_versions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          asset_id: string
          doc_type: string
          file_path: string
          id: string
          lease_id: string | null
          name: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          asset_id: string
          doc_type: string
          file_path: string
          id?: string
          lease_id?: string | null
          name: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          asset_id?: string
          doc_type?: string
          file_path?: string
          id?: string
          lease_id?: string | null
          name?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_summary"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          as_of_date: string
          file_name: string
          file_path: string | null
          id: string
          imported_at: string
          imported_by: string | null
          investor_id: string
          notes: string | null
          replaced_by: string | null
          status: Database["public"]["Enums"]["import_status"]
          template_version: string
        }
        Insert: {
          as_of_date: string
          file_name: string
          file_path?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          investor_id: string
          notes?: string | null
          replaced_by?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          template_version: string
        }
        Update: {
          as_of_date?: string
          file_name?: string
          file_path?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          investor_id?: string
          notes?: string | null
          replaced_by?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imports_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          code: string
          contact_name: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          contact_name?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          contact_name?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      leases: {
        Row: {
          annual_rent: number
          area_sqm: number | null
          asset_id: string
          bank_guarantee_amount: number | null
          bank_guarantee_expiry: string | null
          break_date: string | null
          end_date: string
          id: string
          import_id: string
          indexation: string | null
          is_active: boolean
          parking_spaces: number | null
          recoverable_charges: number | null
          rent_free_end_date: string | null
          rent_free_months: number | null
          security_deposit: number | null
          start_date: string | null
          tenant_id: string
          unit_id: string
        }
        Insert: {
          annual_rent: number
          area_sqm?: number | null
          asset_id: string
          bank_guarantee_amount?: number | null
          bank_guarantee_expiry?: string | null
          break_date?: string | null
          end_date: string
          id?: string
          import_id: string
          indexation?: string | null
          is_active?: boolean
          parking_spaces?: number | null
          recoverable_charges?: number | null
          rent_free_end_date?: string | null
          rent_free_months?: number | null
          security_deposit?: number | null
          start_date?: string | null
          tenant_id: string
          unit_id: string
        }
        Update: {
          annual_rent?: number
          area_sqm?: number | null
          asset_id?: string
          bank_guarantee_amount?: number | null
          bank_guarantee_expiry?: string | null
          break_date?: string | null
          end_date?: string
          id?: string
          import_id?: string
          indexation?: string | null
          is_active?: boolean
          parking_spaces?: number | null
          recoverable_charges?: number | null
          rent_free_end_date?: string | null
          rent_free_months?: number | null
          security_deposit?: number | null
          start_date?: string | null
          tenant_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_summary"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "leases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amortization_type: string | null
          asset_id: string
          icr: number | null
          icr_covenant: number | null
          id: string
          import_id: string
          interest_rate: number | null
          lender: string
          ltv: number | null
          ltv_covenant: number | null
          margin: number | null
          maturity_date: string | null
          outstanding: number
          rate_type: string | null
          reference_index: string | null
        }
        Insert: {
          amortization_type?: string | null
          asset_id: string
          icr?: number | null
          icr_covenant?: number | null
          id?: string
          import_id: string
          interest_rate?: number | null
          lender: string
          ltv?: number | null
          ltv_covenant?: number | null
          margin?: number | null
          maturity_date?: string | null
          outstanding: number
          rate_type?: string | null
          reference_index?: string | null
        }
        Update: {
          amortization_type?: string | null
          asset_id?: string
          icr?: number | null
          icr_covenant?: number | null
          id?: string
          import_id?: string
          interest_rate?: number | null
          lender?: string
          ltv?: number | null
          ltv_covenant?: number | null
          margin?: number | null
          maturity_date?: string | null
          outstanding?: number
          rate_type?: string | null
          reference_index?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_summary"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "loans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          investor_id: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          investor_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          investor_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          commentary: string | null
          created_at: string
          id: string
          investor_id: string
          pdf_path: string | null
          period_end: string
          period_label: string
          status: Database["public"]["Enums"]["report_status"]
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          commentary?: string | null
          created_at?: string
          id?: string
          investor_id: string
          pdf_path?: string | null
          period_end: string
          period_label: string
          status?: Database["public"]["Enums"]["report_status"]
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          commentary?: string | null
          created_at?: string
          id?: string
          investor_id?: string
          pdf_path?: string | null
          period_end?: string
          period_label?: string
          status?: Database["public"]["Enums"]["report_status"]
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          id: string
          investor_id: string
          name: string
          sector: string | null
          tax_id: string | null
        }
        Insert: {
          id?: string
          investor_id: string
          name: string
          sector?: string | null
          tax_id?: string | null
        }
        Update: {
          id?: string
          investor_id?: string
          name?: string
          sector?: string | null
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          area_sqm: number
          asset_id: string
          floor: string | null
          id: string
          label: string
          use_type: string | null
          vacant_since: string | null
        }
        Insert: {
          area_sqm: number
          asset_id: string
          floor?: string | null
          id?: string
          label: string
          use_type?: string | null
          vacant_since?: string | null
        }
        Update: {
          area_sqm?: number
          asset_id?: string
          floor?: string | null
          id?: string
          label?: string
          use_type?: string | null
          vacant_since?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_summary"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "units_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      asset_current_import: {
        Row: {
          as_of_date: string | null
          asset_id: string | null
          import_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_kpis_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset_summary"
            referencedColumns: ["asset_id"]
          },
          {
            foreignKeyName: "asset_kpis_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_kpis_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_summary: {
        Row: {
          annual_rent: number | null
          as_of_date: string | null
          asset_id: string | null
          city: string | null
          code: string | null
          import_id: string | null
          investor_id: string | null
          lettable_area_sqm: number | null
          ltv: number | null
          market_value: number | null
          name: string | null
          occupancy_rate: number | null
          total_debt: number | null
          vacant_area_sqm: number | null
          valuation_date: string | null
          walb_years: number | null
          walt_years: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_kpis_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_summary: {
        Row: {
          assets_count: number | null
          investor_id: string | null
          latest_data_date: string | null
          occupancy_rate: number | null
          oldest_data_date: string | null
          portfolio_ltv: number | null
          total_annual_rent: number | null
          total_value: number | null
          walb_years: number | null
          walt_years: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      my_investor_id: { Args: never; Returns: string }
    }
    Enums: {
      import_status: "en_attente" | "valide" | "remplace"
      report_status: "brouillon" | "valide" | "envoye"
      user_role: "admin" | "investor"
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
      import_status: ["en_attente", "valide", "remplace"],
      report_status: ["brouillon", "valide", "envoye"],
      user_role: ["admin", "investor"],
    },
  },
} as const

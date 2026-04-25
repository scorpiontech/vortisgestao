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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: string
          owner_id: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          owner_id: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          owner_id?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      barcode_scan_log_settings: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          retention_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          retention_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          retention_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      barcode_scan_logs: {
        Row: {
          code: string
          context: string
          created_at: string
          format: string
          id: string
          matched: boolean
          owner_id: string
          product_id: string | null
          product_name: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          code: string
          context?: string
          created_at?: string
          format?: string
          id?: string
          matched?: boolean
          owner_id: string
          product_id?: string | null
          product_name?: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          code?: string
          context?: string
          created_at?: string
          format?: string
          id?: string
          matched?: boolean
          owner_id?: string
          product_id?: string | null
          product_name?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          paid: boolean
          paid_at: string | null
          payment_method: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          payment_method?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          paid?: boolean
          paid_at?: string | null
          payment_method?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closing_amount: number | null
          created_at: string
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          opening_amount: number
          status: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          closing_amount?: number | null
          created_at?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opening_amount?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          billing_type: string
          blocked: boolean
          blocked_at: string | null
          created_at: string
          due_day: number
          email: string
          id: string
          monthly_value: number
          mp_subscription_id: string | null
          name: string
          plan: string
          plan_id: string | null
          status: string
          tolerance_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_type?: string
          blocked?: boolean
          blocked_at?: string | null
          created_at?: string
          due_day?: number
          email: string
          id?: string
          monthly_value?: number
          mp_subscription_id?: string | null
          name: string
          plan?: string
          plan_id?: string | null
          status?: string
          tolerance_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_type?: string
          blocked?: boolean
          blocked_at?: string | null
          created_at?: string
          due_day?: number
          email?: string
          id?: string
          monthly_value?: number
          mp_subscription_id?: string | null
          name?: string
          plan?: string
          plan_id?: string | null
          status?: string
          tolerance_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          active: boolean
          created_at: string
          email: string
          id: string
          name: string
          owner_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          owner_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          owner_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_registrations: {
        Row: {
          city: string
          complement: string
          created_at: string
          document: string
          id: string
          name: string
          neighborhood: string
          number: string
          person_type: string
          phone: string
          state: string
          state_registration: string
          street: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          city?: string
          complement?: string
          created_at?: string
          document?: string
          id?: string
          name: string
          neighborhood?: string
          number?: string
          person_type?: string
          phone?: string
          state?: string
          state_registration?: string
          street?: string
          updated_at?: string
          user_id: string
          zip_code?: string
        }
        Update: {
          city?: string
          complement?: string
          created_at?: string
          document?: string
          id?: string
          name?: string
          neighborhood?: string
          number?: string
          person_type?: string
          phone?: string
          state?: string
          state_registration?: string
          street?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          city: string
          complement: string
          created_at: string
          document: string
          document_type: string
          email: string
          id: string
          name: string
          neighborhood: string
          number: string
          observation: string
          phone: string
          state: string
          street: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          city?: string
          complement?: string
          created_at?: string
          document?: string
          document_type?: string
          email?: string
          id?: string
          name: string
          neighborhood?: string
          number?: string
          observation?: string
          phone?: string
          state?: string
          street?: string
          updated_at?: string
          user_id: string
          zip_code?: string
        }
        Update: {
          city?: string
          complement?: string
          created_at?: string
          document?: string
          document_type?: string
          email?: string
          id?: string
          name?: string
          neighborhood?: string
          number?: string
          observation?: string
          phone?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          cost: number
          created_at: string
          id: string
          min_stock: number
          name: string
          price: number
          sku: string
          stock: number
          supplier_id: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          cost?: number
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          price?: number
          sku: string
          stock?: number
          supplier_id?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          price?: number
          sku?: string
          stock?: number
          supplier_id?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          customer_name: string | null
          date: string
          discount: number
          id: string
          installments: number
          payment_method: string
          total: number
          user_id: string
        }
        Insert: {
          customer_name?: string | null
          date?: string
          discount?: number
          id?: string
          installments?: number
          payment_method?: string
          total?: number
          user_id: string
        }
        Update: {
          customer_name?: string | null
          date?: string
          discount?: number
          id?: string
          installments?: number
          payment_method?: string
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      service_order_materials: {
        Row: {
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          service_order_id: string
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          service_order_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          service_order_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_materials_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          budget_total: number
          closed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name: string
          id: string
          opened_at: string
          paid: boolean
          paid_at: string | null
          payment_method: string
          problem_description: string
          resolution_description: string
          service_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_total?: number
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          opened_at?: string
          paid?: boolean
          paid_at?: string | null
          payment_method?: string
          problem_description?: string
          resolution_description?: string
          service_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_total?: number
          closed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          opened_at?: string
          paid?: boolean
          paid_at?: string | null
          payment_method?: string
          problem_description?: string
          resolution_description?: string
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount: number
          client_account_id: string
          created_at: string
          due_date: string
          id: string
          mp_payment_id: string | null
          mp_preference_id: string | null
          paid_at: string | null
          payment_link: string | null
          plan_id: string | null
          reference_month: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_account_id: string
          created_at?: string
          due_date: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_link?: string | null
          plan_id?: string | null
          reference_month: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_account_id?: string
          created_at?: string
          due_date?: string
          id?: string
          mp_payment_id?: string | null
          mp_preference_id?: string | null
          paid_at?: string | null
          payment_link?: string | null
          plan_id?: string | null
          reference_month?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_client_account_id_fkey"
            columns: ["client_account_id"]
            isOneToOne: false
            referencedRelation: "client_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          monthly_value: number
          mp_plan_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          monthly_value?: number
          mp_plan_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          monthly_value?: number
          mp_plan_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          city: string
          complement: string
          created_at: string
          email: string
          id: string
          name: string
          neighborhood: string
          number: string
          observation: string
          phone: string
          state: string
          street: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          city?: string
          complement?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          neighborhood?: string
          number?: string
          observation?: string
          phone?: string
          state?: string
          street?: string
          updated_at?: string
          user_id: string
          zip_code?: string
        }
        Update: {
          city?: string
          complement?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          neighborhood?: string
          number?: string
          observation?: string
          phone?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          payment_method: string
          type: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          payment_method?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          payment_method?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          abbreviation: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          abbreviation?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          abbreviation?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
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
      cleanup_old_barcode_scan_logs: { Args: never; Returns: number }
      get_effective_user_id: { Args: { _user_id: string }; Returns: string }
      get_member_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_blocked: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const

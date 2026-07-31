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
      asaas_settings: {
        Row: {
          active: boolean
          ambiente: string
          api_key: string
          boleto_days: number
          created_at: string
          id: string
          owner_id: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          active?: boolean
          ambiente?: string
          api_key?: string
          boleto_days?: number
          created_at?: string
          id?: string
          owner_id: string
          updated_at?: string
          webhook_token?: string
        }
        Update: {
          active?: boolean
          ambiente?: string
          api_key?: string
          boleto_days?: number
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
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
          charge_id: string | null
          created_at: string
          customer_id: string | null
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
          charge_id?: string | null
          created_at?: string
          customer_id?: string | null
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
          charge_id?: string | null
          created_at?: string
          customer_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "bills_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "customer_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      customer_charge_installments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          bank_slip_url: string | null
          barcode: string | null
          bill_id: string | null
          charge_id: string
          created_at: string
          due_date: string
          id: string
          installment_number: number
          invoice_url: string | null
          owner_id: string
          paid_at: string | null
          pix_payload: string | null
          pix_qrcode_image: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          barcode?: string | null
          bill_id?: string | null
          charge_id: string
          created_at?: string
          due_date: string
          id?: string
          installment_number?: number
          invoice_url?: string | null
          owner_id: string
          paid_at?: string | null
          pix_payload?: string | null
          pix_qrcode_image?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          bank_slip_url?: string | null
          barcode?: string | null
          bill_id?: string | null
          charge_id?: string
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          invoice_url?: string | null
          owner_id?: string
          paid_at?: string | null
          pix_payload?: string | null
          pix_qrcode_image?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_charge_installments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_charge_installments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "customer_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_charges: {
        Row: {
          ambiente: string
          asaas_customer_id: string | null
          asaas_installment_id: string | null
          bill_id: string | null
          billing_type: string
          cancelled_at: string | null
          created_at: string
          created_by: string | null
          customer_document: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string
          description: string
          discount: number
          finalized_at: string | null
          id: string
          installment_count: number
          items: Json
          owner_id: string
          paid_at: string | null
          payment_method: string
          provider: string
          sale_id: string | null
          source: string
          source_id: string | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          ambiente?: string
          asaas_customer_id?: string | null
          asaas_installment_id?: string | null
          bill_id?: string | null
          billing_type?: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_document?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          description?: string
          discount?: number
          finalized_at?: string | null
          id?: string
          installment_count?: number
          items?: Json
          owner_id: string
          paid_at?: string | null
          payment_method?: string
          provider?: string
          sale_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          ambiente?: string
          asaas_customer_id?: string | null
          asaas_installment_id?: string | null
          bill_id?: string | null
          billing_type?: string
          cancelled_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_document?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          description?: string
          discount?: number
          finalized_at?: string | null
          id?: string
          installment_count?: number
          items?: Json
          owner_id?: string
          paid_at?: string | null
          payment_method?: string
          provider?: string
          sale_id?: string | null
          source?: string
          source_id?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_charges_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_charges_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_charges_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
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
      fiscal_quota_usage: {
        Row: {
          authorized_count: number
          created_at: string
          id: string
          owner_id: string
          updated_at: string
          year_month: string
        }
        Insert: {
          authorized_count?: number
          created_at?: string
          id?: string
          owner_id: string
          updated_at?: string
          year_month: string
        }
        Update: {
          authorized_count?: number
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
          year_month?: string
        }
        Relationships: []
      }
      fiscal_settings: {
        Row: {
          ambiente: string
          cbs_aliquota: number
          certificate_expires_at: string | null
          certificate_filename: string
          certificate_password_encrypted: string
          certificate_path: string | null
          certificate_subject: string
          certificate_valid: boolean
          cfop_default: string
          cnpj: string
          cofins_aliquota: number | null
          cofins_cst_default: string | null
          created_at: string
          csc_id: string
          csc_token: string
          csosn_default: string
          enviar_email_destinatario_default: boolean
          ibs_aliquota: number
          ibs_cbs_enabled: boolean
          ibs_cst: string
          icms_aliquota: number | null
          icms_modalidade_base_calculo: string | null
          id: string
          ie: string
          informacoes_fisco: string
          owner_id: string
          pis_aliquota: number | null
          pis_cst_default: string | null
          provider: string
          provider_token: string
          proximo_numero_nfce: number
          proximo_numero_nfe: number
          regime_tributario: string
          serie_nfce: string
          serie_nfe: string
          updated_at: string
        }
        Insert: {
          ambiente?: string
          cbs_aliquota?: number
          certificate_expires_at?: string | null
          certificate_filename?: string
          certificate_password_encrypted?: string
          certificate_path?: string | null
          certificate_subject?: string
          certificate_valid?: boolean
          cfop_default?: string
          cnpj?: string
          cofins_aliquota?: number | null
          cofins_cst_default?: string | null
          created_at?: string
          csc_id?: string
          csc_token?: string
          csosn_default?: string
          enviar_email_destinatario_default?: boolean
          ibs_aliquota?: number
          ibs_cbs_enabled?: boolean
          ibs_cst?: string
          icms_aliquota?: number | null
          icms_modalidade_base_calculo?: string | null
          id?: string
          ie?: string
          informacoes_fisco?: string
          owner_id: string
          pis_aliquota?: number | null
          pis_cst_default?: string | null
          provider?: string
          provider_token?: string
          proximo_numero_nfce?: number
          proximo_numero_nfe?: number
          regime_tributario?: string
          serie_nfce?: string
          serie_nfe?: string
          updated_at?: string
        }
        Update: {
          ambiente?: string
          cbs_aliquota?: number
          certificate_expires_at?: string | null
          certificate_filename?: string
          certificate_password_encrypted?: string
          certificate_path?: string | null
          certificate_subject?: string
          certificate_valid?: boolean
          cfop_default?: string
          cnpj?: string
          cofins_aliquota?: number | null
          cofins_cst_default?: string | null
          created_at?: string
          csc_id?: string
          csc_token?: string
          csosn_default?: string
          enviar_email_destinatario_default?: boolean
          ibs_aliquota?: number
          ibs_cbs_enabled?: boolean
          ibs_cst?: string
          icms_aliquota?: number | null
          icms_modalidade_base_calculo?: string | null
          id?: string
          ie?: string
          informacoes_fisco?: string
          owner_id?: string
          pis_aliquota?: number | null
          pis_cst_default?: string | null
          provider?: string
          provider_token?: string
          proximo_numero_nfce?: number
          proximo_numero_nfe?: number
          regime_tributario?: string
          serie_nfce?: string
          serie_nfe?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_generation_logs: {
        Row: {
          acknowledged: boolean
          amount: number
          client_account_id: string | null
          client_name: string
          created_at: string
          error_details: Json | null
          error_message: string
          id: string
          reference_month: string
          source: string
          status: string
        }
        Insert: {
          acknowledged?: boolean
          amount?: number
          client_account_id?: string | null
          client_name?: string
          created_at?: string
          error_details?: Json | null
          error_message?: string
          id?: string
          reference_month?: string
          source?: string
          status?: string
        }
        Update: {
          acknowledged?: boolean
          amount?: number
          client_account_id?: string | null
          client_name?: string
          created_at?: string
          error_details?: Json | null
          error_message?: string
          id?: string
          reference_month?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      nfce_documents: {
        Row: {
          ambiente: string
          cancelled_at: string | null
          chave: string | null
          chave_referencia: string | null
          consumidor_final: string
          created_at: string
          created_by: string | null
          customer_doc: string | null
          customer_name: string | null
          danfce_url: string | null
          data_emissao: string
          data_saida: string | null
          desconto: number
          destinatario: Json | null
          emitted_at: string | null
          enviar_email: boolean
          finalidade: string
          frete_modalidade: string
          id: string
          indicador_presenca: string
          informacoes_complementares: string | null
          informacoes_fisco: string | null
          items: Json
          modelo: string
          motivo_rejeicao: string | null
          movimenta_estoque: boolean
          natureza_operacao: string
          numero: string | null
          outras_despesas: number
          owner_id: string
          payload_request: Json | null
          payload_response: Json | null
          payments: Json
          protocolo: string | null
          provider: string
          provider_ref: string | null
          qrcode_data: string | null
          qrcode_url: string | null
          sale_id: string | null
          separar_iguais: boolean
          serie: string | null
          status: string
          tipo_documento: string
          total_frete: number
          total_pago: number
          total_produtos: number
          troco: number
          updated_at: string
          valor_total: number
          xml_url: string | null
        }
        Insert: {
          ambiente?: string
          cancelled_at?: string | null
          chave?: string | null
          chave_referencia?: string | null
          consumidor_final?: string
          created_at?: string
          created_by?: string | null
          customer_doc?: string | null
          customer_name?: string | null
          danfce_url?: string | null
          data_emissao?: string
          data_saida?: string | null
          desconto?: number
          destinatario?: Json | null
          emitted_at?: string | null
          enviar_email?: boolean
          finalidade?: string
          frete_modalidade?: string
          id?: string
          indicador_presenca?: string
          informacoes_complementares?: string | null
          informacoes_fisco?: string | null
          items?: Json
          modelo?: string
          motivo_rejeicao?: string | null
          movimenta_estoque?: boolean
          natureza_operacao?: string
          numero?: string | null
          outras_despesas?: number
          owner_id: string
          payload_request?: Json | null
          payload_response?: Json | null
          payments?: Json
          protocolo?: string | null
          provider: string
          provider_ref?: string | null
          qrcode_data?: string | null
          qrcode_url?: string | null
          sale_id?: string | null
          separar_iguais?: boolean
          serie?: string | null
          status?: string
          tipo_documento?: string
          total_frete?: number
          total_pago?: number
          total_produtos?: number
          troco?: number
          updated_at?: string
          valor_total?: number
          xml_url?: string | null
        }
        Update: {
          ambiente?: string
          cancelled_at?: string | null
          chave?: string | null
          chave_referencia?: string | null
          consumidor_final?: string
          created_at?: string
          created_by?: string | null
          customer_doc?: string | null
          customer_name?: string | null
          danfce_url?: string | null
          data_emissao?: string
          data_saida?: string | null
          desconto?: number
          destinatario?: Json | null
          emitted_at?: string | null
          enviar_email?: boolean
          finalidade?: string
          frete_modalidade?: string
          id?: string
          indicador_presenca?: string
          informacoes_complementares?: string | null
          informacoes_fisco?: string | null
          items?: Json
          modelo?: string
          motivo_rejeicao?: string | null
          movimenta_estoque?: boolean
          natureza_operacao?: string
          numero?: string | null
          outras_despesas?: number
          owner_id?: string
          payload_request?: Json | null
          payload_response?: Json | null
          payments?: Json
          protocolo?: string | null
          provider?: string
          provider_ref?: string | null
          qrcode_data?: string | null
          qrcode_url?: string | null
          sale_id?: string | null
          separar_iguais?: boolean
          serie?: string | null
          status?: string
          tipo_documento?: string
          total_frete?: number
          total_pago?: number
          total_produtos?: number
          troco?: number
          updated_at?: string
          valor_total?: number
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfce_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          cost: number
          created_at: string
          id: string
          min_stock: number
          name: string
          ncm: string | null
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
          ncm?: string | null
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
          ncm?: string | null
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
      quote_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          quote_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          quote_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          quote_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          converted_sale_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          discount: number
          id: string
          installments: number
          negotiation_log: Json
          notes: string | null
          payment_method: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          converted_sale_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          installments?: number
          negotiation_log?: Json
          notes?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          converted_sale_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          discount?: number
          id?: string
          installments?: number
          negotiation_log?: Json
          notes?: string | null
          payment_method?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
          discount: number
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
          discount?: number
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
          discount?: number
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string
          product_id: string
          quantity: number
          reason: string
          reference: string
          type: string
          unit_cost: number
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          product_id: string
          quantity: number
          reason?: string
          reference?: string
          type: string
          unit_cost?: number
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          product_id?: string
          quantity?: number
          reason?: string
          reference?: string
          type?: string
          unit_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          metadata: Json
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
          metadata?: Json
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
          metadata?: Json
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
          features: Json
          id: string
          monthly_value: number
          mp_plan_id: string | null
          name: string
          nfe_quota: number | null
          tier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          features?: Json
          id?: string
          monthly_value?: number
          mp_plan_id?: string | null
          name: string
          nfe_quota?: number | null
          tier?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          features?: Json
          id?: string
          monthly_value?: number
          mp_plan_id?: string | null
          name?: string
          nfe_quota?: number | null
          tier?: string
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
      can_emit_nfce: { Args: { _owner_id: string }; Returns: boolean }
      check_nfce_quota: { Args: { _owner_id: string }; Returns: Json }
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
      quote_status:
        | "rascunho"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "expirado"
        | "convertido"
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
      quote_status: [
        "rascunho",
        "enviado",
        "aprovado",
        "recusado",
        "expirado",
        "convertido",
      ],
    },
  },
} as const

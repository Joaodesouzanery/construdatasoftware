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
      alertas_config: {
        Row: {
          ativo: boolean | null
          condicao: Json
          created_at: string | null
          destinatarios: string[]
          id: string
          obra_id: string | null
          tipo_alerta: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          condicao: Json
          created_at?: string | null
          destinatarios: string[]
          id?: string
          obra_id?: string | null
          tipo_alerta: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          condicao?: Json
          created_at?: string | null
          destinatarios?: string[]
          id?: string
          obra_id?: string | null
          tipo_alerta?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_config_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_historico: {
        Row: {
          alerta_config_id: string
          enviado_em: string | null
          id: string
          justificado_em: string | null
          justificado_por_user_id: string | null
          justificativa: string | null
          mensagem: string
          obra_id: string
        }
        Insert: {
          alerta_config_id: string
          enviado_em?: string | null
          id?: string
          justificado_em?: string | null
          justificado_por_user_id?: string | null
          justificativa?: string | null
          mensagem: string
          obra_id: string
        }
        Update: {
          alerta_config_id?: string
          enviado_em?: string | null
          id?: string
          justificado_em?: string | null
          justificado_por_user_id?: string | null
          justificativa?: string | null
          mensagem?: string
          obra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_historico_alerta_config_id_fkey"
            columns: ["alerta_config_id"]
            isOneToOne: false
            referencedRelation: "alertas_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_historico_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      assets_catalog: {
        Row: {
          coordinates: string | null
          created_at: string | null
          created_by_user_id: string
          detailed_location: string | null
          floor: string | null
          id: string
          main_responsible: string | null
          name: string
          project_id: string | null
          sector: string | null
          technical_notes: string | null
          tower: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          coordinates?: string | null
          created_at?: string | null
          created_by_user_id: string
          detailed_location?: string | null
          floor?: string | null
          id?: string
          main_responsible?: string | null
          name: string
          project_id?: string | null
          sector?: string | null
          technical_notes?: string | null
          tower?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          coordinates?: string | null
          created_at?: string | null
          created_by_user_id?: string
          detailed_location?: string | null
          floor?: string | null
          id?: string
          main_responsible?: string | null
          name?: string
          project_id?: string | null
          sector?: string | null
          technical_notes?: string | null
          tower?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_catalog_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      backups: {
        Row: {
          backup_type: string
          created_at: string | null
          file_path: string | null
          file_size: number | null
          id: string
          metadata: Json | null
          project_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          backup_type: string
          created_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          backup_type?: string
          created_at?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          metadata?: Json | null
          project_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "backups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          bdi_percentage: number | null
          budget_id: string
          created_at: string | null
          description: string
          id: string
          item_number: number
          material_id: string | null
          price_at_creation: number | null
          quantity: number
          subtotal_bdi: number | null
          subtotal_labor: number | null
          subtotal_material: number | null
          total: number | null
          unit: string
          unit_price_labor: number | null
          unit_price_material: number | null
        }
        Insert: {
          bdi_percentage?: number | null
          budget_id: string
          created_at?: string | null
          description: string
          id?: string
          item_number: number
          material_id?: string | null
          price_at_creation?: number | null
          quantity: number
          subtotal_bdi?: number | null
          subtotal_labor?: number | null
          subtotal_material?: number | null
          total?: number | null
          unit: string
          unit_price_labor?: number | null
          unit_price_material?: number | null
        }
        Update: {
          bdi_percentage?: number | null
          budget_id?: string
          created_at?: string | null
          description?: string
          id?: string
          item_number?: number
          material_id?: string | null
          price_at_creation?: number | null
          quantity?: number
          subtotal_bdi?: number | null
          subtotal_labor?: number | null
          subtotal_material?: number | null
          total?: number | null
          unit?: string
          unit_price_labor?: number | null
          unit_price_material?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_number: string | null
          client_contact: string | null
          client_name: string | null
          created_at: string | null
          created_by_user_id: string
          description: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          status: string
          total_amount: number | null
          total_bdi: number | null
          total_labor: number | null
          total_material: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          budget_number?: string | null
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by_user_id: string
          description?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          total_amount?: number | null
          total_bdi?: number | null
          total_labor?: number | null
          total_material?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          budget_number?: string | null
          client_contact?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by_user_id?: string
          description?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string
          total_amount?: number | null
          total_bdi?: number | null
          total_labor?: number | null
          total_material?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      connection_reports: {
        Row: {
          address: string
          address_complement: string | null
          client_name: string
          created_at: string | null
          created_by_user_id: string
          id: string
          logo_url: string | null
          observations: string | null
          os_number: string
          photos_urls: string[] | null
          project_id: string | null
          report_date: string
          service_type: string
          team_name: string
          updated_at: string | null
          water_meter_number: string
        }
        Insert: {
          address: string
          address_complement?: string | null
          client_name: string
          created_at?: string | null
          created_by_user_id: string
          id?: string
          logo_url?: string | null
          observations?: string | null
          os_number: string
          photos_urls?: string[] | null
          project_id?: string | null
          report_date?: string
          service_type: string
          team_name: string
          updated_at?: string | null
          water_meter_number: string
        }
        Update: {
          address?: string
          address_complement?: string | null
          client_name?: string
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          logo_url?: string | null
          observations?: string | null
          os_number?: string
          photos_urls?: string[] | null
          project_id?: string | null
          report_date?: string
          service_type?: string
          team_name?: string
          updated_at?: string | null
          water_meter_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      construction_sites: {
        Row: {
          address: string | null
          created_at: string | null
          created_by_user_id: string
          id: string
          name: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by_user_id: string
          id?: string
          name: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "construction_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_readings: {
        Row: {
          created_at: string | null
          id: string
          location: string | null
          meter_type: string
          meter_value: number
          notes: string | null
          project_id: string
          reading_date: string
          reading_time: string
          recorded_by_user_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location?: string | null
          meter_type?: string
          meter_value: number
          notes?: string | null
          project_id: string
          reading_date?: string
          reading_time: string
          recorded_by_user_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: string | null
          meter_type?: string
          meter_value?: number
          notes?: string | null
          project_id?: string
          reading_date?: string
          reading_time?: string
          recorded_by_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumption_readings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_keywords: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          keyword_type: string
          keyword_value: string
          synonyms: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          keyword_type: string
          keyword_value: string
          synonyms?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          keyword_type?: string
          keyword_value?: string
          synonyms?: string[] | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          construction_site_id: string
          created_at: string | null
          executed_by_user_id: string
          general_observations: string | null
          gps_location: string | null
          humidity: number | null
          id: string
          project_id: string
          report_date: string
          service_front_id: string
          temperature: number | null
          terrain_condition: string | null
          updated_at: string | null
          weather_description: string | null
          will_rain: boolean | null
          wind_speed: number | null
        }
        Insert: {
          construction_site_id: string
          created_at?: string | null
          executed_by_user_id: string
          general_observations?: string | null
          gps_location?: string | null
          humidity?: number | null
          id?: string
          project_id: string
          report_date?: string
          service_front_id: string
          temperature?: number | null
          terrain_condition?: string | null
          updated_at?: string | null
          weather_description?: string | null
          will_rain?: boolean | null
          wind_speed?: number | null
        }
        Update: {
          construction_site_id?: string
          created_at?: string | null
          executed_by_user_id?: string
          general_observations?: string | null
          gps_location?: string | null
          humidity?: number | null
          id?: string
          project_id?: string
          report_date?: string
          service_front_id?: string
          temperature?: number | null
          terrain_condition?: string | null
          updated_at?: string | null
          weather_description?: string | null
          will_rain?: boolean | null
          wind_speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_name: string | null
          construction_site_id: string | null
          created_at: string | null
          created_by_user_id: string
          department: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          project_id: string | null
          role: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          construction_site_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          department?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          project_id?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          construction_site_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          department?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          project_id?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_construction_site_id_fkey"
            columns: ["construction_site_id"]
            isOneToOne: false
            referencedRelation: "construction_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      executed_services: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          daily_report_id: string
          employee_id: string | null
          equipment_used: Json | null
          id: string
          quantity: number
          service_id: string
          unit: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          daily_report_id: string
          employee_id?: string | null
          equipment_used?: Json | null
          id?: string
          quantity: number
          service_id: string
          unit: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          daily_report_id?: string
          employee_id?: string | null
          equipment_used?: Json | null
          id?: string
          quantity?: number
          service_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "executed_services_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_services_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_modelos: {
        Row: {
          campos: Json
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tipo_obra: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          campos: Json
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo_obra?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          campos?: Json
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo_obra?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      formularios_producao: {
        Row: {
          created_at: string | null
          data_registro: string
          equipe_nome: string | null
          fotos_urls: string[] | null
          frente_servico: string
          id: string
          localizacao_gps: string | null
          modelo_id: string | null
          obra_id: string
          observacoes: string | null
          responsavel_nome: string | null
          respostas: Json
          updated_at: string | null
          videos_urls: string[] | null
        }
        Insert: {
          created_at?: string | null
          data_registro?: string
          equipe_nome?: string | null
          fotos_urls?: string[] | null
          frente_servico: string
          id?: string
          localizacao_gps?: string | null
          modelo_id?: string | null
          obra_id: string
          observacoes?: string | null
          responsavel_nome?: string | null
          respostas: Json
          updated_at?: string | null
          videos_urls?: string[] | null
        }
        Update: {
          created_at?: string | null
          data_registro?: string
          equipe_nome?: string | null
          fotos_urls?: string[] | null
          frente_servico?: string
          id?: string
          localizacao_gps?: string | null
          modelo_id?: string | null
          obra_id?: string
          observacoes?: string | null
          responsavel_nome?: string | null
          respostas?: Json
          updated_at?: string | null
          videos_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "formularios_producao_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "formulario_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_producao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          category: string | null
          created_at: string | null
          created_by_user_id: string
          id: string
          location: string | null
          material_code: string | null
          material_name: string
          minimum_stock: number | null
          notes: string | null
          project_id: string | null
          quantity_available: number
          supplier: string | null
          unit: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by_user_id: string
          id?: string
          location?: string | null
          material_code?: string | null
          material_name: string
          minimum_stock?: number | null
          notes?: string | null
          project_id?: string | null
          quantity_available?: number
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          location?: string | null
          material_code?: string | null
          material_name?: string
          minimum_stock?: number | null
          notes?: string | null
          project_id?: string | null
          quantity_available?: number
          supplier?: string | null
          unit?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_project"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          inventory_id: string
          movement_type: string
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          inventory_id: string
          movement_type: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          inventory_id?: string
          movement_type?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      justifications: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          daily_report_id: string
          executed_service_id: string | null
          id: string
          reason: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          daily_report_id: string
          executed_service_id?: string | null
          id?: string
          reason: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          daily_report_id?: string
          executed_service_id?: string | null
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "justifications_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "justifications_executed_service_id_fkey"
            columns: ["executed_service_id"]
            isOneToOne: false
            referencedRelation: "executed_services"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_qr_codes: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          is_active: boolean | null
          location_description: string | null
          location_name: string
          project_id: string
          qr_code_data: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          is_active?: boolean | null
          location_description?: string | null
          location_name: string
          project_id: string
          qr_code_data: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          is_active?: boolean | null
          location_description?: string | null
          location_name?: string
          project_id?: string
          qr_code_data?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_qr_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          created_at: string | null
          id: string
          issue_description: string
          photos_urls: string[] | null
          qr_code_id: string
          requester_contact: string | null
          requester_name: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string
          updated_at: string | null
          urgency_level: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          issue_description: string
          photos_urls?: string[] | null
          qr_code_id: string
          requester_contact?: string | null
          requester_name: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          updated_at?: string | null
          urgency_level?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          issue_description?: string
          photos_urls?: string[] | null
          qr_code_id?: string
          requester_contact?: string | null
          requester_name?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string
          updated_at?: string | null
          urgency_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_qr_code_id_fkey"
            columns: ["qr_code_id"]
            isOneToOne: false
            referencedRelation: "maintenance_qr_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_tasks: {
        Row: {
          asset_id: string | null
          assigned_to_employee_id: string | null
          assigned_to_user_id: string | null
          classification: string | null
          completed_at: string | null
          completion_notes: string | null
          created_at: string | null
          created_by_user_id: string
          deadline: string | null
          description: string | null
          id: string
          materials_used: Json | null
          pending_reason: string | null
          priority: string | null
          project_id: string | null
          service_subtype: string | null
          service_type: string | null
          status: string
          task_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_user_id?: string | null
          classification?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          created_by_user_id: string
          deadline?: string | null
          description?: string | null
          id?: string
          materials_used?: Json | null
          pending_reason?: string | null
          priority?: string | null
          project_id?: string | null
          service_subtype?: string | null
          service_type?: string | null
          status?: string
          task_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_user_id?: string | null
          classification?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string | null
          created_by_user_id?: string
          deadline?: string | null
          description?: string | null
          id?: string
          materials_used?: Json | null
          pending_reason?: string | null
          priority?: string | null
          project_id?: string | null
          service_subtype?: string | null
          service_type?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      material_control: {
        Row: {
          created_at: string | null
          id: string
          material_name: string
          project_id: string
          quantity_used: number
          recorded_by_user_id: string
          service_front_id: string
          unit: string
          updated_at: string | null
          usage_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_name: string
          project_id: string
          quantity_used: number
          recorded_by_user_id: string
          service_front_id: string
          unit: string
          updated_at?: string | null
          usage_date?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          material_name?: string
          project_id?: string
          quantity_used?: number
          recorded_by_user_id?: string
          service_front_id?: string
          unit?: string
          updated_at?: string | null
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_control_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_control_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          created_at: string | null
          id: string
          material_name: string
          needed_date: string | null
          project_id: string
          quantity: number
          request_date: string
          requested_by_employee_id: string | null
          requested_by_user_id: string
          requestor_name: string | null
          service_front_id: string
          status: string
          unit: string
          updated_at: string | null
          usage_location: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          material_name: string
          needed_date?: string | null
          project_id: string
          quantity: number
          request_date?: string
          requested_by_employee_id?: string | null
          requested_by_user_id: string
          requestor_name?: string | null
          service_front_id: string
          status?: string
          unit: string
          updated_at?: string | null
          usage_location?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          material_name?: string
          needed_date?: string | null
          project_id?: string
          quantity?: number
          request_date?: string
          requested_by_employee_id?: string | null
          requested_by_user_id?: string
          requestor_name?: string | null
          service_front_id?: string
          status?: string
          unit?: string
          updated_at?: string | null
          usage_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_requested_by_employee_id_fkey"
            columns: ["requested_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          brand: string | null
          category: string | null
          color: string | null
          created_at: string | null
          created_by_user_id: string
          current_price: number
          current_stock: number | null
          description: string | null
          id: string
          keywords: string[] | null
          measurement: string | null
          minimum_stock: number | null
          name: string
          notes: string | null
          supplier: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by_user_id: string
          current_price?: number
          current_stock?: number | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          measurement?: string | null
          minimum_stock?: number | null
          name: string
          notes?: string | null
          supplier?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          created_by_user_id?: string
          current_price?: number
          current_stock?: number | null
          description?: string | null
          id?: string
          keywords?: string[] | null
          measurement?: string | null
          minimum_stock?: number | null
          name?: string
          notes?: string | null
          supplier?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      metas_producao: {
        Row: {
          created_at: string | null
          frente_servico: string
          id: string
          meta_diaria: number | null
          obra_id: string
          periodo_fim: string | null
          periodo_inicio: string
          unidade: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frente_servico: string
          id?: string
          meta_diaria?: number | null
          obra_id: string
          periodo_fim?: string | null
          periodo_inicio: string
          unidade: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frente_servico?: string
          id?: string
          meta_diaria?: number | null
          obra_id?: string
          periodo_fim?: string | null
          periodo_inicio?: string
          unidade?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_producao_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          created_at: string | null
          data_inicio: string
          data_prevista_fim: string | null
          id: string
          latitude: number | null
          localizacao: string
          longitude: number | null
          nome: string
          status: string | null
          tipo_obra: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_inicio: string
          data_prevista_fim?: string | null
          id?: string
          latitude?: number | null
          localizacao: string
          longitude?: number | null
          nome: string
          status?: string | null
          tipo_obra: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_inicio?: string
          data_prevista_fim?: string | null
          id?: string
          latitude?: number | null
          localizacao?: string
          longitude?: number | null
          nome?: string
          status?: string | null
          tipo_obra?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          changed_at: string | null
          changed_by_user_id: string
          id: string
          material_id: string
          new_price: number
          notes: string | null
          old_price: number
        }
        Insert: {
          changed_at?: string | null
          changed_by_user_id: string
          id?: string
          material_id: string
          new_price: number
          notes?: string | null
          old_price: number
        }
        Update: {
          changed_at?: string | null
          changed_by_user_id?: string
          id?: string
          material_id?: string
          new_price?: number
          notes?: string | null
          old_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      production_targets: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          employee_id: string | null
          id: string
          service_front_id: string
          service_id: string
          target_date: string
          target_quantity: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          employee_id?: string | null
          id?: string
          service_front_id: string
          service_id: string
          target_date: string
          target_quantity: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          employee_id?: string | null
          id?: string
          service_front_id?: string
          service_id?: string
          target_date?: string
          target_quantity?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_targets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_targets_service_front_id_fkey"
            columns: ["service_front_id"]
            isOneToOne: false
            referencedRelation: "service_fronts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_targets_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string | null
          created_by_user_id: string
          end_date: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          start_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by_user_id: string
          end_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          start_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by_user_id?: string
          end_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          start_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rdo_validation_photos: {
        Row: {
          created_by_user_id: string
          daily_report_id: string
          id: string
          photo_url: string
          uploaded_at: string | null
        }
        Insert: {
          created_by_user_id: string
          daily_report_id: string
          id?: string
          photo_url: string
          uploaded_at?: string | null
        }
        Update: {
          created_by_user_id?: string
          daily_report_id?: string
          id?: string
          photo_url?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdo_validation_photos_daily_report_id_fkey"
            columns: ["daily_report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      rdos: {
        Row: {
          clima_previsao_chuva: boolean | null
          clima_temperatura: number | null
          clima_umidade: number | null
          clima_vento_velocidade: number | null
          condicao_terreno: string | null
          created_at: string | null
          data: string
          fotos_validacao: string[] | null
          id: string
          localizacao_validada: string | null
          obra_id: string
          observacoes_gerais: string | null
          producao_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          clima_previsao_chuva?: boolean | null
          clima_temperatura?: number | null
          clima_umidade?: number | null
          clima_vento_velocidade?: number | null
          condicao_terreno?: string | null
          created_at?: string | null
          data?: string
          fotos_validacao?: string[] | null
          id?: string
          localizacao_validada?: string | null
          obra_id: string
          observacoes_gerais?: string | null
          producao_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          clima_previsao_chuva?: boolean | null
          clima_temperatura?: number | null
          clima_umidade?: number | null
          clima_vento_velocidade?: number | null
          condicao_terreno?: string | null
          created_at?: string | null
          data?: string
          fotos_validacao?: string[] | null
          id?: string
          localizacao_validada?: string | null
          obra_id?: string
          observacoes_gerais?: string | null
          producao_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rdos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      service_fronts: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          description: string | null
          id: string
          name: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_fronts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      services_catalog: {
        Row: {
          created_at: string | null
          created_by_user_id: string
          id: string
          name: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id: string
          id?: string
          name: string
          unit: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string
          id?: string
          name?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string | null
          description: string
          id: string
          is_completed: boolean | null
          notes: string | null
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          task_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_completed?: boolean | null
          notes?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_photos: {
        Row: {
          description: string | null
          id: string
          photo_url: string
          task_id: string
          uploaded_at: string | null
          uploaded_by_user_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          photo_url: string
          task_id: string
          uploaded_at?: string | null
          uploaded_by_user_id: string
        }
        Update: {
          description?: string | null
          id?: string
          photo_url?: string
          task_id?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_photos_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "maintenance_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          project_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _project_id?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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

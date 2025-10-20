import type { Database } from "@/integrations/supabase/types";

export type Tables<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Update'];

// Explicit type exports for all tables
export type Obra = Tables<'obras'>;
export type AlertaConfig = Tables<'alertas_config'>;
export type AlertaHistorico = Tables<'alertas_historico'>;
export type FormularioModelo = Tables<'formulario_modelos'>;
export type FormularioProducao = Tables<'formularios_producao'>;
export type MetaProducao = Tables<'metas_producao'>;
export type RDO = Tables<'rdos'>;

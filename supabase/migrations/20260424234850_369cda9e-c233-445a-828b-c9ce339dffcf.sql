
-- ============ Tabela RDO Sabesp ============
CREATE TABLE public.rdo_sabesp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,

  report_date DATE NOT NULL,
  encarregado TEXT,
  rua_beco TEXT,
  criadouro TEXT, -- 'sao_manoel' | 'morro_do_teteu' | 'joao_carlos' | 'pantanal_baixo' | 'vila_israel' | outro
  criadouro_outro TEXT,

  epi_utilizado BOOLEAN DEFAULT true,

  -- Condições climáticas (objeto com manha/tarde/noite => { tempo: 'bom'|'chuva'|'improdutivo' })
  condicoes_climaticas JSONB DEFAULT '{}'::jsonb,

  -- Qualidade { ordem_servico: bool, bandeirola: bool, projeto: bool, obs: text }
  qualidade JSONB DEFAULT '{}'::jsonb,

  -- Paralisações [{ motivo: text, descricao: text }]
  paralisacoes JSONB DEFAULT '[]'::jsonb,

  -- Horários { diurno: { inicio, fim }, noturno: { inicio, fim } }
  horarios JSONB DEFAULT '{}'::jsonb,

  -- Mão de obra: array de { cargo, terc, contrat }
  mao_de_obra JSONB DEFAULT '[]'::jsonb,

  -- Equipamentos / veículos: array de { descricao, terc, contrat }
  equipamentos JSONB DEFAULT '[]'::jsonb,

  -- Serviços executados de Esgoto: array de { codigo, descricao, unidade, quantidade, opcoes }
  servicos_esgoto JSONB DEFAULT '[]'::jsonb,

  -- Serviços executados de Água
  servicos_agua JSONB DEFAULT '[]'::jsonb,

  observacoes TEXT,

  -- Anexos / origem
  planilha_foto_url TEXT,
  whatsapp_text TEXT,

  responsavel_empreiteira TEXT,
  responsavel_consorcio TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rdo_sabesp_project ON public.rdo_sabesp(project_id);
CREATE INDEX idx_rdo_sabesp_date ON public.rdo_sabesp(report_date);

ALTER TABLE public.rdo_sabesp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with project access can view rdo_sabesp"
  ON public.rdo_sabesp FOR SELECT
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Users with project access can insert rdo_sabesp"
  ON public.rdo_sabesp FOR INSERT
  WITH CHECK (public.has_project_access(auth.uid(), project_id) AND auth.uid() = created_by_user_id);

CREATE POLICY "Users with project access can update rdo_sabesp"
  ON public.rdo_sabesp FOR UPDATE
  USING (public.has_project_access(auth.uid(), project_id));

CREATE POLICY "Users with project access can delete rdo_sabesp"
  ON public.rdo_sabesp FOR DELETE
  USING (public.has_project_access(auth.uid(), project_id));

CREATE TRIGGER update_rdo_sabesp_updated_at
  BEFORE UPDATE ON public.rdo_sabesp
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Storage bucket para fotos da planilha ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('rdo-sabesp-photos', 'rdo-sabesp-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can view rdo sabesp photos in their projects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND EXISTS (
      SELECT 1 FROM public.rdo_sabesp r
      WHERE r.planilha_foto_url LIKE '%' || name || '%'
      AND public.has_project_access(auth.uid(), r.project_id)
    )
  );

CREATE POLICY "Users can upload rdo sabesp photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rdo-sabesp-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete rdo sabesp photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND auth.uid() IS NOT NULL
  );

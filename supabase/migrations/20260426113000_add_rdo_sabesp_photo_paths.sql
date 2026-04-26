ALTER TABLE public.rdo_sabesp
ADD COLUMN IF NOT EXISTS photo_paths JSONB NOT NULL DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "Users can view rdo sabesp photos in their projects" ON storage.objects;

CREATE POLICY "Users can view rdo sabesp photos in their projects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND EXISTS (
      SELECT 1
      FROM public.rdo_sabesp r
      WHERE (
          auth.uid() = r.created_by_user_id
          OR (r.project_id IS NOT NULL AND public.has_project_access(auth.uid(), r.project_id))
        )
        AND (
          r.planilha_foto_url LIKE '%' || name || '%'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(r.photo_paths, '[]'::jsonb)) AS photo(path)
            WHERE photo.path = name
          )
        )
    )
  );

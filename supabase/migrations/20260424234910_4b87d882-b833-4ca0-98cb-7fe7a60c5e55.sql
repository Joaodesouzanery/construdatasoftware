
DROP POLICY IF EXISTS "Users can upload rdo sabesp photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete rdo sabesp photos" ON storage.objects;

CREATE POLICY "Project members can upload rdo sabesp photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rdo-sabesp-photos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE public.has_project_access(auth.uid(), p.id)
      LIMIT 1
    )
  );

CREATE POLICY "Project members can delete rdo sabesp photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'rdo-sabesp-photos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE public.has_project_access(auth.uid(), p.id)
      LIMIT 1
    )
  );

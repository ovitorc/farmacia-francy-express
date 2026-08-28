CREATE TABLE public.sync_codigos (
  codigo_barras text PRIMARY KEY,
  codigo_novo text NOT NULL
);
GRANT ALL ON public.sync_codigos TO service_role;
ALTER TABLE public.sync_codigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia sync_codigos" ON public.sync_codigos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
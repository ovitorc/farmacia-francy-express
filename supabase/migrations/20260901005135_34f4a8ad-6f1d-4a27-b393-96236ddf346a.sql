
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS image_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS image_source text,
  ADD COLUMN IF NOT EXISTS image_source_url text,
  ADD COLUMN IF NOT EXISTS image_confidence integer,
  ADD COLUMN IF NOT EXISTS image_last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS image_hash text,
  ADD COLUMN IF NOT EXISTS image_width integer,
  ADD COLUMN IF NOT EXISTS image_height integer,
  ADD COLUMN IF NOT EXISTS image_format text,
  ADD COLUMN IF NOT EXISTS image_error text,
  ADD COLUMN IF NOT EXISTS image_candidato_url text,
  ADD COLUMN IF NOT EXISTS image_license text;

UPDATE public.produtos SET image_status = 'approved', image_source = COALESCE(image_source,'manual')
  WHERE imagem IS NOT NULL AND imagem <> '' AND image_status = 'pending';

CREATE INDEX IF NOT EXISTS produtos_image_status_idx ON public.produtos (image_status);
CREATE INDEX IF NOT EXISTS produtos_sem_imagem_idx ON public.produtos (image_last_synced_at NULLS FIRST) WHERE imagem IS NULL OR imagem = '';

CREATE TABLE IF NOT EXISTS public.imagem_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  ean text,
  status text NOT NULL,
  source text,
  image_url text,
  confidence integer,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS imagem_sync_logs_produto_idx ON public.imagem_sync_logs (produto_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS imagem_sync_logs_data_idx ON public.imagem_sync_logs (finished_at DESC);

GRANT SELECT ON public.imagem_sync_logs TO authenticated;
GRANT ALL ON public.imagem_sync_logs TO service_role;

ALTER TABLE public.imagem_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin le logs de imagens" ON public.imagem_sync_logs;
CREATE POLICY "Admin le logs de imagens" ON public.imagem_sync_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

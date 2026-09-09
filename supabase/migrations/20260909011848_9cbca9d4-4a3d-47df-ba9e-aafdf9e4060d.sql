CREATE TABLE public.image_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'personalizada',
  ativo boolean NOT NULL DEFAULT true,
  prioridade integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_sources TO authenticated;
GRANT ALL ON public.image_sources TO service_role;

ALTER TABLE public.image_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia fontes de imagens" ON public.image_sources
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER image_sources_set_updated_at
  BEFORE UPDATE ON public.image_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.image_sources (nome, url, tipo, ativo, prioridade) VALUES
  ('Pague Menos', 'https://www.paguemenos.com.br', 'padrao', true, 1),
  ('Farmácia Permanente', 'https://www.farmaciapermanente.com.br', 'padrao', true, 2),
  ('Droga Raia', 'https://www.drogaraia.com.br', 'padrao', true, 3);

CREATE TABLE public.produto_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'automatica',
  source_name text,
  source_url text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX produto_imagens_produto_id_idx ON public.produto_imagens (produto_id);

GRANT SELECT ON public.produto_imagens TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_imagens TO authenticated;
GRANT ALL ON public.produto_imagens TO service_role;

ALTER TABLE public.produto_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Imagens de produtos sao publicas" ON public.produto_imagens
  FOR SELECT USING (true);

CREATE POLICY "Admin gerencia imagens de produtos" ON public.produto_imagens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
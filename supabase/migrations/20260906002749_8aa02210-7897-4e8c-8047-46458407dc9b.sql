CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.configuracoes TO anon;
GRANT SELECT ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Configuracoes sao publicas" ON public.configuracoes;
CREATE POLICY "Configuracoes sao publicas" ON public.configuracoes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admin gerencia configuracoes" ON public.configuracoes;
CREATE POLICY "Admin gerencia configuracoes" ON public.configuracoes FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

GRANT INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;

DROP TRIGGER IF EXISTS configuracoes_set_updated_at ON public.configuracoes;
CREATE TRIGGER configuracoes_set_updated_at BEFORE UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.configuracoes (chave, valor) VALUES ('intervalo_absorventes_dias', '56')
ON CONFLICT (chave) DO NOTHING;
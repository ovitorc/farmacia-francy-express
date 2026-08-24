ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS codigo_barras text,
  ADD COLUMN IF NOT EXISTS fabricante text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unidade text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estoque integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS principio_ativo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS registro_ms text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS farmacia_popular boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preco_farmacia_popular numeric;

CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_barras_key ON public.produtos (codigo_barras) WHERE codigo_barras IS NOT NULL AND codigo_barras <> '';
CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_key ON public.produtos (codigo);
CREATE INDEX IF NOT EXISTS produtos_categoria_idx ON public.produtos (categoria_slug, ordem);
CREATE INDEX IF NOT EXISTS produtos_subcategoria_idx ON public.produtos (categoria_slug, subcategoria_slug);
CREATE INDEX IF NOT EXISTS produtos_oferta_idx ON public.produtos (oferta) WHERE oferta;
CREATE INDEX IF NOT EXISTS produtos_rasga_idx ON public.produtos (rasga_preco) WHERE rasga_preco;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS produtos_nome_trgm_idx ON public.produtos USING gin (nome gin_trgm_ops);
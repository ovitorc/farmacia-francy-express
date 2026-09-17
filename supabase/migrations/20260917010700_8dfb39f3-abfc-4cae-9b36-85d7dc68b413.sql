ALTER TABLE public.categorias
  ADD COLUMN id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.categorias SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.categorias ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.categorias ADD CONSTRAINT categorias_id_key UNIQUE (id);
CREATE UNIQUE INDEX categorias_nome_lower_key ON public.categorias (lower(btrim(nome)));

CREATE TRIGGER categorias_set_updated_at
BEFORE UPDATE ON public.categorias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.subcategorias
  ADD COLUMN categoria_id uuid,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.subcategorias s
SET categoria_id = c.id
FROM public.categorias c
WHERE c.slug = s.categoria_slug;

ALTER TABLE public.subcategorias ALTER COLUMN categoria_id SET NOT NULL;
ALTER TABLE public.subcategorias
  ADD CONSTRAINT subcategorias_categoria_id_fkey
  FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE CASCADE;
ALTER TABLE public.subcategorias
  ADD CONSTRAINT subcategorias_id_categoria_id_key UNIQUE (id, categoria_id);
CREATE UNIQUE INDEX subcategorias_categoria_nome_lower_key
  ON public.subcategorias (categoria_id, lower(btrim(nome)));
CREATE INDEX subcategorias_categoria_id_idx ON public.subcategorias (categoria_id, ordem, nome);

CREATE TRIGGER subcategorias_set_updated_at
BEFORE UPDATE ON public.subcategorias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.produtos
  ADD COLUMN codigo_original text,
  ADD COLUMN categoria_id uuid,
  ADD COLUMN subcategoria_id uuid;

UPDATE public.produtos p
SET categoria_id = c.id
FROM public.categorias c
WHERE c.slug = p.categoria_slug;

UPDATE public.produtos p
SET subcategoria_id = s.id
FROM public.subcategorias s
WHERE s.categoria_id = p.categoria_id
  AND s.slug = p.subcategoria_slug
  AND btrim(p.subcategoria_slug) <> '';

ALTER TABLE public.produtos ALTER COLUMN categoria_slug DROP NOT NULL;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_categoria_id_fkey
  FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE RESTRICT;
ALTER TABLE public.produtos
  ADD CONSTRAINT produtos_subcategoria_categoria_fkey
  FOREIGN KEY (subcategoria_id, categoria_id)
  REFERENCES public.subcategorias(id, categoria_id) ON DELETE RESTRICT;

CREATE INDEX produtos_categoria_id_idx ON public.produtos (categoria_id);
CREATE INDEX produtos_subcategoria_id_idx ON public.produtos (categoria_id, subcategoria_id);
CREATE INDEX produtos_codigo_original_idx ON public.produtos (codigo_original) WHERE codigo_original IS NOT NULL;
CREATE INDEX produtos_fabricante_trgm_idx ON public.produtos USING gin (fabricante gin_trgm_ops);
CREATE INDEX produtos_descricao_trgm_idx ON public.produtos USING gin (descricao gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.sync_produto_classificacao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_categoria_slug text;
  v_subcategoria_slug text;
  v_categoria_id uuid;
  v_subcategoria_id uuid;
BEGIN
  IF NEW.categoria_id IS NOT NULL THEN
    SELECT slug INTO v_categoria_slug FROM public.categorias WHERE id = NEW.categoria_id;
    IF v_categoria_slug IS NULL THEN
      RAISE EXCEPTION 'Categoria inválida.';
    END IF;
    NEW.categoria_slug := v_categoria_slug;
  ELSIF NEW.categoria_slug IS NOT NULL AND btrim(NEW.categoria_slug) <> '' THEN
    SELECT id INTO v_categoria_id FROM public.categorias WHERE slug = NEW.categoria_slug;
    IF v_categoria_id IS NULL THEN
      RAISE EXCEPTION 'Categoria inválida.';
    END IF;
    NEW.categoria_id := v_categoria_id;
  ELSE
    NEW.categoria_id := NULL;
    NEW.categoria_slug := NULL;
  END IF;

  IF NEW.subcategoria_id IS NOT NULL THEN
    SELECT slug INTO v_subcategoria_slug
    FROM public.subcategorias
    WHERE id = NEW.subcategoria_id AND categoria_id = NEW.categoria_id;
    IF v_subcategoria_slug IS NULL THEN
      RAISE EXCEPTION 'A subcategoria não pertence à categoria selecionada.';
    END IF;
    NEW.subcategoria_slug := v_subcategoria_slug;
  ELSIF NEW.subcategoria_slug IS NOT NULL AND btrim(NEW.subcategoria_slug) <> '' AND NEW.categoria_id IS NOT NULL THEN
    SELECT id INTO v_subcategoria_id
    FROM public.subcategorias
    WHERE categoria_id = NEW.categoria_id AND slug = NEW.subcategoria_slug;
    IF v_subcategoria_id IS NULL THEN
      NEW.subcategoria_id := NULL;
      NEW.subcategoria_slug := '';
    ELSE
      NEW.subcategoria_id := v_subcategoria_id;
    END IF;
  ELSE
    NEW.subcategoria_id := NULL;
    NEW.subcategoria_slug := '';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER produtos_sync_classificacao
BEFORE INSERT OR UPDATE OF categoria_id, subcategoria_id, categoria_slug, subcategoria_slug
ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.sync_produto_classificacao();
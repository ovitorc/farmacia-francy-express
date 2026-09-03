CREATE TABLE public.import_estoque_stage (
  id bigserial PRIMARY KEY,
  batch_id uuid NOT NULL,
  codigo text NOT NULL,
  nome text,
  preco numeric,
  estoque integer,
  codigo_barras text,
  fabricante text,
  unidade text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_estoque_stage_batch_idx ON public.import_estoque_stage (batch_id);
CREATE INDEX import_estoque_stage_codigo_idx ON public.import_estoque_stage (batch_id, codigo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_estoque_stage TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.import_estoque_stage_id_seq TO authenticated;
GRANT ALL ON public.import_estoque_stage TO service_role;
GRANT ALL ON SEQUENCE public.import_estoque_stage_id_seq TO service_role;

ALTER TABLE public.import_estoque_stage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam importacao de estoque"
ON public.import_estoque_stage FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.import_estoque_resumo(_batch uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _linhas int; _validos int; _atualizar int; _novos int; _excluir int; _erros int; _dup int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT count(*) INTO _linhas FROM import_estoque_stage WHERE batch_id = _batch;

  SELECT count(*) INTO _erros FROM import_estoque_stage
   WHERE batch_id = _batch AND (btrim(coalesce(codigo,'')) = '' OR estoque IS NULL);

  SELECT count(DISTINCT codigo) INTO _validos FROM import_estoque_stage
   WHERE batch_id = _batch AND btrim(coalesce(codigo,'')) <> '' AND estoque IS NOT NULL;

  _dup := _linhas - _erros - _validos;

  SELECT count(*) INTO _atualizar FROM produtos p
   WHERE EXISTS (SELECT 1 FROM import_estoque_stage s
                  WHERE s.batch_id = _batch AND s.codigo = p.codigo AND s.estoque IS NOT NULL);

  SELECT count(DISTINCT s.codigo) INTO _novos FROM import_estoque_stage s
   WHERE s.batch_id = _batch AND btrim(coalesce(s.codigo,'')) <> '' AND s.estoque IS NOT NULL
     AND btrim(coalesce(s.nome,'')) <> '' AND s.preco IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM produtos p WHERE p.codigo = s.codigo);

  SELECT count(*) INTO _excluir FROM produtos p
   WHERE NOT EXISTS (SELECT 1 FROM import_estoque_stage s WHERE s.batch_id = _batch AND s.codigo = p.codigo);

  RETURN json_build_object(
    'linhas', _linhas, 'encontrados', _validos, 'atualizar', _atualizar,
    'novos', _novos, 'excluir', _excluir, 'erros', _erros, 'duplicados', _dup,
    'total_banco', (SELECT count(*) FROM produtos)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.import_estoque_aplicar(_batch uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _atualizados int := 0; _inseridos int := 0; _excluidos int := 0; _erros int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT count(*) INTO _erros FROM import_estoque_stage
   WHERE batch_id = _batch AND (btrim(coalesce(codigo,'')) = '' OR estoque IS NULL);

  IF NOT EXISTS (SELECT 1 FROM import_estoque_stage WHERE batch_id = _batch) THEN
    RAISE EXCEPTION 'Nenhum dado importado para processar.';
  END IF;

  WITH validos AS (
    SELECT DISTINCT ON (codigo) codigo, nome, preco, estoque, codigo_barras, fabricante, unidade
      FROM import_estoque_stage
     WHERE batch_id = _batch AND btrim(coalesce(codigo,'')) <> '' AND estoque IS NOT NULL
     ORDER BY codigo, id DESC
  ), upd AS (
    UPDATE produtos p
       SET estoque = v.estoque,
           preco = COALESCE(v.preco, p.preco),
           disponivel = (v.estoque > 0)
      FROM validos v
     WHERE p.codigo = v.codigo
    RETURNING 1
  )
  SELECT count(*) INTO _atualizados FROM upd;

  WITH validos AS (
    SELECT DISTINCT ON (codigo) codigo, nome, preco, estoque, codigo_barras, fabricante, unidade
      FROM import_estoque_stage
     WHERE batch_id = _batch AND btrim(coalesce(codigo,'')) <> '' AND estoque IS NOT NULL
       AND btrim(coalesce(nome,'')) <> '' AND preco IS NOT NULL
     ORDER BY codigo, id DESC
  ), ins AS (
    INSERT INTO produtos (codigo, nome, preco, estoque, codigo_barras, fabricante, unidade, categoria_slug, disponivel)
    SELECT v.codigo, v.nome, v.preco, v.estoque, v.codigo_barras, coalesce(v.fabricante,''), coalesce(v.unidade,''),
           'medicamentos', (v.estoque > 0)
      FROM validos v
     WHERE NOT EXISTS (SELECT 1 FROM produtos p WHERE p.codigo = v.codigo)
    RETURNING 1
  )
  SELECT count(*) INTO _inseridos FROM ins;

  WITH del AS (
    DELETE FROM produtos p
     WHERE NOT EXISTS (SELECT 1 FROM import_estoque_stage s WHERE s.batch_id = _batch AND s.codigo = p.codigo)
    RETURNING 1
  )
  SELECT count(*) INTO _excluidos FROM del;

  DELETE FROM import_estoque_stage WHERE batch_id = _batch;

  RETURN json_build_object('atualizados', _atualizados, 'inseridos', _inseridos,
                           'excluidos', _excluidos, 'erros', _erros);
END;
$$;

REVOKE ALL ON FUNCTION public.import_estoque_resumo(uuid) FROM public;
REVOKE ALL ON FUNCTION public.import_estoque_aplicar(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.import_estoque_resumo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_estoque_aplicar(uuid) TO authenticated;
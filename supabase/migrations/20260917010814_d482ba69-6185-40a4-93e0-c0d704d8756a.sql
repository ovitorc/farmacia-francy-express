ALTER TABLE public.importacao_francy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.importacao_francy FROM anon, authenticated;
GRANT ALL ON TABLE public.importacao_francy TO service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.import_estoque_aplicar(_batch uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_atualizados INTEGER := 0;
    v_inseridos INTEGER := 0;
    v_excluidos INTEGER := 0;
    v_erros INTEGER := 0;
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acesso restrito a administradores.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.import_estoque_stage WHERE batch_id = _batch) THEN
        RAISE EXCEPTION 'Nenhum produto foi encontrado para esta importação.';
    END IF;

    DROP TABLE IF EXISTS tmp_import_produtos;
    CREATE TEMP TABLE tmp_import_produtos ON COMMIT DROP AS
    SELECT DISTINCT ON (BTRIM(codigo))
        BTRIM(codigo) AS codigo, nome, preco, preco_promocional, estoque,
        codigo_barras, fabricante, unidade
    FROM public.import_estoque_stage
    WHERE batch_id = _batch AND codigo IS NOT NULL AND BTRIM(codigo) <> ''
    ORDER BY BTRIM(codigo), created_at DESC, id DESC;

    CREATE UNIQUE INDEX tmp_import_produtos_codigo_idx ON tmp_import_produtos (codigo);
    ANALYZE tmp_import_produtos;

    UPDATE public.produtos p
    SET preco = COALESCE(s.preco, p.preco),
        preco_promocional = CASE WHEN s.preco_promocional IS NOT NULL AND s.preco_promocional > 0 THEN s.preco_promocional ELSE NULL END,
        estoque = COALESCE(s.estoque, p.estoque),
        disponivel = COALESCE(s.estoque, 0) > 0,
        nome = COALESCE(NULLIF(BTRIM(s.nome), ''), p.nome),
        codigo_barras = COALESCE(NULLIF(BTRIM(s.codigo_barras), ''), p.codigo_barras),
        fabricante = COALESCE(NULLIF(BTRIM(s.fabricante), ''), p.fabricante),
        unidade = COALESCE(NULLIF(BTRIM(s.unidade), ''), p.unidade)
    FROM tmp_import_produtos s
    WHERE BTRIM(p.codigo) = s.codigo;
    GET DIAGNOSTICS v_atualizados = ROW_COUNT;

    INSERT INTO public.produtos (
        codigo, nome, preco, preco_promocional, estoque, disponivel,
        codigo_barras, fabricante, unidade, categoria_id, categoria_slug
    )
    SELECT s.codigo,
        COALESCE(NULLIF(BTRIM(s.nome), ''), 'Produto sem nome'),
        COALESCE(s.preco, 0),
        CASE WHEN s.preco_promocional IS NOT NULL AND s.preco_promocional > 0 THEN s.preco_promocional ELSE NULL END,
        COALESCE(s.estoque, 0), COALESCE(s.estoque, 0) > 0,
        NULLIF(BTRIM(s.codigo_barras), ''), COALESCE(NULLIF(BTRIM(s.fabricante), ''), ''),
        COALESCE(NULLIF(BTRIM(s.unidade), ''), ''), NULL, NULL
    FROM tmp_import_produtos s
    WHERE NOT EXISTS (SELECT 1 FROM public.produtos p WHERE BTRIM(p.codigo) = s.codigo);
    GET DIAGNOSTICS v_inseridos = ROW_COUNT;

    DROP TABLE IF EXISTS tmp_import_codigos;
    CREATE TEMP TABLE tmp_import_codigos (codigo TEXT PRIMARY KEY) ON COMMIT DROP;
    INSERT INTO tmp_import_codigos (codigo) SELECT codigo FROM tmp_import_produtos;
    ANALYZE tmp_import_codigos;

    DELETE FROM public.produtos p
    WHERE NOT EXISTS (SELECT 1 FROM tmp_import_codigos c WHERE c.codigo = BTRIM(p.codigo));
    GET DIAGNOSTICS v_excluidos = ROW_COUNT;

    DELETE FROM public.import_estoque_stage WHERE batch_id = _batch;

    RETURN jsonb_build_object('atualizados', v_atualizados, 'inseridos', v_inseridos,
      'excluidos', v_excluidos, 'erros', v_erros);
END;
$$;

REVOKE ALL ON FUNCTION public.import_estoque_aplicar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_estoque_aplicar(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.import_estoque_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_estoque_resumo(uuid) TO authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
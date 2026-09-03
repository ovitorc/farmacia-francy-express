CREATE TABLE IF NOT EXISTS public.import_estoque_stage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    codigo TEXT NOT NULL,
    nome TEXT,
    preco NUMERIC,
    estoque INTEGER,
    codigo_barras TEXT,
    fabricante TEXT,
    unidade TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_estoque_stage_batch
ON public.import_estoque_stage(batch_id);

CREATE INDEX IF NOT EXISTS idx_import_estoque_stage_batch_codigo
ON public.import_estoque_stage(batch_id, codigo);

ALTER TABLE public.import_estoque_stage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem visualizar importações"
ON public.import_estoque_stage;

CREATE POLICY "Admins podem visualizar importações"
ON public.import_estoque_stage
FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins podem inserir importações"
ON public.import_estoque_stage;

CREATE POLICY "Admins podem inserir importações"
ON public.import_estoque_stage
FOR INSERT
TO authenticated
WITH CHECK (
    public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins podem excluir importações"
ON public.import_estoque_stage;

CREATE POLICY "Admins podem excluir importações"
ON public.import_estoque_stage
FOR DELETE
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
);

CREATE OR REPLACE FUNCTION public.import_estoque_resumo(
    _batch UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_linhas INTEGER;
    v_encontrados INTEGER;
    v_atualizar INTEGER;
    v_novos INTEGER;
    v_excluir INTEGER;
    v_erros INTEGER;
    v_duplicados INTEGER;
    v_total_banco INTEGER;
BEGIN

    SELECT COUNT(*)
    INTO v_linhas
    FROM public.import_estoque_stage
    WHERE batch_id = _batch;

    SELECT COUNT(*)
    INTO v_total_banco
    FROM public.produtos;

    SELECT COUNT(*)
    INTO v_duplicados
    FROM (
        SELECT codigo
        FROM public.import_estoque_stage
        WHERE batch_id = _batch
        GROUP BY codigo
        HAVING COUNT(*) > 1
    ) duplicados;

    SELECT COUNT(*)
    INTO v_encontrados
    FROM public.import_estoque_stage s
    INNER JOIN public.produtos p
        ON TRIM(p.codigo) = TRIM(s.codigo)
    WHERE s.batch_id = _batch;

    v_atualizar := v_encontrados;

    SELECT COUNT(*)
    INTO v_novos
    FROM public.import_estoque_stage s
    LEFT JOIN public.produtos p
        ON TRIM(p.codigo) = TRIM(s.codigo)
    WHERE s.batch_id = _batch
      AND p.codigo IS NULL;

    SELECT COUNT(*)
    INTO v_excluir
    FROM public.produtos p
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.import_estoque_stage s
        WHERE s.batch_id = _batch
          AND TRIM(s.codigo) = TRIM(p.codigo)
    );

    SELECT COUNT(*)
    INTO v_erros
    FROM public.import_estoque_stage
    WHERE batch_id = _batch
      AND (
          codigo IS NULL
          OR TRIM(codigo) = ''
          OR estoque IS NULL
      );

    RETURN jsonb_build_object(
        'linhas', v_linhas,
        'encontrados', v_encontrados,
        'atualizar', v_atualizar,
        'novos', v_novos,
        'excluir', v_excluir,
        'erros', v_erros,
        'duplicados', v_duplicados,
        'total_banco', v_total_banco
    );

END;
$$;

CREATE OR REPLACE FUNCTION public.import_estoque_aplicar(
    _batch UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_atualizados INTEGER := 0;
    v_inseridos INTEGER := 0;
    v_excluidos INTEGER := 0;
    v_erros INTEGER := 0;
BEGIN

    IF NOT EXISTS (
        SELECT 1
        FROM public.import_estoque_stage
        WHERE batch_id = _batch
    ) THEN
        RAISE EXCEPTION
        'Nenhum produto foi encontrado para esta importação.';
    END IF;

    DELETE FROM public.import_estoque_stage a
    USING public.import_estoque_stage b
    WHERE a.batch_id = _batch
      AND b.batch_id = _batch
      AND a.codigo = b.codigo
      AND a.created_at < b.created_at;

    UPDATE public.produtos p
    SET
        preco = CASE
            WHEN s.preco IS NOT NULL
             AND s.preco > 0
            THEN s.preco
            ELSE p.preco
        END,

        estoque = COALESCE(
            s.estoque,
            p.estoque
        ),

        disponivel = CASE
            WHEN COALESCE(s.estoque, 0) > 0
            THEN TRUE
            ELSE FALSE
        END,

        nome = COALESCE(
            NULLIF(TRIM(s.nome), ''),
            p.nome
        ),

        codigo_barras = COALESCE(
            NULLIF(TRIM(s.codigo_barras), ''),
            p.codigo_barras
        ),

        fabricante = COALESCE(
            NULLIF(TRIM(s.fabricante), ''),
            p.fabricante
        ),

        unidade = COALESCE(
            NULLIF(TRIM(s.unidade), ''),
            p.unidade
        )

    FROM public.import_estoque_stage s
    WHERE s.batch_id = _batch
      AND TRIM(p.codigo) = TRIM(s.codigo);

    GET DIAGNOSTICS v_atualizados = ROW_COUNT;

    INSERT INTO public.produtos (
        codigo,
        nome,
        preco,
        estoque,
        disponivel,
        codigo_barras,
        fabricante,
        unidade
    )
    SELECT
        TRIM(s.codigo),

        COALESCE(
            NULLIF(TRIM(s.nome), ''),
            'Produto sem nome'
        ),

        COALESCE(
            NULLIF(s.preco, 0),
            0
        ),

        COALESCE(
            s.estoque,
            0
        ),

        CASE
            WHEN COALESCE(s.estoque, 0) > 0
            THEN TRUE
            ELSE FALSE
        END,

        NULLIF(
            TRIM(s.codigo_barras),
            ''
        ),

        NULLIF(
            TRIM(s.fabricante),
            ''
        ),

        NULLIF(
            TRIM(s.unidade),
            ''
        )

    FROM public.import_estoque_stage s
    WHERE s.batch_id = _batch
      AND NOT EXISTS (
          SELECT 1
          FROM public.produtos p
          WHERE TRIM(p.codigo) = TRIM(s.codigo)
      );

    GET DIAGNOSTICS v_inseridos = ROW_COUNT;

    DELETE FROM public.produtos p
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.import_estoque_stage s
        WHERE s.batch_id = _batch
          AND TRIM(s.codigo) = TRIM(p.codigo)
    );

    GET DIAGNOSTICS v_excluidos = ROW_COUNT;

    DELETE FROM public.import_estoque_stage
    WHERE batch_id = _batch;

    RETURN jsonb_build_object(
        'atualizados', v_atualizados,
        'inseridos', v_inseridos,
        'excluidos', v_excluidos,
        'erros', v_erros
    );

END;
$$;

GRANT EXECUTE
ON FUNCTION public.import_estoque_resumo(UUID)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.import_estoque_aplicar(UUID)
TO authenticated;
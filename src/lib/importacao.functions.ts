import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
IMPORTAÇÃO DE PRODUTOS POR PLANILHA

IMPORTANTE:

O campo "preco" recebido aqui vem do arquivo:

src/components/ImportarEstoque.tsx

Nesse arquivo, o campo "preco" deve receber o valor da coluna:

"Preço de Promoção"

FLUXO:

Excel
↓
Preço de Promoção
↓
ImportarEstoque.tsx
↓
preco
↓
Este arquivo
↓
import_estoque_stage
↓
import_estoque_aplicar()
============================================================ */

/* ============================================================
VERIFICAR SE O USUÁRIO É ADMINISTRADOR
============================================================ */

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });

  if (error || !data) {
    throw new Error("Acesso restrito a administradores.");
  }
}

/* ============================================================
ESTRUTURA DE CADA PRODUTO RECEBIDO DA PLANILHA
============================================================ */

const linhaSchema = z.object({
  /*
CÓDIGO INTERNO DO PRODUTO

```
Vem da coluna:

Código
```

*/

  codigo: z.string(),

  /*
NOME DO PRODUTO

```
Vem da coluna:

Descrição
```

*/

  nome: z.string().nullable().default(null),

  /*
PREÇO DO PRODUTO

```
IMPORTANTE:

Este valor deve vir da coluna:

Preço de Promoção

O valor é enviado pelo arquivo:

ImportarEstoque.tsx
```

*/

  preco: z.number().nullable().default(null),

  /*
ESTOQUE

```
Vem da coluna:

Estoque
```

*/

  estoque: z.number().int().nullable().default(null),

  /*
CÓDIGO DE BARRAS

```
Vem da coluna:

Barras
```

*/

  codigo_barras: z.string().nullable().default(null),

  /*
FABRICANTE / LABORATÓRIO

```
Vem da coluna:

Fabricante - Laboratório
```

*/

  fabricante: z.string().nullable().default(null),

  /*
UNIDADE

```
Vem da coluna:

Unidade
```

*/

  unidade: z.string().nullable().default(null),
});

/* ============================================================
TIPO UTILIZADO PELO FRONT-END
============================================================ */

export type LinhaImportacao = z.infer<typeof linhaSchema>;

/* ============================================================
ENVIAR PRODUTOS PARA A TABELA TEMPORÁRIA

TABELA:

import_estoque_stage
============================================================ */

export const enviarLoteImportacao = createServerFn({
  method: "POST",
})```
.middleware([
  requireSupabaseAuth,
])

.inputValidator(
  (input: unknown) =>
    z
      .object({

        /*
          IDENTIFICADOR DA IMPORTAÇÃO

          Todos os produtos enviados durante
          a mesma importação terão o mesmo
          batchId.
        */

        batchId: z.string().uuid(),


        /*
          PRODUTOS DA PLANILHA

          Máximo de 3000 produtos por envio.
        */

        linhas: z
          .array(linhaSchema)
          .min(1)
          .max(3000),

      })
      .parse(input),
)

.handler(
  async ({
    data,
    context,
  }) => {

    /*
      Apenas administradores podem importar
      produtos.
    */

    await assertAdmin(context);


    /*
      Inserir os produtos na tabela temporária.
    */

    const {
      error,
    } = await (
      context.supabase as any
    )
      .from(
        "import_estoque_stage",
      )
      .insert(

        data.linhas.map(
          (produto) => ({

            /*
              Dados do produto.
            */

            ...produto,


            /*
              Identificador da importação.
            */

            batch_id:
              data.batchId,

          }),
        ),

      );


    /*
      Caso ocorra algum erro ao inserir
      os produtos.
    */

    if (error) {

      throw new Error(
        error.message,
      );

    }


    /*
      Retorno de confirmação.
    */

    return {

      ok: true,

      enviadas:
        data.linhas.length,

    };

  },
);
```;

/* ============================================================
GERAR RESUMO DA IMPORTAÇÃO

ESTA FUNÇÃO NÃO ALTERA O BANCO.

Ela apenas verifica:

* Quantos produtos foram encontrados.
* Quantos serão atualizados.
* Quantos serão adicionados.
* Quantos serão removidos.
* Produtos duplicados.
* Possíveis erros.

FUNÇÃO SQL UTILIZADA:

import_estoque_resumo
============================================================ */

export const resumoImportacao = createServerFn({
  method: "POST",
})```
.middleware([
  requireSupabaseAuth,
])

.inputValidator(
  (input: unknown) =>
    z
      .object({

        batchId:
          z.string().uuid(),

      })
      .parse(input),
)

.handler(
  async ({
    data,
    context,
  }) => {

    /*
      Verificar se é administrador.
    */

    await assertAdmin(context);


    /*
      Solicitar o resumo ao Supabase.
    */

    const {
      data: resumo,
      error,
    } = await (
      context.supabase as any
    )
      .rpc(
        "import_estoque_resumo",
        {

          _batch:
            data.batchId,

        },
      );


    /*
      Caso exista erro na função SQL.
    */

    if (error) {

      throw new Error(
        error.message,
      );

    }


    /*
      Retornar o resumo.
    */

    return resumo as {

      linhas:
        number;

      encontrados:
        number;

      atualizar:
        number;

      novos:
        number;

      excluir:
        number;

      erros:
        number;

      duplicados:
        number;

      total_banco:
        number;

    };

  },
);
```;

/* ============================================================
APLICAR A SINCRONIZAÇÃO

ESTA É A FUNÇÃO QUE REALMENTE ALTERA
OS PRODUTOS DO BANCO.

FUNÇÃO SQL UTILIZADA:

import_estoque_aplicar

A FUNÇÃO SQL É RESPONSÁVEL POR:

1. Atualizar produtos existentes.
2. Inserir produtos novos.
3. Remover produtos que não existem
   mais na planilha.

O PREÇO ENVIADO PARA A FUNÇÃO É O CAMPO:

preco

QUE ORIGINALMENTE VEM DA COLUNA:

Preço de Promoção
============================================================ */

export const aplicarImportacao = createServerFn({
  method: "POST",
})```
.middleware([
  requireSupabaseAuth,
])

.inputValidator(
  (input: unknown) =>
    z
      .object({

        batchId:
          z.string().uuid(),

      })
      .parse(input),
)

.handler(
  async ({
    data,
    context,
  }) => {

    /*
      Verificar permissão de administrador.
    */

    await assertAdmin(context);


    /*
      Executar a sincronização no Supabase.
    */

    const {
      data: resultado,
      error,
    } = await (
      context.supabase as any
    )
      .rpc(
        "import_estoque_aplicar",
        {

          _batch:
            data.batchId,

        },
      );


    /*
      Caso a sincronização apresente erro.
    */

    if (error) {

      throw new Error(
        error.message,
      );

    }


    /*
      Retornar o resultado final.
    */

    return resultado as {

      atualizados:
        number;

      inseridos:
        number;

      excluidos:
        number;

      erros:
        number;

    };

  },
);
```;

/* ============================================================
CANCELAR IMPORTAÇÃO

Remove da tabela temporária os produtos
pertencentes ao batch atual.

Isso NÃO altera os produtos reais.

Apenas remove os dados temporários.
============================================================ */

export const cancelarImportacao = createServerFn({
  method: "POST",
})```
.middleware([
  requireSupabaseAuth,
])

.inputValidator(
  (input: unknown) =>
    z
      .object({

        batchId:
          z.string().uuid(),

      })
      .parse(input),
)

.handler(
  async ({
    data,
    context,
  }) => {

    /*
      Verificar permissão.
    */

    await assertAdmin(context);


    /*
      Remover os produtos temporários.
    */

    const {
      error,
    } = await (
      context.supabase as any
    )
      .from(
        "import_estoque_stage",
      )
      .delete()
      .eq(
        "batch_id",
        data.batchId,
      );


    /*
      Caso ocorra erro.
    */

    if (error) {

      throw new Error(
        error.message,
      );

    }


    /*
      Retorno.
    */

    return {

      ok: true,

    };

  },
);
```;

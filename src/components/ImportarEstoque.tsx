import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogFooter,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";

import {
enviarLoteImportacao,
resumoImportacao,
aplicarImportacao,
cancelarImportacao,
type LinhaImportacao,
} from "@/lib/importacao.functions";

/* ============================================================
LEITURA DA PLANILHA

MAPEAMENTO DAS COLUNAS DO EXCEL:

Código                  → codigo
Descrição               → nome
Preço de Promoção       → preco (PRIORIDADE)
Estoque                 → estoque
Barras                  → codigo_barras
Fabricante - Laboratório → fabricante
Unidade                 → unidade
============================================================ */

const CAMPOS = {
codigo: [
"codigo",
"cod",
"codigointerno",
"codproduto",
"codigoproduto",
],

nome: [
"descricao",
"descricaoproduto",
"nome",
"produto",
"nomeproduto",
],

/*
IMPORTANTE:

```
O preço utilizado no site será prioritariamente
o valor da coluna:

"Preço de Promoção"

Como a função normalizar remove acentos e espaços,
"Preço de Promoção" se transforma em:

"precodepromocao"
```

*/
preco: [
"precodepromocao",
"precopromocao",
],

estoque: [
"estoque",
"qtd",
"quantidade",
"saldo",
"estoqueatual",
"saldoestoque",
],

codigo_barras: [
"barras",
"codigobarras",
"ean",
"codbarras",
"gtin",
],

fabricante: [
"fabricantelaboratorio",
"fabricante",
"laboratorio",
"marca",
],

unidade: [
"unidade",
"un",
"embalagem",
"apresentacao",
],
} as const;

/* ============================================================
NORMALIZAÇÃO DE TEXTO
============================================================ */

function normalizar(texto: string) {
return texto
.normalize("NFD")
.replace(/[\u0300-\u036f]/g, "")
.toLowerCase()
.replace(/[^a-z0-9]/g, "");
}

/* ============================================================
CONVERSÃO DE NÚMEROS

Aceita formatos como:

10
10.50
10,50
R$ 10,50
============================================================ */

function numero(valor: unknown): number | null {
if (valor === null || valor === undefined || valor === "") {
return null;
}

if (typeof valor === "number") {
return Number.isFinite(valor) ? valor : null;
}

const valorTexto = String(valor)
.trim()
.replace(/[^\d,.-]/g, "");

if (!valorTexto) {
return null;
}

const limpo =
valorTexto.includes(",") &&
valorTexto.lastIndexOf(",") > valorTexto.lastIndexOf(".")
? valorTexto.replace(/./g, "").replace(",", ".")
: valorTexto.replace(/,/g, "");

const numeroConvertido = Number(limpo);

return Number.isFinite(numeroConvertido)
? numeroConvertido
: null;
}

/* ============================================================
CONVERSÃO DE TEXTO
============================================================ */

function texto(valor: unknown): string | null {
if (valor === null || valor === undefined) {
return null;
}

const resultado = String(valor).trim();

return resultado === "" ? null : resultado;
}

type Erro = {
linha: number;
motivo: string;
};

/* ============================================================
LEITURA DO ARQUIVO EXCEL
============================================================ */

async function lerPlanilha(
arquivo: File,
): Promise<{
linhas: LinhaImportacao[];
erros: Erro[];
}> {
const XLSX = await import("xlsx");

const buffer = await arquivo.arrayBuffer();

const wb = XLSX.read(buffer, {
type: "array",
raw: false,
});

const nomeAba = wb.SheetNames[0];

if (!nomeAba) {
throw new Error("A planilha está vazia.");
}

const aba = wb.Sheets[nomeAba];

if (!aba) {
throw new Error("Não foi possível abrir a primeira aba da planilha.");
}

const bruto =
XLSX.utils.sheet_to_json<Record<string, unknown>>(
aba,
{
defval: "",
raw: false,
},
);

if (bruto.length === 0) {
throw new Error(
"Nenhuma linha de dados encontrada na planilha.",
);
}

/* ============================================================
IDENTIFICAR OS CABEÇALHOS
============================================================ */

const cabecalhos = Object.keys(bruto[0]);

const mapa:
Partial<Record<keyof typeof CAMPOS, string>> = {};

for (
const [campo, apelidos]
of Object.entries(CAMPOS) as [
keyof typeof CAMPOS,
readonly string[],
][]
) {
const achado = cabecalhos.find((cabecalho) =>
apelidos.includes(normalizar(cabecalho)),
);

```
if (achado) {
  mapa[campo] = achado;
}
```

}

/* ============================================================
VALIDAÇÕES OBRIGATÓRIAS
============================================================ */

if (!mapa.codigo) {
throw new Error(
`A planilha precisa ter a coluna "Código".

Colunas encontradas:

${cabecalhos.join(", ")}`,
);
}

if (!mapa.estoque) {
throw new Error(
`A planilha precisa ter a coluna "Estoque".

Colunas encontradas:

${cabecalhos.join(", ")}`,
);
}

/*
A coluna Preço de Promoção agora é obrigatória.

```
Isso garante que o sistema não utilize
Preço de Venda por engano.
```

*/

if (!mapa.preco) {
throw new Error(
`A planilha precisa ter a coluna "Preço de Promoção".

Colunas encontradas:

${cabecalhos.join(", ")}`,
);
}

/* ============================================================
PROCESSAR AS LINHAS
============================================================ */

const linhas: LinhaImportacao[] = [];

const erros: Erro[] = [];

bruto.forEach((linha, indice) => {
const codigo =
texto(linha[mapa.codigo!]);

```
const estoque =
  numero(linha[mapa.estoque!]);

/*
  PREÇO UTILIZADO:

  Coluna "Preço de Promoção"
*/

const preco =
  numero(linha[mapa.preco!]);

/* ============================================================
   VALIDAR CÓDIGO
   ============================================================ */

if (!codigo) {
  erros.push({
    linha: indice + 2,
    motivo: "Código vazio",
  });

  return;
}

/* ============================================================
   VALIDAR ESTOQUE
   ============================================================ */

if (estoque === null) {
  erros.push({
    linha: indice + 2,
    motivo:
      `Estoque inválido (código ${codigo})`,
  });

  return;
}

/* ============================================================
   VALIDAR PREÇO DE PROMOÇÃO

   O preço pode ser zero ou vazio dependendo
   da estrutura da base.

   Nesse caso o produto continuará sendo enviado,
   mas o valor do preço será null.
   ============================================================ */

linhas.push({
  codigo,

  nome: mapa.nome
    ? texto(linha[mapa.nome])
    : null,

  /*
    PREÇO DO PRODUTO NO SITE

    Vem diretamente da coluna:

    Preço de Promoção
  */

  preco,

  estoque:
    Math.max(
      0,
      Math.round(estoque),
    ),

  codigo_barras: mapa.codigo_barras
    ? texto(linha[mapa.codigo_barras])
    : null,

  fabricante: mapa.fabricante
    ? texto(linha[mapa.fabricante])
    : null,

  unidade: mapa.unidade
    ? texto(linha[mapa.unidade])
    : null,
});
```

});

if (linhas.length === 0) {
throw new Error(
"Nenhuma linha válida encontrada na planilha.",
);
}

return {
linhas,
erros,
};
}

/* ============================================================
TIPOS DO RESUMO
============================================================ */

type Resumo = {
linhas: number;
encontrados: number;
atualizar: number;
novos: number;
excluir: number;
erros: number;
duplicados: number;
total_banco: number;
};

type Resultado = {
atualizados: number;
inseridos: number;
excluidos: number;
erros: number;
};

/* ============================================================
COMPONENTE PRINCIPAL
============================================================ */

export function ImportarEstoque({
onConcluido,
}: {
onConcluido?: () => void;
}) {
const inputRef =
useRef<HTMLInputElement>(null);

const enviarLote =
useServerFn(enviarLoteImportacao);

const pedirResumo =
useServerFn(resumoImportacao);

const aplicar =
useServerFn(aplicarImportacao);

const cancelar =
useServerFn(cancelarImportacao);

const [aberto, setAberto] =
useState(false);

const [ocupado, setOcupado] =
useState(false);

const [progresso, setProgresso] =
useState("");

const [arquivoNome, setArquivoNome] =
useState("");

const [batchId, setBatchId] =
useState<string | null>(null);

const [resumo, setResumo] =
useState<Resumo | null>(null);

const [errosArquivo, setErrosArquivo] =
useState<Erro[]>([]);

const [resultado, setResultado] =
useState<Resultado | null>(null);

/* ============================================================
REINICIAR IMPORTAÇÃO
============================================================ */

function reiniciar() {
setBatchId(null);

```
setResumo(null);

setErrosArquivo([]);

setResultado(null);

setArquivoNome("");

setProgresso("");

if (inputRef.current) {
  inputRef.current.value = "";
}
```

}

/* ============================================================
SELECIONAR E PROCESSAR ARQUIVO
============================================================ */

async function selecionarArquivo(
arquivo: File,
) {
setOcupado(true);

```
setResultado(null);

setResumo(null);

setArquivoNome(arquivo.name);

const novoBatch =
  crypto.randomUUID();

try {
  setProgresso(
    "Lendo e validando a planilha...",
  );

  const {
    linhas,
    erros,
  } = await lerPlanilha(arquivo);

  setErrosArquivo(erros);

  /*
    ENVIO EM LOTES

    Evita problemas ao enviar milhares
    de produtos de uma única vez.
  */

  const TAMANHO = 1500;

  for (
    let i = 0;
    i < linhas.length;
    i += TAMANHO
  ) {
    setProgresso(
      `Enviando ${Math.min(
        i + TAMANHO,
        linhas.length,
      )} de ${linhas.length} produtos...`,
    );

    await enviarLote({
      data: {
        batchId: novoBatch,
        linhas:
          linhas.slice(
            i,
            i + TAMANHO,
          ),
      },
    });
  }

  setProgresso(
    "Calculando o resumo da sincronização...",
  );

  const resposta =
    await pedirResumo({
      data: {
        batchId: novoBatch,
      },
    });

  setBatchId(novoBatch);

  setResumo(resposta);

  setAberto(true);

  setProgresso("");
} catch (erro) {
  try {
    await cancelar({
      data: {
        batchId: novoBatch,
      },
    });
  } catch {
    /*
      Nada para limpar.
    */
  }

  reiniciar();

  toast.error(
    erro instanceof Error
      ? erro.message
      : "Não foi possível ler a planilha.",
  );
} finally {
  setOcupado(false);
}
```

}

/* ============================================================
CONFIRMAR SINCRONIZAÇÃO
============================================================ */

async function confirmar() {
if (!batchId) {
return;
}

```
setOcupado(true);

setProgresso(
  "Sincronizando o banco de dados...",
);

try {
  const resposta =
    await aplicar({
      data: {
        batchId,
      },
    });

  setResultado(resposta);

  setResumo(null);

  setBatchId(null);

  toast.success(
    "Produtos sincronizados com sucesso.",
  );

  onConcluido?.();
} catch (erro) {
  toast.error(
    erro instanceof Error
      ? erro.message
      : "Falha ao sincronizar os produtos.",
  );
} finally {
  setOcupado(false);

  setProgresso("");
}
```

}

/* ============================================================
FECHAR JANELA
============================================================ */

async function fechar() {
if (ocupado) {
return;
}

```
if (batchId) {
  try {
    await cancelar({
      data: {
        batchId,
      },
    });
  } catch {
    /*
      Nada para limpar.
    */
  }
}

setAberto(false);

reiniciar();
```

}

/* ============================================================
INTERFACE
============================================================ */

return (
<>
<input
ref={inputRef}
type="file"
accept=".xlsx,.xls,.csv"
className="hidden"
onChange={(e) => {
const arquivo =
e.target.files?.[0];

```
      if (arquivo) {
        void selecionarArquivo(
          arquivo,
        );
      }
    }}
  />

  <Button
    variant="outline"
    disabled={ocupado}
    onClick={() =>
      inputRef.current?.click()
    }
  >
    {ocupado && !aberto
      ? "Lendo planilha..."
      : "Importar Estoque"}
  </Button>

  <Dialog
    open={aberto}
    onOpenChange={(valor) =>
      valor
        ? setAberto(true)
        : void fechar()
    }
  >
    <DialogContent className="max-w-lg">

      <DialogHeader>
        <DialogTitle>
          {resultado
            ? "Sincronização concluída"
            : "Confirmar importação"}
        </DialogTitle>
      </DialogHeader>

      {arquivoNome ? (
        <p className="text-sm text-muted-foreground">
          Arquivo: {arquivoNome}
        </p>
      ) : null}

      {progresso ? (
        <p className="text-sm font-medium text-primary">
          {progresso}
        </p>
      ) : null}

      {resumo ? (
        <div className="space-y-2 text-sm">

          <Linha
            rotulo="Produtos encontrados no Excel"
            valor={resumo.encontrados}
          />

          <Linha
            rotulo="Produtos que serão atualizados"
            valor={resumo.atualizar}
          />

          <Linha
            rotulo="Produtos novos"
            valor={resumo.novos}
          />

          <Linha
            rotulo="Produtos que serão excluídos"
            valor={resumo.excluir}
            destaque
          />

          <Linha
            rotulo="Linhas com erro"
            valor={
              resumo.erros +
              errosArquivo.length
            }
          />

          <Linha
            rotulo="Códigos repetidos na planilha"
            valor={resumo.duplicados}
          />

          <Linha
            rotulo="Produtos atualmente no banco"
            valor={resumo.total_banco}
          />

          {errosArquivo.length > 0 ? (
            <div className="mt-3 max-h-32 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">

              {errosArquivo
                .slice(0, 30)
                .map((erro) => (
                  <p
                    key={`${erro.linha}-${erro.motivo}`}
                  >
                    Linha {erro.linha}:{" "}
                    {erro.motivo}
                  </p>
                ))}

              {errosArquivo.length > 30 ? (
                <p>
                  … e mais{" "}
                  {errosArquivo.length - 30}{" "}
                  linhas com erro.
                </p>
              ) : null}

            </div>
          ) : null}

          <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">

            Atenção: os produtos que não estiverem
            presentes na planilha serão removidos
            do site.

            <br />
            <br />

            O preço utilizado para sincronização será
            exclusivamente o valor da coluna:

            <strong>
              {" "}Preço de Promoção
            </strong>

          </p>

        </div>
      ) : null}

      {resultado ? (
        <div className="space-y-2 text-sm">

          <Linha
            rotulo="Produtos atualizados"
            valor={resultado.atualizados}
          />

          <Linha
            rotulo="Produtos inseridos"
            valor={resultado.inseridos}
          />

          <Linha
            rotulo="Produtos excluídos"
            valor={resultado.excluidos}
          />

          <Linha
            rotulo="Erros"
            valor={
              resultado.erros +
              errosArquivo.length
            }
          />

        </div>
      ) : null}

      <DialogFooter>

        {resultado ? (
          <Button
            onClick={() =>
              void fechar()
            }
          >
            Fechar
          </Button>
        ) : (
          <>

            <Button
              variant="outline"
              disabled={ocupado}
              onClick={() =>
                void fechar()
              }
            >
              Cancelar
            </Button>

            <Button
              disabled={
                ocupado ||
                !resumo
              }
              onClick={() =>
                void confirmar()
              }
            >
              Confirmar e sincronizar
            </Button>

          </>
        )}

      </DialogFooter>

    </DialogContent>
  </Dialog>
</>
```

);
}

/* ============================================================
LINHA DO RESUMO
============================================================ */

function Linha({
rotulo,
valor,
destaque,
}: {
rotulo: string;
valor: number;
destaque?: boolean;
}) {
return ( <div className="flex items-center justify-between gap-4 border-b pb-1">

```
  <span className="text-muted-foreground">
    {rotulo}
  </span>

  <span
    className={
      destaque
        ? "font-bold text-destructive"
        : "font-semibold text-foreground"
    }
  >
    {valor.toLocaleString(
      "pt-BR",
    )}
  </span>

</div>
```

);
}

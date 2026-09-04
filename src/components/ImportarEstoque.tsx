import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  enviarLoteImportacao,
  resumoImportacao,
  aplicarImportacao,
  cancelarImportacao,
  type LinhaImportacao,
} from "@/lib/importacao.functions";

const CAMPOS = {
  codigo: ["codigo", "código", "cod"],

  nome: ["descricao", "descrição", "nome", "produto"],

  preco: ["precodevenda", "precovenda", "preço de venda"],

  preco_promocional: ["precodepromocao", "precopromocao", "preço de promoção"],

  estoque: ["estoque", "quantidade", "saldo"],

  codigo_barras: ["barras", "codigobarras", "código de barras", "ean"],

  fabricante: ["fabricantelaboratorio", "fabricante", "laboratorio", "laboratório"],

  unidade: ["unidade", "un"],
} as const;

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function converterNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  let texto = String(valor)
    .trim()
    .replace(/[R$\s]/g, "");

  if (!texto) {
    return null;
  }

  if (texto.includes(",") && texto.includes(".")) {
    if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) {
      texto = texto.replace(/\./g, "").replace(",", ".");
    } else {
      texto = texto.replace(/,/g, "");
    }
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const resultado = Number(texto);

  return Number.isFinite(resultado) ? resultado : null;
}

function converterTexto(valor: unknown): string | null {
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

async function lerPlanilha(arquivo: File): Promise<{
  linhas: LinhaImportacao[];
  erros: Erro[];
}> {
  const XLSX = await import("xlsx");

  const buffer = await arquivo.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array",
    raw: false,
  });

  const primeiraAba = workbook.SheetNames[0];

  if (!primeiraAba) {
    throw new Error("A planilha está vazia.");
  }

  const worksheet = workbook.Sheets[primeiraAba];

  if (!worksheet) {
    throw new Error("Não foi possível abrir a planilha.");
  }

  const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  if (dados.length === 0) {
    throw new Error("Nenhum produto foi encontrado na planilha.");
  }

  const cabecalhos = Object.keys(dados[0] ?? {});

  const mapa: Partial<Record<keyof typeof CAMPOS, string>> = {};

  for (const [campo, alternativas] of Object.entries(CAMPOS) as [keyof typeof CAMPOS, readonly string[]][]) {
    const coluna = cabecalhos.find((cabecalho) => alternativas.includes(normalizar(cabecalho)));

    if (coluna) {
      mapa[campo] = coluna;
    }
  }

  if (!mapa.codigo) {
    throw new Error(`Não foi encontrada a coluna "Código".`);
  }

  if (!mapa.estoque) {
    throw new Error(`Não foi encontrada a coluna "Estoque".`);
  }

  if (!mapa.preco) {
    throw new Error(`Não foi encontrada a coluna "Preço de Venda".`);
  }

  if (!mapa.preco_promocional) {
    throw new Error(`Não foi encontrada a coluna "Preço de Promoção".`);
  }

  const linhas: LinhaImportacao[] = [];

  const erros: Erro[] = [];

  dados.forEach((linha, indice) => {
    const codigo = converterTexto(linha[mapa.codigo!]);

    const estoque = converterNumero(linha[mapa.estoque!]);

    const preco = converterNumero(linha[mapa.preco!]);

    const preco_promocional = converterNumero(linha[mapa.preco_promocional!]);

    if (!codigo) {
      erros.push({
        linha: indice + 2,
        motivo: "Código vazio",
      });

      return;
    }

    if (estoque === null) {
      erros.push({
        linha: indice + 2,
        motivo: `Estoque inválido para o código ${codigo}`,
      });

      return;
    }

    linhas.push({
      codigo,

      nome: mapa.nome ? converterTexto(linha[mapa.nome]) : null,

      preco,

      preco_promocional,

      estoque: Math.max(0, Math.round(estoque)),

      codigo_barras: mapa.codigo_barras ? converterTexto(linha[mapa.codigo_barras]) : null,

      fabricante: mapa.fabricante ? converterTexto(linha[mapa.fabricante]) : null,

      unidade: mapa.unidade ? converterTexto(linha[mapa.unidade]) : null,
    });
  });

  if (linhas.length === 0) {
    throw new Error("Nenhuma linha válida foi encontrada.");
  }

  return {
    linhas,
    erros,
  };
}

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

export function ImportarEstoque({ onConcluido }: { onConcluido?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const enviarLote = useServerFn(enviarLoteImportacao);

  const pedirResumo = useServerFn(resumoImportacao);

  const aplicar = useServerFn(aplicarImportacao);

  const cancelar = useServerFn(cancelarImportacao);

  const [aberto, setAberto] = useState(false);

  const [ocupado, setOcupado] = useState(false);

  const [progresso, setProgresso] = useState("");

  const [arquivoNome, setArquivoNome] = useState("");

  const [batchId, setBatchId] = useState<string | null>(null);

  const [resumo, setResumo] = useState<Resumo | null>(null);

  const [errosArquivo, setErrosArquivo] = useState<Erro[]>([]);

  const [resultado, setResultado] = useState<Resultado | null>(null);

  function reiniciar() {
    setBatchId(null);
    setResumo(null);
    setErrosArquivo([]);
    setResultado(null);
    setArquivoNome("");
    setProgresso("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function selecionarArquivo(arquivo: File) {
    setOcupado(true);

    setResultado(null);
    setResumo(null);

    setArquivoNome(arquivo.name);

    const novoBatch = crypto.randomUUID();

    try {
      setProgresso("Lendo a planilha...");

      const { linhas, erros } = await lerPlanilha(arquivo);

      setErrosArquivo(erros);

      const TAMANHO_LOTE = 1500;

      for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
        const fim = Math.min(i + TAMANHO_LOTE, linhas.length);

        setProgresso(`Enviando ${fim} de ${linhas.length} produtos...`);

        await enviarLote({
          data: {
            batchId: novoBatch,
            linhas: linhas.slice(i, i + TAMANHO_LOTE),
          },
        });
      }

      setProgresso("Calculando resumo...");

      const resposta = await pedirResumo({
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
        // Ignora erro de limpeza.
      }

      reiniciar();

      toast.error(erro instanceof Error ? erro.message : "Não foi possível importar a planilha.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!batchId) {
      return;
    }

    setOcupado(true);

    setProgresso("Sincronizando produtos...");

    try {
      const resposta = await aplicar({
        data: {
          batchId,
        },
      });

      setResultado(resposta);

      setResumo(null);

      setBatchId(null);

      toast.success("Produtos sincronizados com sucesso.");

      onConcluido?.();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Erro ao sincronizar os produtos.");
    } finally {
      setOcupado(false);
      setProgresso("");
    }
  }

  async function fechar() {
    if (ocupado) {
      return;
    }

    if (batchId) {
      try {
        await cancelar({
          data: {
            batchId,
          },
        });
      } catch {
        // Ignora erro de limpeza.
      }
    }

    setAberto(false);

    reiniciar();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => {
          const arquivo = event.target.files?.[0];

          if (arquivo) {
            void selecionarArquivo(arquivo);
          }
        }}
      />

      <Button variant="outline" disabled={ocupado} onClick={() => inputRef.current?.click()}>
        {ocupado && !aberto ? "Lendo planilha..." : "Importar Estoque"}
      </Button>

      <Dialog
        open={aberto}
        onOpenChange={(valor) => {
          if (valor) {
            setAberto(true);
          } else {
            void fechar();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{resultado ? "Sincronização concluída" : "Confirmar importação"}</DialogTitle>
          </DialogHeader>

          {arquivoNome && <p className="text-sm text-muted-foreground">Arquivo: {arquivoNome}</p>}

          {progresso && <p className="text-sm font-medium">{progresso}</p>}

          {resumo && (
            <div className="space-y-2 text-sm">
              <Linha rotulo="Produtos encontrados" valor={resumo.encontrados} />

              <Linha rotulo="Produtos atualizados" valor={resumo.atualizar} />

              <Linha rotulo="Produtos novos" valor={resumo.novos} />

              <Linha rotulo="Produtos removidos" valor={resumo.excluir} destaque />

              <Linha rotulo="Erros" valor={resumo.erros + errosArquivo.length} />

              <Linha rotulo="Produtos duplicados" valor={resumo.duplicados} />

              <Linha rotulo="Produtos atuais no banco" valor={resumo.total_banco} />
            </div>
          )}

          {resultado && (
            <div className="space-y-2 text-sm">
              <Linha rotulo="Produtos atualizados" valor={resultado.atualizados} />

              <Linha rotulo="Produtos inseridos" valor={resultado.inseridos} />

              <Linha rotulo="Produtos excluídos" valor={resultado.excluidos} />

              <Linha rotulo="Erros" valor={resultado.erros + errosArquivo.length} />
            </div>
          )}

          <DialogFooter>
            {resultado ? (
              <Button onClick={() => void fechar()}>Fechar</Button>
            ) : (
              <>
                <Button variant="outline" disabled={ocupado} onClick={() => void fechar()}>
                  Cancelar
                </Button>

                <Button disabled={ocupado || !resumo} onClick={() => void confirmar()}>
                  Confirmar e sincronizar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-1">
      <span className="text-muted-foreground">{rotulo}</span>

      <span className={destaque ? "font-bold text-destructive" : "font-semibold"}>{valor.toLocaleString("pt-BR")}</span>
    </div>
  );
}

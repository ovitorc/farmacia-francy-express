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

/* ============================================================
   LEITURA DA PLANILHA
   ============================================================ */

const CAMPOS = {
  codigo: ["codigo", "cod", "codigointerno", "codproduto", "codigoproduto"],
  nome: ["nome", "descricao", "descricaoproduto", "produto", "nomeproduto"],
  preco: ["preco", "precovenda", "precodevenda", "valor", "valorvenda", "precounitario"],
  estoque: ["estoque", "qtd", "quantidade", "saldo", "estoqueatual", "saldoestoque"],
  codigo_barras: ["codigobarras", "barras", "ean", "codbarras", "gtin"],
  fabricante: ["fabricante", "laboratorio", "marca"],
  unidade: ["unidade", "un", "embalagem", "apresentacao"],
} as const;

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = String(valor).trim().replace(/[^\d,.-]/g, "");
  if (!texto) return null;

  const limpo =
    texto.includes(",") && texto.lastIndexOf(",") > texto.lastIndexOf(".")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(/,/g, "");

  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === "" ? null : t;
}

type Erro = { linha: number; motivo: string };

async function lerPlanilha(arquivo: File): Promise<{ linhas: LinhaImportacao[]; erros: Erro[] }> {
  const XLSX = await import("xlsx");

  const buffer = await arquivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", raw: false });

  const nomeAba = wb.SheetNames[0];
  if (!nomeAba) throw new Error("A planilha está vazia.");

  const aba = wb.Sheets[nomeAba]!;
  const bruto = XLSX.utils.sheet_to_json<Record<string, unknown>>(aba, { defval: "", raw: false });

  if (bruto.length === 0) throw new Error("Nenhuma linha de dados encontrada na planilha.");

  const cabecalhos = Object.keys(bruto[0]!);
  const mapa: Partial<Record<keyof typeof CAMPOS, string>> = {};

  for (const [campo, apelidos] of Object.entries(CAMPOS) as [keyof typeof CAMPOS, readonly string[]][]) {
    const achado = cabecalhos.find((c) => apelidos.includes(normalizar(c)));
    if (achado) mapa[campo] = achado;
  }

  if (!mapa.codigo) {
    throw new Error(`A planilha precisa ter a coluna "Código". Colunas encontradas: ${cabecalhos.join(", ")}`);
  }
  if (!mapa.estoque) {
    throw new Error(`A planilha precisa ter a coluna "Estoque". Colunas encontradas: ${cabecalhos.join(", ")}`);
  }

  const linhas: LinhaImportacao[] = [];
  const erros: Erro[] = [];

  bruto.forEach((linha, indice) => {
    const codigo = texto(linha[mapa.codigo!]);
    const estoque = numero(linha[mapa.estoque!]);

    if (!codigo) {
      erros.push({ linha: indice + 2, motivo: "Código vazio" });
      return;
    }
    if (estoque === null) {
      erros.push({ linha: indice + 2, motivo: `Estoque inválido (código ${codigo})` });
      return;
    }

    linhas.push({
      codigo,
      nome: mapa.nome ? texto(linha[mapa.nome]) : null,
      preco: mapa.preco ? numero(linha[mapa.preco]) : null,
      estoque: Math.max(0, Math.round(estoque)),
      codigo_barras: mapa.codigo_barras ? texto(linha[mapa.codigo_barras]) : null,
      fabricante: mapa.fabricante ? texto(linha[mapa.fabricante]) : null,
      unidade: mapa.unidade ? texto(linha[mapa.unidade]) : null,
    });
  });

  if (linhas.length === 0) throw new Error("Nenhuma linha válida encontrada na planilha.");

  return { linhas, erros };
}

/* ============================================================
   COMPONENTE
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
    if (inputRef.current) inputRef.current.value = "";
  }

  async function selecionarArquivo(arquivo: File) {
    setOcupado(true);
    setResultado(null);
    setResumo(null);
    setArquivoNome(arquivo.name);

    const novoBatch = crypto.randomUUID();

    try {
      setProgresso("Lendo e validando a planilha...");
      const { linhas, erros } = await lerPlanilha(arquivo);
      setErrosArquivo(erros);

      const TAMANHO = 1500;
      for (let i = 0; i < linhas.length; i += TAMANHO) {
        setProgresso(`Enviando ${Math.min(i + TAMANHO, linhas.length)} de ${linhas.length} linhas...`);
        await enviarLote({ data: { batchId: novoBatch, linhas: linhas.slice(i, i + TAMANHO) } });
      }

      setProgresso("Calculando o resumo...");
      const r = await pedirResumo({ data: { batchId: novoBatch } });

      setBatchId(novoBatch);
      setResumo(r);
      setAberto(true);
      setProgresso("");
    } catch (erro) {
      try {
        await cancelar({ data: { batchId: novoBatch } });
      } catch {
        /* nada a limpar */
      }
      reiniciar();
      toast.error(erro instanceof Error ? erro.message : "Não foi possível ler a planilha.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!batchId) return;

    setOcupado(true);
    setProgresso("Sincronizando o banco de dados...");

    try {
      const r = await aplicar({ data: { batchId } });
      setResultado(r);
      setResumo(null);
      setBatchId(null);
      toast.success("Estoque sincronizado com sucesso.");
      onConcluido?.();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao sincronizar o estoque.");
    } finally {
      setOcupado(false);
      setProgresso("");
    }
  }

  async function fechar() {
    if (ocupado) return;

    if (batchId) {
      try {
        await cancelar({ data: { batchId } });
      } catch {
        /* nada a limpar */
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
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) void selecionarArquivo(arquivo);
        }}
      />

      <Button variant="outline" disabled={ocupado} onClick={() => inputRef.current?.click()}>
        {ocupado && !aberto ? "Lendo planilha..." : "Importar Estoque"}
      </Button>

      <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : void fechar())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{resultado ? "Sincronização concluída" : "Confirmar importação de estoque"}</DialogTitle>
          </DialogHeader>

          {arquivoNome ? <p className="text-sm text-muted-foreground">Arquivo: {arquivoNome}</p> : null}

          {progresso ? <p className="text-sm font-medium text-primary">{progresso}</p> : null}

          {resumo ? (
            <div className="space-y-2 text-sm">
              <Linha rotulo="Produtos encontrados no Excel" valor={resumo.encontrados} />
              <Linha rotulo="Produtos que serão atualizados" valor={resumo.atualizar} />
              <Linha rotulo="Produtos novos" valor={resumo.novos} />
              <Linha rotulo="Produtos que serão excluídos" valor={resumo.excluir} destaque />
              <Linha rotulo="Linhas com erro (ignoradas)" valor={resumo.erros + errosArquivo.length} />
              <Linha rotulo="Códigos repetidos na planilha" valor={resumo.duplicados} />
              <Linha rotulo="Produtos hoje no banco" valor={resumo.total_banco} />

              {errosArquivo.length > 0 ? (
                <div className="mt-3 max-h-32 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs">
                  {errosArquivo.slice(0, 30).map((e) => (
                    <p key={`${e.linha}-${e.motivo}`}>
                      Linha {e.linha}: {e.motivo}
                    </p>
                  ))}
                  {errosArquivo.length > 30 ? <p>… e mais {errosArquivo.length - 30} linhas com erro.</p> : null}
                </div>
              ) : null}

              <p className="mt-3 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                Atenção: os {resumo.excluir} produtos ausentes na planilha serão removidos do site. Somente estoque e
                preço de venda são alterados nos produtos existentes.
              </p>
            </div>
          ) : null}

          {resultado ? (
            <div className="space-y-2 text-sm">
              <Linha rotulo="Produtos atualizados" valor={resultado.atualizados} />
              <Linha rotulo="Produtos inseridos" valor={resultado.inseridos} />
              <Linha rotulo="Produtos excluídos" valor={resultado.excluidos} />
              <Linha rotulo="Erros" valor={resultado.erros + errosArquivo.length} />
            </div>
          ) : null}

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
      <span className={destaque ? "font-bold text-destructive" : "font-semibold text-foreground"}>
        {valor.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

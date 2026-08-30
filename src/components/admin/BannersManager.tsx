import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  listarBannersAdmin,
  salvarBanner,
  excluirBanner,
  enviarImagem,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function BannersManager() {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarBannersAdmin);
  const salvar = useServerFn(salvarBanner);
  const excluir = useServerFn(excluirBanner);
  const upload = useServerFn(enviarImagem);

  const { data: banners = [] } = useQuery({
    queryKey: ["banners-admin"],
    queryFn: () => listar(),
  });

  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function atualizar() {
    await queryClient.invalidateQueries({ queryKey: ["banners-admin"] });
    await queryClient.invalidateQueries({ queryKey: ["banners"] });
  }

  async function adicionar(file: File) {
    setEnviando(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binario = "";
      for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i]!);
      const { url } = await upload({
        data: {
          nomeArquivo: file.name,
          tipo: file.type || "image/jpeg",
          conteudoBase64: btoa(binario),
        },
      });
      await salvar({
        data: {
          imagem: url,
          titulo: "",
          link: null,
          ordem: banners.length,
          ativo: true,
        },
      });
      await atualizar();
      toast.success("Banner adicionado.");
    } catch {
      toast.error("Não foi possível enviar o banner.");
    } finally {
      setEnviando(false);
    }
  }

  async function alterar(
    b: { id: string; imagem: string; titulo: string; link: string | null; ordem: number; ativo: boolean },
    campos: Partial<{ titulo: string; link: string | null; ordem: number; ativo: boolean }>,
  ) {
    setOcupado(b.id);
    try {
      await salvar({ data: { ...b, ...campos } });
      await atualizar();
    } catch {
      toast.error("Não foi possível salvar o banner.");
    } finally {
      setOcupado(null);
    }
  }

  async function remover(id: string) {
    if (!confirm("Excluir este banner?")) return;
    setOcupado(id);
    try {
      await excluir({ data: { id } });
      await atualizar();
      toast.success("Banner excluído.");
    } catch {
      toast.error("Não foi possível excluir o banner.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-primary">Banners da página inicial</h2>
          <p className="text-sm text-muted-foreground">
            {banners.length} banner(s). Imagens retangulares (recomendado 1600×600). Trocam a cada 4
            segundos.
          </p>
        </div>
        <div>
          <Input
            type="file"
            accept="image/*"
            disabled={enviando}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void adicionar(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {banners.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="h-16 w-40 shrink-0 overflow-hidden rounded border bg-muted">
              <img src={b.imagem} alt={b.titulo} className="h-full w-full object-cover" />
            </div>

            <div className="grid min-w-56 flex-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs">Título (alt)</Label>
                <Input
                  defaultValue={b.titulo}
                  onBlur={(e) =>
                    e.target.value !== b.titulo && void alterar(b, { titulo: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Link (opcional)</Label>
                <Input
                  defaultValue={b.link ?? ""}
                  placeholder="/farmacia-popular"
                  onBlur={(e) =>
                    e.target.value !== (b.link ?? "") &&
                    void alterar(b, { link: e.target.value.trim() || null })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ordem</Label>
                <Input
                  type="number"
                  defaultValue={b.ordem}
                  onBlur={(e) =>
                    Number(e.target.value) !== b.ordem &&
                    void alterar(b, { ordem: Number(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={b.ativo}
                disabled={ocupado === b.id}
                onCheckedChange={(v) => void alterar(b, { ativo: v })}
              />
              Ativo
            </label>

            <Button
              size="sm"
              variant="destructive"
              disabled={ocupado === b.id}
              onClick={() => void remover(b.id)}
            >
              Excluir
            </Button>
          </div>
        ))}

        {banners.length === 0 ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            Nenhum banner cadastrado. Envie uma imagem para começar.
          </p>
        ) : null}
      </div>
    </section>
  );
}

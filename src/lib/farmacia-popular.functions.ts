import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ehAbsorvente, ehFralda, intervaloDoMedicamento, type ItemFarmaciaPopular } from "@/lib/farmacia-popular";

/* ============================================================
   CLIENTE PÚBLICO
   ============================================================ */

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);

        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }

        h.set("apikey", key);

        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const CHAVE_INTERVALO_ABSORVENTES = "intervalo_absorventes_dias";

/* ============================================================
   DADOS DA ABA FARMÁCIA POPULAR
   ============================================================ */

export const obterFarmaciaPopular = createServerFn({
  method: "GET",
}).handler(async () => {
  const supabase = publicClient();

  const [produtosResp, configResp] = await Promise.all([
    supabase
      .from("produtos")
      .select("id, nome, principio_ativo")
      .eq("farmacia_popular", true)
      .order("nome", { ascending: true }),

    supabase.from("configuracoes").select("valor").eq("chave", CHAVE_INTERVALO_ABSORVENTES).maybeSingle(),
  ]);

  if (produtosResp.error) {
    throw new Error(produtosResp.error.message);
  }

  const medicamentos: ItemFarmaciaPopular[] = (produtosResp.data ?? [])
    .filter((p) => !ehFralda(p.nome) && !ehAbsorvente(p.nome))
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      principioAtivo: p.principio_ativo ?? "",
      intervalo: intervaloDoMedicamento(p.nome, p.principio_ativo ?? ""),
    }));

  const intervaloAbsorventes = Number(configResp.data?.valor ?? 56);

  return {
    medicamentos,
    intervaloAbsorventes: Number.isFinite(intervaloAbsorventes) && intervaloAbsorventes > 0 ? intervaloAbsorventes : 56,
  };
});

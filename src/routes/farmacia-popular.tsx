import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, CheckCircle2, CalendarClock, Baby, HeartHandshake, Pill } from "lucide-react";
import popularAsset from "@/assets/farmacia-popular.png.asset.json";
import { WHATSAPP_URL } from "@/lib/catalog";
import { obterFarmaciaPopular } from "@/lib/farmacia-popular.functions";
import {
  INTERVALO_FRALDAS,
  LIMITE_FRALDAS,
  diasRestantes,
  formatarData,
  formatarDataIso,
  somarDias,
  type ItemFarmaciaPopular,
} from "@/lib/farmacia-popular";

export const Route = createFileRoute("/farmacia-popular")({
  head: () => ({
    meta: [
      { title: "Aqui tem Farmácia Popular | Farmácias Francy" },
      {
        name: "description",
        content:
          "A Farmácias Francy é credenciada ao Farmácia Popular: calcule a data da próxima retirada de medicamentos, fraldas geriátricas e absorventes.",
      },
      { property: "og:title", content: "Aqui tem Farmácia Popular | Farmácias Francy" },
      {
        property: "og:description",
        content: "Calcule a previsão da próxima retirada do seu benefício do Farmácia Popular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PopularPage,
});

const grupos = [
  { titulo: "Gratuitos", itens: ["Hipertensão", "Diabetes", "Asma"] },
  {
    titulo: "Com desconto",
    itens: ["Colesterol", "Rinite", "Parkinson", "Osteoporose", "Glaucoma", "Contraceptivos", "Fraldas geriátricas"],
  },
];

const passos = [
  "Leve um documento oficial com foto e o CPF do paciente.",
  "Apresente a receita médica dentro do prazo de validade (até 180 dias).",
  "Nossa equipe faz o cadastro e a retirada na hora, direto no balcão.",
];

/* ============================================================
   RESULTADO
   ============================================================ */

function Resultado({ dataIso, intervalo }: { dataIso: string; intervalo: number }) {
  const proxima = dataIso ? somarDias(dataIso, intervalo) : null;

  if (!proxima) {
    return null;
  }

  const faltam = diasRestantes(proxima);

  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary-soft p-4">
      <p className="text-sm text-primary/80">
        Última retirada: <strong className="font-bold text-primary">{formatarDataIso(dataIso)}</strong>
      </p>
      <p className="mt-1 text-base text-primary/80">
        Próxima retirada:{" "}
        <strong className="text-lg font-bold text-brand-red">{formatarData(proxima)}</strong>
      </p>
      <p className="mt-2 flex items-center gap-2 text-xs text-primary/70">
        <CalendarClock className="size-4" />
        {faltam === 0 ? "A retirada já pode ser feita." : `Faltam ${faltam} dia(s) — intervalo de ${intervalo} dias.`}
      </p>
    </div>
  );
}

function CampoData({
  id,
  valor,
  onChange,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        Data da última retirada
      </label>
      <input
        id={id}
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
    </div>
  );
}

/* ============================================================
   SEÇÃO: MEDICAMENTOS
   ============================================================ */

function SecaoMedicamentos({ medicamentos, carregando }: { medicamentos: ItemFarmaciaPopular[]; carregando: boolean }) {
  const [selecionado, setSelecionado] = useState("");
  const [data, setData] = useState("");

  const item = useMemo(() => medicamentos.find((m) => m.id === selecionado), [medicamentos, selecionado]);

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
        <Pill className="size-5 text-brand-red" /> Medicamentos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha o medicamento e informe a data da última retirada para ver a previsão da próxima.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="medicamento" className="text-xs font-semibold text-muted-foreground">
            Medicamento
          </label>
          <select
            id="medicamento"
            value={selecionado}
            onChange={(e) => setSelecionado(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">{carregando ? "Carregando..." : "Selecione o medicamento"}</option>
            {medicamentos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <CampoData id="data-medicamento" valor={data} onChange={setData} />
      </div>

      {item && data ? <Resultado dataIso={data} intervalo={item.intervalo} /> : null}
    </section>
  );
}

/* ============================================================
   SEÇÃO: FRALDAS
   ============================================================ */

function SecaoFraldas() {
  const [data, setData] = useState("");

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
        <Baby className="size-5 text-brand-red" /> Fraldas Geriátricas
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Limite considerado: {LIMITE_FRALDAS}. Informe a data da última retirada.
      </p>

      <div className="mt-4 max-w-xs">
        <CampoData id="data-fraldas" valor={data} onChange={setData} />
      </div>

      {data ? <Resultado dataIso={data} intervalo={INTERVALO_FRALDAS} /> : null}
    </section>
  );
}

/* ============================================================
   SEÇÃO: DIGNIDADE MENSTRUAL
   ============================================================ */

function SecaoDignidade({ intervalo }: { intervalo: number }) {
  const [data, setData] = useState("");

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
        <HeartHandshake className="size-5 text-brand-red" /> Dignidade Menstrual
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Absorventes — intervalo atual do benefício: {intervalo} dias.
      </p>

      <div className="mt-4 max-w-xs">
        <CampoData id="data-absorventes" valor={data} onChange={setData} />
      </div>

      {data ? <Resultado dataIso={data} intervalo={intervalo} /> : null}
    </section>
  );
}

/* ============================================================
   PÁGINA
   ============================================================ */

function PopularPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["farmacia-popular"],
    queryFn: () => obterFarmaciaPopular(),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>{" "}
        / Farmácia Popular
      </p>

      <div className="mt-4 grid items-center gap-8 rounded-2xl border border-border bg-card p-6 md:grid-cols-[220px_1fr] md:p-10">
        <img src={popularAsset.url} alt="Selo Aqui tem Farmácia Popular" className="mx-auto w-40 md:w-full" />
        <div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">Aqui tem Farmácia Popular</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A Farmácias Francy é credenciada ao programa do Governo Federal que oferece medicamentos gratuitos ou com
            até 90% de desconto para tratamentos contínuos. Atendimento humano, de bairro, com a credibilidade popular
            de sempre.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-3 text-sm font-bold text-brand-red-foreground transition-opacity hover:opacity-90"
          >
            <MessageCircle className="size-4" /> Tirar dúvidas pelo WhatsApp
          </a>
        </div>
      </div>

      {/* CALCULADORA DA PRÓXIMA RETIRADA */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-primary">Calcule sua próxima retirada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe a data da última retirada e veja a previsão da próxima. É apenas uma previsão informativa: não há
          venda, reserva ou retirada pelo site.
        </p>

        <div className="mt-5 grid gap-4">
          <SecaoMedicamentos medicamentos={data?.medicamentos ?? []} carregando={isLoading} />
          <SecaoFraldas />
          <SecaoDignidade intervalo={data?.intervaloAbsorventes ?? 56} />
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {grupos.map((g) => (
          <section key={g.titulo} className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-bold text-primary">{g.titulo}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {g.itens.map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-brand-red" />
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-xl bg-primary-soft p-6">
        <h2 className="text-lg font-bold text-primary">Como retirar</h2>
        <ol className="mt-3 space-y-3 text-sm text-primary/80">
          {passos.map((p, i) => (
            <li key={p} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              {p}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-primary/70">
          A disponibilidade dos medicamentos segue as regras do programa e o estoque da loja.
        </p>
      </section>
    </div>
  );
}

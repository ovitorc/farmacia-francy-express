import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import popularAsset from "@/assets/farmacia-popular.png.asset.json";
import { WHATSAPP_URL } from "@/lib/catalog";

export const Route = createFileRoute("/farmacia-popular")({
  head: () => ({
    meta: [
      { title: "Aqui tem Farmácia Popular | Farmácias Francy" },
      {
        name: "description",
        content:
          "A Farmácias Francy é credenciada ao programa Farmácia Popular: medicamentos gratuitos ou com desconto mediante receita e documentos.",
      },
      { property: "og:title", content: "Aqui tem Farmácia Popular | Farmácias Francy" },
      {
        property: "og:description",
        content: "Medicamentos gratuitos ou com desconto pelo programa Farmácia Popular.",
      },
    ],
  }),
  component: PopularPage,
});

const grupos = [
  {
    titulo: "Gratuitos",
    itens: ["Hipertensão", "Diabetes", "Asma"],
  },
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

export default function _unusedGuard() {
  return null;
}

function PopularPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">
          Início
        </Link>{" "}
        / Farmácia Popular
      </p>

      <div className="mt-4 grid items-center gap-8 rounded-2xl border border-border bg-card p-6 md:grid-cols-[220px_1fr] md:p-10">
        <img
          src={popularAsset.url}
          alt="Selo Aqui tem Farmácia Popular"
          className="mx-auto w-40 md:w-full"
        />
        <div>
          <h1 className="text-2xl font-bold text-primary sm:text-3xl">
            Aqui tem Farmácia Popular
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A Farmácias Francy é credenciada ao programa do Governo Federal que oferece
            medicamentos gratuitos ou com até 90% de desconto para tratamentos contínuos. Atendimento
            humano, de bairro, com a credibilidade popular de sempre.
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

      <div className="mt-8 grid gap-4 md:grid-cols-2">
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

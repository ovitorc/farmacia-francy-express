import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Mail, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";

const EMAIL = "curriculo@farmaciasfrancy.com.br";
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent("Currículo — Candidatura")}`;

export const Route = createFileRoute("/trabalhe-conosco")({
  head: () => ({
    meta: [
      { title: "Trabalhe Conosco — Farmácias Francy" },
      {
        name: "description",
        content:
          "Faça parte do time Farmácias Francy. Envie seu currículo para curriculo@farmaciasfrancy.com.br e venha fazer parte da nossa equipe.",
      },
      { property: "og:title", content: "Trabalhe Conosco — Farmácias Francy" },
      {
        property: "og:description",
        content: "Envie seu currículo para curriculo@farmaciasfrancy.com.br e venha fazer parte do nosso time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrabalheConosco,
});

function TrabalheConosco() {
  const [copiado, setCopiado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copiar = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(EMAIL);
      } else {
        const campo = document.createElement("textarea");
        campo.value = EMAIL;
        campo.setAttribute("readonly", "");
        campo.style.position = "fixed";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        document.execCommand("copy");
        document.body.removeChild(campo);
      }

      setCopiado(true);

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl overflow-x-hidden px-4 py-8 sm:px-6 sm:py-12">
      {/* DESTAQUE */}
      <section className="rounded-2xl bg-primary px-5 py-8 text-center text-primary-foreground sm:px-10 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/80">Trabalhe Conosco</p>

        <h1 className="mt-3 text-balance text-2xl font-black uppercase leading-tight sm:text-4xl">
          Esta vaga é a sua chance!
        </h1>

        <p className="mt-2 text-balance text-lg font-bold uppercase text-brand-red-foreground sm:text-2xl">
          <span className="inline-block rounded-lg bg-brand-red px-3 py-1">Venha fazer parte do nosso time!</span>
        </p>

        <p className="mx-auto mt-5 max-w-xl text-pretty text-sm leading-relaxed text-primary-foreground/90 sm:text-base">
          Faça parte do time Farmácias Francy. Envie seu currículo e venha fazer parte da nossa equipe.
        </p>
      </section>

      {/* E-MAIL EM DESTAQUE */}
      <section className="mt-6 rounded-2xl border border-border bg-muted/40 px-4 py-8 text-center sm:px-8">
        <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Envie seu currículo para:</p>

        <a
          href={MAILTO}
          className="mt-2 block break-all text-lg font-black text-primary underline-offset-4 hover:underline sm:text-3xl"
        >
          {EMAIL}
        </a>

        <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-3">
          <Button asChild size="lg" className="h-12 w-full gap-2 text-sm sm:text-base">
            <a href={MAILTO}>
              <Mail className="size-5 shrink-0" />
              <span className="truncate">Enviar currículo por e-mail</span>
            </a>
          </Button>

          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={copiar}
            className="h-12 w-full gap-2 text-sm sm:text-base"
          >
            {copiado ? <Check className="size-5 shrink-0" /> : <Copy className="size-5 shrink-0" />}
            <span className="truncate">{copiado ? "E-mail copiado!" : "Copiar e-mail"}</span>
          </Button>
        </div>
      </section>

      {/* QR CODE */}
      <section className="mt-6 rounded-2xl border border-border bg-card px-4 py-8 text-center sm:px-8">
        <h2 className="flex items-center justify-center gap-2 text-base font-bold uppercase text-primary sm:text-lg">
          <QrCode className="size-5 shrink-0" /> QR Code
        </h2>

        <div className="mx-auto mt-5 w-full max-w-[260px] rounded-xl bg-white p-4 shadow-card">
          <QRCodeSVG value={MAILTO} level="M" marginSize={2} className="h-auto w-full" title="Enviar currículo" />
        </div>

        <p className="mx-auto mt-4 max-w-md text-pretty text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-sm">
          Aponte a câmera do seu celular para o QR Code e envie seu currículo.
        </p>
      </section>

      {/* ORIENTAÇÕES */}
      <section className="mt-6 rounded-2xl border border-border bg-card px-4 py-7 sm:px-8">
        <h2 className="text-base font-bold uppercase text-primary sm:text-lg">Como enviar seu currículo</h2>

        <ol className="mt-4 space-y-3">
          {[
            "Clique em 'Enviar currículo por e-mail' ou escaneie o QR Code.",
            "Anexe seu currículo ao e-mail.",
            "Informe no corpo do e-mail seu nome, telefone e a vaga ou área de interesse.",
            `Envie para ${EMAIL}.`,
          ].map((texto, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>

              <span className="min-w-0 break-words text-sm leading-6 text-foreground">{texto}</span>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-xl border border-dashed border-brand-red/40 bg-brand-red/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-red">Sugestão de assunto do e-mail</p>

          <p className="mt-1 break-words text-sm text-foreground">Currículo — [Nome do candidato] — [Vaga de interesse]</p>

          <p className="mt-1 break-words text-xs text-muted-foreground">Exemplo: Currículo — João da Silva — Balconista</p>
        </div>
      </section>
    </main>
  );
}

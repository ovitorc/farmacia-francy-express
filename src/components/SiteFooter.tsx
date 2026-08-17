import { Link } from "@tanstack/react-router";
import { Instagram, MessageCircle, Mail, MapPin, Clock } from "lucide-react";
import logoAsset from "@/assets/logo.png.asset.json";
import { categorias, INSTAGRAM_URL, WHATSAPP_URL } from "@/lib/catalog";

const pagamentos = ["Débito", "Crédito", "PIX", "Crédito via link", "PIX via link"];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-4">
        <div className="space-y-4">
          <img
            src={logoAsset.url}
            alt="Farmácias Francy"
            className="h-16 w-auto rounded-md object-contain"
          />
          <p className="text-sm text-primary-foreground/80">
            Credibilidade popular. Sua farmácia de bairro, agora também online.
          </p>
          <div className="flex gap-3">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-2 text-xs font-semibold text-brand-red-foreground transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" /> WhatsApp
            </a>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/30 px-4 py-2 text-xs font-semibold transition-colors hover:bg-primary-foreground/10"
            >
              <Instagram className="size-4" /> Siga a Farmácias Francy
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Categorias</h3>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            {categorias.slice(0, 7).map((c) => (
              <li key={c.slug}>
                <Link to="/categoria/$slug" params={{ slug: c.slug }} className="hover:underline">
                  {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide">Formas de pagamento</h3>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            {pagamentos.map((p) => (
              <li key={p} className="rounded-md border border-primary-foreground/20 px-3 py-1.5">
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 text-sm text-primary-foreground/80">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground">
            Atendimento
          </h3>
          <p className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            Rua Professor José Holmes, 230 - Ernani Sátiro, João Pessoa - PB
          </p>
          <p className="flex gap-2">
            <Clock className="mt-0.5 size-4 shrink-0" />
            Segunda a sexta, das 8h00 às 17h30
          </p>
          <p className="flex gap-2">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <a href="mailto:farmaciasfrancy@hotmail.com" className="hover:underline">
              farmaciasfrancy@hotmail.com
            </a>
          </p>
          <div className="pt-2">
            <Link
              to="/farmacia-popular"
              className="inline-block rounded-md border border-primary-foreground/25 px-3 py-2 text-xs font-semibold"
            >
              Aqui tem Farmácia Popular
            </Link>
          </div>
          <div className="pt-4">
            <div className="inline-flex items-center gap-2 rounded-md bg-background px-3 py-2">
              <span className="text-xs font-bold tracking-widest text-primary">ANVISA</span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                Agência Nacional de
                <br />
                Vigilância Sanitária
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto max-w-7xl space-y-2 px-6 py-8 text-[11px] leading-relaxed text-primary-foreground/60">
          <p>
            Copyright © 2026 Farmácias Francy — Direitos reservados. RAZÃO SOCIAL | CNPJ:
            03208714000188 | End: Rua Professor José Holmes, 230 - Ernani Sátiro, João Pessoa - PB |
            CEP: 57.051-000 | Farmacêutica Diretora: Suenia Monteiro, CRF/AL Nº 2558.
          </p>
          <p>
            Os valores exibidos aplicam-se unicamente aos itens vendidos pela Loja Virtual da
            Farmácias Francy.
          </p>
          <p>Atendimento de segunda a sexta-feira, das 8h00 às 17h30. E-mail: farmaciasfrancy@hotmail.com.</p>
          <p>
            O conteúdo publicado neste site tem finalidade apenas informativa: ele não serve de base
            para automedicação e não substitui a consulta, a orientação ou a receita de profissionais
            de saúde habilitados. Somente um médico é capaz de diagnosticar e indicar o tratamento
            correto. Se os sintomas continuarem, busque atendimento médico.
          </p>
          <p>
            A Farmácias Francy emprega recursos e tecnologias de proteção de dados para oferecer
            segurança e tranquilidade a quem utiliza o site.
          </p>
          <p>Zelar pela privacidade e pela segurança dos clientes é um compromisso da Farmácias Francy.</p>
          <p>
            Todo pedido feito pelo site depende da confirmação de que os produtos estão disponíveis em
            estoque.
          </p>
        </div>
      </div>
    </footer>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Minus,
  Plus,
  Trash2,
  MessageCircle,
  ShoppingCart,
  User,
  MapPin,
  Banknote,
  CreditCard,
  Smartphone,
  Link2,
  Navigation,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { ProductImage } from "@/components/ProductCard";
import { useCart } from "@/lib/cart";
import { formatarPreco, precoFinal } from "@/lib/catalog";
import {
  FORMAS_PAGAMENTO,
  UNIDADES_ATIVAS,
  distanciaKm,
  enderecoUnidade,
  formatarDistancia,
  linkWhatsAppComTexto,
  rotuloPagamento,
  unidadeMaisProxima,
  type FormaPagamento,
  type Unidade,
} from "@/lib/pharmacies";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Meu carrinho | Farmácias Francy" },
      {
        name: "description",
        content:
          "Revise os itens do seu pedido, informe seus dados e finalize a compra pelo WhatsApp da Farmácia Francy mais próxima de você.",
      },
      { property: "og:title", content: "Meu carrinho | Farmácias Francy" },
      {
        property: "og:description",
        content: "Finalize seu pedido da Farmácias Francy pelo WhatsApp.",
      },
    ],
  }),
  component: CarrinhoPage,
});

type Endereco = {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

const ENDERECO_VAZIO: Endereco = {
  cep: "",
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

const iconePagamento: Record<FormaPagamento, typeof Banknote> = {
  cash: Banknote,
  debit_machine: CreditCard,
  credit_machine: CreditCard,
  pix_machine: Smartphone,
  pix_link: Link2,
  credit_link: Link2,
};

type Fase = "form" | "calculando" | "confirmar" | "lista";

function CarrinhoPage() {
  const { itens, total, definirQuantidade, remover, limpar } = useCart();

  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState<Endereco>(ENDERECO_VAZIO);
  const [pagamento, setPagamento] = useState<FormaPagamento | null>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [fase, setFase] = useState<Fase>("form");
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);
  const resolverUnidade = useServerFn(unidadeMaisProximaDoEndereco);
  const [selecionada, setSelecionada] = useState<{
    unidade: Unidade;
    distancia: number | null;
    duracaoMin: number | null;
    porRota: boolean;
  } | null>(null);

  function atualizarEndereco(campo: keyof Endereco, valor: string) {
    setEndereco((prev) => ({ ...prev, [campo]: valor }));
  }

  async function buscarCep(valor: string) {
    const digitos = valor.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = (await resp.json()) as {
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
        erro?: boolean | string;
      };
      if (!dados.erro) {
        setEndereco((prev) => ({
          ...prev,
          rua: dados.logradouro || prev.rua,
          bairro: dados.bairro || prev.bairro,
          cidade: dados.localidade || prev.cidade,
          estado: dados.uf || prev.estado,
        }));
      }
    } catch {
      /* silencioso: o cliente pode preencher manualmente */
    } finally {
      setBuscandoCep(false);
    }
  }

  function validar(): string[] {
    const lista: string[] = [];
    if (itens.length === 0) lista.push("Adicione produtos ao carrinho para continuar.");
    if (!nome.trim()) lista.push("Preencha seu nome para continuar.");
    if (
      !endereco.cep.trim() ||
      !endereco.rua.trim() ||
      !endereco.numero.trim() ||
      !endereco.bairro.trim() ||
      !endereco.cidade.trim() ||
      !endereco.estado.trim()
    )
      lista.push("Informe o endereço de entrega completo.");
    if (!pagamento) lista.push("Selecione uma forma de pagamento.");
    return lista;
  }

  async function iniciarFinalizacao() {
    const lista = validar();
    setErros(lista);
    if (lista.length > 0) return;
    setAvisoLocal(null);
    setFase("calculando");

    try {
      const resultado = await resolverUnidade({
        data: {
          cep: endereco.cep,
          rua: endereco.rua,
          numero: endereco.numero,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          estado: endereco.estado,
        },
      });

      if (!resultado) {
        setAvisoLocal(
          "Não conseguimos identificar a unidade mais próxima pelo seu endereço.",
        );
        setFase("lista");
        return;
      }

      const unidade = UNIDADES_ATIVAS.find((u) => u.id === resultado.unidadeId);
      if (!unidade) {
        setAvisoLocal("Não encontramos unidades disponíveis.");
        setFase("lista");
        return;
      }

      setAvisoLocal(resultado.aviso);
      setSelecionada({
        unidade,
        distancia: resultado.distanciaKm,
        duracaoMin: resultado.duracaoMin,
        porRota: resultado.origem === "rota",
      });
      setFase("confirmar");
    } catch {
      setAvisoLocal("Não conseguimos identificar a unidade mais próxima pelo seu endereço.");
      setFase("lista");
    }
  }

  function montarMensagem(unidade: Unidade, distancia: number | null) {
    const linhasProdutos = itens.map(
      (i) =>
        `${i.quantidade}x ${i.produto.nome} — ${formatarPreco(precoFinal(i.produto) * i.quantidade)}`,
    );
    const partes = [
      "Olá, Farmácia Francy!",
      "",
      "Gostaria de realizar um pedido pelo site.",
      "",
      "*DADOS DO COMPRADOR*",
      "",
      `Nome: ${nome.trim()}`,
      "",
      "*ENDEREÇO DE ENTREGA*",
      "",
      `CEP: ${endereco.cep}`,
      `Rua: ${endereco.rua}`,
      `Número: ${endereco.numero}`,
      ...(endereco.complemento.trim() ? [`Complemento: ${endereco.complemento}`] : []),
      `Bairro: ${endereco.bairro}`,
      `Cidade: ${endereco.cidade}`,
      `Estado: ${endereco.estado}`,
      "",
      "*FORMA DE PAGAMENTO*",
      "",
      pagamento ? rotuloPagamento(pagamento) : "",
      "",
      "*PRODUTOS*",
      "",
      ...linhasProdutos,
      "",
      "*TOTAL DO PEDIDO*",
      "",
      formatarPreco(total),
      "",
      "*UNIDADE FRANCY*",
      "",
      unidade.name,
      ...(distancia !== null ? [`Distância aproximada: ${formatarDistancia(distancia)}`] : []),
      ...(coords ? [`Localização do cliente: ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`] : []),
      "",
      `Pedido feito em ${new Date().toLocaleString("pt-BR")}`,
    ];
    return partes.join("\n");
  }

  function enviarPedido(unidade: Unidade, distancia: number | null) {
    const url = linkWhatsAppComTexto(unidade.whatsapp_url, montarMensagem(unidade, distancia));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function escolherUnidade(unidade: Unidade) {
    const distancia = coords
      ? distanciaKm(coords.lat, coords.lon, unidade.latitude, unidade.longitude)
      : null;
    setSelecionada({ unidade, distancia });
    setFase("confirmar");
  }

  if (itens.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <ShoppingCart className="mx-auto size-12 text-primary/40" />
        <h1 className="mt-4 text-2xl font-bold text-primary">Seu carrinho está vazio</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore o catálogo e monte seu pedido. A finalização é feita pelo WhatsApp.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold text-primary sm:text-3xl">Meu carrinho</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <ul className="space-y-3">
            {itens.map((item) => {
              const p = item.produto;
              return (
                <li
                  key={p.id}
                  className="flex gap-4 rounded-xl border border-border bg-card p-3 sm:p-4"
                >
                  <Link
                    to="/produto/$id"
                    params={{ id: p.id }}
                    className="size-20 shrink-0 rounded-lg bg-white p-1.5"
                  >
                    <ProductImage produto={p} />
                  </Link>
                  <div className="flex flex-1 flex-col gap-2">
                    <Link
                      to="/produto/$id"
                      params={{ id: p.id }}
                      className="line-clamp-2 text-sm font-medium hover:text-primary"
                    >
                      {p.nome}
                    </Link>
                    <p className="text-xs text-muted-foreground">Código {p.codigo}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center rounded-full border border-border">
                        <button
                          aria-label="Diminuir quantidade"
                          onClick={() => definirQuantidade(p.id, item.quantidade - 1)}
                          className="p-2 text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold">
                          {item.quantidade}
                        </span>
                        <button
                          aria-label="Aumentar quantidade"
                          onClick={() => definirQuantidade(p.id, item.quantidade + 1)}
                          className="p-2 text-muted-foreground transition-colors hover:text-primary"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-primary">
                          {formatarPreco(precoFinal(p) * item.quantidade)}
                        </span>
                        <button
                          aria-label={`Remover ${p.nome}`}
                          onClick={() => remover(p.id)}
                          className="rounded-md p-2 text-muted-foreground transition-colors hover:text-brand-red"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Dados do comprador */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
              <User className="size-4" /> Dados do comprador
            </h2>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Nome completo
              <input
                className={`mt-1 ${inputClass}`}
                value={nome}
                maxLength={100}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite seu nome completo"
              />
            </label>
          </section>

          {/* Endereço */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
              <MapPin className="size-4" /> Endereço de entrega
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-6">
              <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
                CEP
                <div className="relative">
                  <input
                    className={`mt-1 ${inputClass}`}
                    value={endereco.cep}
                    maxLength={9}
                    inputMode="numeric"
                    onChange={(e) => atualizarEndereco("cep", e.target.value)}
                    onBlur={(e) => void buscarCep(e.target.value)}
                    placeholder="00000-000"
                  />
                  {buscandoCep && (
                    <Loader2 className="absolute right-2 top-3.5 size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </label>
              <label className="text-xs font-medium text-muted-foreground sm:col-span-3">
                Rua
                <input
                  className={`mt-1 ${inputClass}`}
                  value={endereco.rua}
                  maxLength={120}
                  onChange={(e) => atualizarEndereco("rua", e.target.value)}
                  placeholder="Nome da rua"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Número
                <input
                  className={`mt-1 ${inputClass}`}
                  value={endereco.numero}
                  maxLength={10}
                  onChange={(e) => atualizarEndereco("numero", e.target.value)}
                  placeholder="123"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground sm:col-span-3">
                Complemento (opcional)
                <input
                  className={`mt-1 ${inputClass}`}
                  value={endereco.complemento}
                  maxLength={80}
                  onChange={(e) => atualizarEndereco("complemento", e.target.value)}
                  placeholder="Apto, bloco, referência"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground sm:col-span-3">
                Bairro
                <input
                  className={`mt-1 ${inputClass}`}
                  value={endereco.bairro}
                  maxLength={80}
                  onChange={(e) => atualizarEndereco("bairro", e.target.value)}
                  placeholder="Bairro"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground sm:col-span-4">
                Cidade
                <input
                  className={`mt-1 ${inputClass}`}
                  value={endereco.cidade}
                  maxLength={80}
                  onChange={(e) => atualizarEndereco("cidade", e.target.value)}
                  placeholder="Cidade"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground sm:col-span-2">
                Estado
                <input
                  className={`mt-1 ${inputClass}`}
                  value={endereco.estado}
                  maxLength={2}
                  onChange={(e) => atualizarEndereco("estado", e.target.value.toUpperCase())}
                  placeholder="PB"
                />
              </label>
            </div>
          </section>

          {/* Pagamento */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-primary">
              <CreditCard className="size-4" /> Forma de pagamento
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FORMAS_PAGAMENTO.map((forma) => {
                const Icone = iconePagamento[forma.id];
                const ativo = pagamento === forma.id;
                return (
                  <button
                    key={forma.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setPagamento(forma.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      ativo
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span
                      className={`rounded-lg p-2 ${ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      <Icone className="size-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{forma.titulo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {forma.descricao}
                      </span>
                    </span>
                    {ativo && <Check className="size-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo do pedido
          </h2>
          <div className="flex items-center justify-between text-lg font-bold text-primary">
            <span>Total</span>
            <span>{formatarPreco(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {pagamento
              ? `Forma de pagamento: ${rotuloPagamento(pagamento)}`
              : "Selecione a forma de pagamento ao lado."}
          </p>
          <p className="text-xs text-muted-foreground">
            O pedido é confirmado por WhatsApp, incluindo disponibilidade em estoque, frete e forma
            de pagamento.
          </p>

          {erros.length > 0 && fase === "form" && (
            <ul className="space-y-1 rounded-lg border border-brand-red/30 bg-brand-red/5 p-3 text-xs text-brand-red">
              {erros.map((e) => (
                <li key={e} className="flex gap-2">
                  <AlertCircle className="size-3.5 shrink-0" /> {e}
                </li>
              ))}
            </ul>
          )}

          {fase === "form" && (
            <button
              onClick={iniciarFinalizacao}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red px-5 py-3 text-sm font-bold text-brand-red-foreground transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" /> Finalizar pelo WhatsApp
            </button>
          )}

          {fase === "permissao" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Navigation className="size-4" /> Encontraremos a Farmácia Francy mais próxima de
                você.
              </p>
              <p className="text-xs text-muted-foreground">
                Precisamos acessar sua localização para encaminhar seu pedido para a unidade mais
                próxima.
              </p>
              <p className="text-xs text-muted-foreground">
                Sua localização será usada somente para identificar a Farmácia Francy responsável
                pelo pedido.
              </p>
              <button
                onClick={pedirLocalizacao}
                className="w-full rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Permitir localização
              </button>
              <button
                onClick={() => setFase("lista")}
                className="w-full rounded-full border border-border px-5 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                Escolher unidade manualmente
              </button>
            </div>
          )}

          {fase === "localizando" && (
            <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Localizando a Farmácia Francy mais próxima...
            </div>
          )}

          {fase === "confirmar" && selecionada && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-primary">
                Encontramos a Farmácia Francy mais próxima!
              </p>
              <p className="flex items-start gap-2 text-sm font-bold">
                <MapPin className="mt-0.5 size-4 shrink-0 text-brand-red" />
                {selecionada.unidade.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {enderecoUnidade(selecionada.unidade)}
              </p>
              {selecionada.distancia !== null && (
                <p className="text-xs font-medium text-primary">
                  {formatarDistancia(selecionada.distancia)} de distância
                </p>
              )}
              <button
                onClick={() => enviarPedido(selecionada.unidade, selecionada.distancia)}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-red px-5 py-3 text-sm font-bold text-brand-red-foreground transition-opacity hover:opacity-90"
              >
                <MessageCircle className="size-4" /> Enviar pedido
              </button>
              <button
                onClick={() => setFase("lista")}
                className="w-full rounded-full border border-border px-5 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                Escolher outra unidade
              </button>
            </div>
          )}

          {fase === "lista" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              {avisoLocal && (
                <>
                  <p className="text-sm font-semibold text-brand-red">{avisoLocal}</p>
                  <p className="text-xs text-muted-foreground">
                    Você pode escolher uma Farmácia Francy manualmente.
                  </p>
                </>
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unidades Francy
              </p>
              <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {UNIDADES_ATIVAS.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => escolherUnidade(u)}
                      className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-primary"
                    >
                      <span className="block text-sm font-semibold text-primary">{u.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {enderecoUnidade(u)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setFase("form")}
                className="w-full rounded-full border border-border px-5 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
              >
                Voltar
              </button>
            </div>
          )}

          <button
            onClick={limpar}
            className="w-full rounded-full border border-border px-5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-red hover:text-brand-red"
          >
            Esvaziar carrinho
          </button>
        </aside>
      </div>
    </div>
  );
}

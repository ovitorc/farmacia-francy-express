import { categorias, produtos } from "./src/lib/catalog";

const q = (v: string | null | undefined) =>
  v === null || v === undefined ? "null" : `'${v.replace(/'/g, "''")}'`;
const n = (v: number | null | undefined) => (v === null || v === undefined ? "null" : String(v));
const arr = (v?: string[]) =>
  !v || v.length === 0 ? "'{}'" : `ARRAY[${v.map((x) => q(x)).join(",")}]::text[]`;

const lines: string[] = [];
categorias.forEach((c, i) => {
  lines.push(
    `INSERT INTO public.categorias (slug, nome, icone, ordem) VALUES (${q(c.slug)}, ${q(c.nome)}, ${q(c.icone)}, ${i});`,
  );
  c.subcategorias.forEach((s, j) => {
    lines.push(
      `INSERT INTO public.subcategorias (categoria_slug, slug, nome, ordem) VALUES (${q(c.slug)}, ${q(s.slug)}, ${q(s.nome)}, ${j});`,
    );
  });
});
produtos.forEach((p, i) => {
  lines.push(
    `INSERT INTO public.produtos (codigo, nome, descricao, categoria_slug, subcategoria_slug, preco, preco_promocional, imagem, disponivel, oferta, rasga_preco, informacoes, ordem) VALUES (${q(p.codigo)}, ${q(p.nome)}, ${q(p.descricao)}, ${q(p.categoria)}, ${q(p.subcategoria)}, ${n(p.preco)}, ${n(p.precoPromocional)}, ${q(p.imagem)}, ${p.disponivel}, ${p.oferta}, ${Boolean(p.rasgaPreco)}, ${arr(p.informacoes)}, ${i});`,
  );
});
await Bun.write("/tmp/seed.sql", lines.join("\n"));
console.log("ok", lines.length);

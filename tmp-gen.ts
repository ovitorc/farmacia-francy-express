import { produtos } from "./src/lib/catalog";

const q = (v: string | null | undefined) =>
  v === null || v === undefined ? "null" : `'${v.replace(/'/g, "''")}'`;
const n = (v: number | null | undefined) => (v === null || v === undefined ? "null" : String(v));

const demo = produtos.slice(3);
console.log(
  demo
    .map(
      (p, i) =>
        `(${q(p.codigo)},${q(p.nome)},${q(p.categoria)},${q(p.subcategoria)},${n(p.preco)},${n(p.precoPromocional)},${p.oferta},${Boolean(p.rasgaPreco)},${i + 3})`,
    )
    .join(",\n"),
);

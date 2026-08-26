# Substituir os produtos fictícios pela base real

## Situação atual (verificada no banco)

- A base real foi importada: **19.342 produtos** com códigos FF000001…, com código de barras, fabricante, estoque, princípio ativo, registro MS e preço.
- Mas os **45 produtos de demonstração continuam no banco** (códigos FF-1002, FF-1003, ff-0011…). Como são os únicos com foto e com "Rasga Preço" marcado, são eles que aparecem na home — por isso o site ainda parece fictício.
- Distribuição real: Medicamentos 7.388, Perfumaria 4.658, Bebês 1.689, Beleza 1.243, Conveniência 1.028, e as demais 9 categorias.
- 7.149 itens com estoque positivo; 12.238 sem estoque (continuarão aparecendo, marcados como indisponíveis).

## O que será feito

1. **Excluir os 45 produtos de demonstração** do banco. Restam apenas os 19.342 produtos reais.
2. **Destaques controlados por você no painel**: hoje a importação marcou ~7.955 produtos reais como "oferta" automaticamente (todo item com preço promocional). Isso será zerado, e a home passará a mostrar apenas o que você marcar como "Oferta" e "Rasga Preço" no /admin.
3. **Painel de administração**: adicionar as opções de marcar/desmarcar "Oferta" e "Rasga Preço" direto na lista de produtos, além do formulário de edição, para montar as vitrines rapidamente.
4. **Home com base real**: enquanto nada estiver marcado, as vitrines mostram automaticamente produtos reais com estoque (para a home nunca ficar vazia); assim que você marcar itens no painel, eles assumem o lugar.
5. **Produtos sem estoque**: seguem visíveis nas listas e na busca, com selo de indisponível.
6. **Fotos**: os produtos reais vieram sem imagem. O card mostra um espaço neutro com o nome do produto; você vai subindo fotos pelo painel conforme a necessidade.

## Detalhes técnicos

- Limpeza via SQL: `DELETE FROM produtos WHERE codigo !~ '^FF[0-9]{6}$'` e `UPDATE produtos SET oferta = false` (mantendo `preco_promocional`, que é dado comercial real).
- `src/lib/catalog.functions.ts`: `getCatalogo` passa a priorizar itens marcados (`rasga_preco` / `oferta`) e completar com fallback por estoque; ordenar por desconto quando houver preço promocional.
- `src/routes/_authenticated/admin.tsx`: toggles de Oferta e Rasga Preço na listagem, chamando a função administrativa existente de salvar produto.
- Sem mudanças de schema; nenhuma informação comercial (preço, promoção, Farmácia Popular) é alterada.

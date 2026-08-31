# Unidade mais próxima pelo endereço de entrega

Hoje a unidade é escolhida pelo GPS do aparelho. No computador (e em celular sem sinal bom) o GPS costuma errar por quilômetros, escolhendo uma loja distante — foi o que aconteceu no seu teste. A escolha passa a ser feita pelo endereço de entrega que o cliente já preencheu, com distância real de trajeto pelo Google Maps.

## Como vai funcionar

1. Cliente preenche CEP, rua, número, bairro e cidade (fluxo atual, sem mudanças).
2. Ao clicar em "Finalizar pelo WhatsApp", o site converte o endereço em coordenadas (Geocoding do Google Maps).
3. Calcula a distância de trajeto do endereço até as 15 unidades e escolhe a menor.
4. Mostra a tela de confirmação com a unidade sugerida, endereço e distância — o cliente apenas confirma e é enviado ao WhatsApp daquela unidade, com a mensagem completa do pedido (igual hoje).

Reservas, para nunca travar o pedido:
- Se o Google não achar o endereço ou a API falhar, cai no cálculo local em linha reta (já existente).
- Se ainda assim não der, aparece a lista manual de unidades, como já acontece hoje.

A etapa de pedir permissão de localização (GPS) sai do fluxo, já que o endereço de entrega é obrigatório e mais confiável.

## Requisito: conector Google Maps

O projeto ainda não tem o Google Maps conectado. Ao aprovar o plano, vou abrir o cartão de conexão para você autorizar — a chave gerenciada pela Lovable já cobre o uso. Sem a conexão, o site continua funcionando no modo linha reta.

Custo: cada finalização de pedido faz 1 chamada de geocodificação + 1 de matriz de distâncias (15 destinos numa só chamada). O resultado do CEP é guardado em cache para não repetir chamadas iguais.

## Detalhes técnicos

- Novo `src/lib/geo.functions.ts` (server function pública, entrada validada): recebe o endereço, chama `maps/api/geocode/json` e `routes/distanceMatrix/v2:computeRouteMatrix` pelo gateway do conector, e devolve `{ unidadeId, distanciaKm, duracaoMin, origem }`. Chaves lidas dentro do handler (`process.env`), nunca no navegador.
- Cache em memória por CEP+número, com limite de entradas.
- `src/lib/pharmacies.ts`: mantido; `unidadeMaisProxima`/`distanciaKm` viram o caminho de reserva. Sem alterar unidades, números de WhatsApp ou formas de pagamento.
- `src/routes/carrinho.tsx`: fase `permissao`/`localizando` substituída por `calculando`; `pedirLocalizacao` vira `resolverUnidade` chamando a server function; `montarMensagem` passa a informar a distância de trajeto ("Distância aproximada: X km"). Restante da página, validações e identidade visual inalterados.
- Sem novas tabelas, colunas ou dependências.

## Aparte

O CEP da unidade Cristo (2°) veio como `58070-4407` na sua lista e foi cadastrado como `58070-440`; confirme quando puder.

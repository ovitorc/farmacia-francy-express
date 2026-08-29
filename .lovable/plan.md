# Rasga Preço — carrossel arrastável com rolagem contínua

Refaço apenas o bloco Rasga Preço. Nada mais do projeto muda.

## Comportamento

- Os produtos rolam continuamente da direita para a esquerda, em loop infinito e sem saltos.
- O cliente pode arrastar a faixa com o dedo (celular) ou com o mouse (computador), para a esquerda ou para a direita, livremente.
- Ao soltar/parar de arrastar, aguarda 1,5s e a rolagem automática da direita para a esquerda volta sozinha, a partir da posição onde ficou.
- Os mesmos produtos aparecem sempre: a lista é duplicada e o deslocamento é reciclado, então nunca "acaba" nem some da tela.
- Ao passar o mouse por cima, a rolagem pausa (retomando 1,5s depois de sair).
- Em telas que pedem menos movimento (preferência de sistema por movimento reduzido), a faixa fica parada, mas continua arrastável.

## Texto

- Subtítulo passa de "Ofertas com desconto especial" para "Ofertas válidas de quinta a domingo, toda semana."

## Detalhes técnicos

Reescrever `src/components/RasgaPreco.tsx`:

- Remover os botões de alinhamento (esquerda/centro/direita), o `localStorage` e o wrapper de posicionamento — foram a origem do conflito.
- Trocar a animação em CSS (`marquee-track`) por um loop em `requestAnimationFrame` que mantém um `offset` em ref e aplica `transform: translate3d(x,0,0)` na faixa. Velocidade constante (~40px/s).
- Loop infinito: lista duplicada; quando `offset <= -larguraDeUmaCópia` soma essa largura de volta (e o inverso ao arrastar para a direita), medindo a largura com `ResizeObserver`.
- Arrasto por Pointer Events (`pointerdown` / `pointermove` / `pointerup` + `setPointerCapture`), cobrindo mouse e toque; `touch-action: pan-y` para não travar o scroll vertical da página.
- Ao soltar, `setTimeout` de 1500ms religa a rolagem automática; qualquer novo toque cancela o timer.
- Suprimir o clique do card quando houve arrasto real (limiar de alguns pixels), para não abrir o produto sem querer.
- Manter `ProductCard`, dados de `useCatalogo` e o cabeçalho vermelho da seção como estão.
- Limpar a `@utility marquee-track` de `src/styles.css` apenas se não for usada em outro lugar.

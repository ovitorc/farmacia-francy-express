# Rasga Preço no computador + proteção das imagens

## 1. Animação parada no desktop

Causa: a faixa pausa ao passar o mouse por cima (`onMouseEnter`). No computador o cursor costuma ficar em cima da seção, então ela parece nunca andar.

Correção em `src/components/RasgaPreco.tsx`:
- Remover a pausa por hover. A rolagem só para enquanto o cliente estiver arrastando.
- Ao soltar, mantém a retomada automática após 1,5s (comportamento já aprovado).
- Remover `onPointerLeave` como finalizador de arrasto (o pointer capture já garante o fim correto ao soltar), evitando cortes do arrasto ao sair da área.
- Reiniciar o relógio do loop quando a aba volta a ficar visível, para não haver salto grande após ficar em segundo plano.

## 2. Bloquear download/arrasto das imagens

Aplicado a todas as imagens do site (produtos, logos, banners):
- CSS global em `src/styles.css`: `img { -webkit-user-drag: none; user-select: none; }`.
- No layout raiz (`src/routes/__root.tsx`): bloquear `dragstart` em imagens e o menu de contexto (botão direito / toque longo) sobre imagens.

Observação honesta: isso impede o arrasto e o "salvar imagem" comum do navegador, mas nenhuma técnica de front-end impede totalmente alguém tecnicamente habilidoso de obter o arquivo (print de tela ou ferramentas do navegador).

## Escopo

Fora isso, nada muda no projeto.

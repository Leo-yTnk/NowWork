# Shared Element Transitions

Complemento à Diretriz de Animações e Interações Físicas 1.0 do NowWork.

## Identidade e movimento

Quando o mesmo elemento mudar de posição, tamanho ou estado, mantenha sua identidade e mostre um único elemento visível ao longo do trajeto. Use a chave estável do registro, como `subject.id`, ou a identidade do próprio indicador de seleção. Títulos, índices da lista e similaridade visual são insuficientes para estabelecer essa relação.

- **Dentro da mesma interface**, preserve o nó DOM e mova-o até a geometria de destino. Mantenha botões, links e conteúdo editável montados durante a animação para preservar foco, semântica e estado.
- **Entre telas que remontam**, meça a origem antes da troca, renderize o destino uma única vez e desloque o elemento de destino da posição anterior à posição final. Esse é o padrão FLIP aplicado à posição. Preserve a cor, o ícone e as proporções. Se apenas o ícone for compartilhado, o cartão e o cabeçalho podem mudar de layout independentemente.
- **Para conteúdo novo**, use uma entrada discreta ou uma atualização imediata. Quando um valor mudar dentro de um controle, atualize o texto no mesmo nó. Desenhar o texto antigo e o novo ao mesmo tempo gera sobreposição e quebra a leitura.
- **Em gestos e reordenações**, faça o elemento acompanhar o ponteiro. Ao interromper um movimento, retome a partir da posição que está na tela. Anime os vizinhos apenas quando eles também mudarem de posição.

## Aplicação no NowWork

| Interação | Elemento que se move | Comportamento |
| --- | --- | --- |
| Abas principais e abas internas | Fundo ou sublinhado ativo | Um único indicador por grupo acompanha a aba selecionada, inclusive quando a navegação interna quebra linha. |
| Seletores segmentados | Fundo ativo | O mesmo indicador se move e acompanha a largura e a altura da opção. Os rótulos e os botões preservam suas posições e seu foco. |
| Lista de matérias ↔ cabeçalho da matéria | Ícone da matéria | O ícone percorre o trajeto nos dois sentidos. A troca das demais partes da tela ocorre imediatamente para preservar a posição inicial do ícone. |
| Valores de seleção | Rótulo atual | O texto muda no mesmo nó, com uma breve transição de opacidade sobre o novo valor. |
| Reordenação da barra do editor | Ferramenta arrastada | O comportamento existente move a própria ferramenta e acomoda as vizinhas sem sobrepor cópias. |

## Implementação e verificação

- Reutilize a mola `springs.layout` nos indicadores. Na troca de tela, limite o deslocamento à menor parte reconhecível e use uma duração curta. O ícone da matéria usa 260 ms.
- Meça antes da troca e, no destino, após calcular o layout e ajustar a rolagem. Se um dos pontos estiver fora da área visível ou faltar, mostre o estado final. Quando a API de animação estiver indisponível, o destino deve aparecer imediatamente.
- Respeite a redução de movimento do NowWork e do dispositivo. A seleção, a navegação e seus estados acessíveis devem se atualizar imediatamente. Indicadores decorativos ficam fora da árvore de acessibilidade e da área de clique.
- Verifique os dois sentidos, cliques rápidos, navegação por histórico, quebra de linha, teclado e redução de movimento. Em cada quadro, deve haver uma única representação visual do elemento compartilhado. O restante do conteúdo deve continuar legível e interativo.

## Referências

- MDN WEB DOCS. *Web Animations API*. Disponível em [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API).
- MDN WEB DOCS. *View Transition API*. Disponível em [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API).
- MDN WEB DOCS. *view-transition-name*. Disponível em [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/view-transition-name).

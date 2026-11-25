# Arquitetura cognitiva do NowWork

## Auditoria e decisões

A revisão partiu do commit `e5465d1`. O NowWork já tinha quatro áreas com rotas por hash, caixa de entrada com registros de quatro tipos, agenda semanal baseada em datas, foco com cronômetro, busca de matérias, tarefas e páginas, cadernos Tiptap/ProseMirror e revisão por matéria. O agendamento anterior dobrava o intervalo quando o usuário lembrava e reagendava para o dia seguinte quando esquecia. Cada cartão guardava a data e o intervalo correntes.

| Camada | Implementação |
| --- | --- |
| Captura e caixa de entrada | Capturas são registros do mesmo armazenamento das tarefas. O texto completo é guardado antes de confirmar o salvamento. Regras em português sugerem classificação e datas. A classificação é opcional. O atalho inicial é Ctrl ou ⌘ + Shift + Espaço e pode ser alterado nas configurações. |
| Conversão | A conversão arquiva o original e cria uma referência para a tarefa, o compromisso, a página ou o cartão gerado. A caixa aceita vinculação, classificação adiada, arquivo e exclusão com desfazer. O lote usa os mesmos fluxos de conversão, matéria e arquivo. Uma conversão de cartões em lote solicita uma resposta para cada registro. Páginas e cartões usam a matéria escolhida no processamento. |
| Hoje | Mostra uma próxima ação, até três prioridades iniciais, compromissos, revisões, capacidade, pendências e progresso. Preferências permitem substituir ou ignorar a ação sugerida, desativar recomendações, assinalar descanso e encerrar o dia com pendências registradas. |
| Priorização | Soma ponderada de critérios normalizados, com desempate por prazo, criação e identificador. O motor exclui tarefas com pré-requisitos pendentes ou ausentes. Prazos e importância têm fatores próprios. Preferências e disposição só influenciam a pontuação quando informadas. |
| Agenda | Janelas semanais, blocos de estudo e pausas, compromissos fixos, margem e detecção de sobreposições. A margem inicial é 25% do tempo disponível após compromissos dentro das janelas. A agenda pré-visualiza sugestões de blocos para um dia ou sete dias e revalida a proposta antes de gravar. O dia planejado é um campo independente do prazo oficial. |
| Foco | Temporizador livre ou com duração-alvo, pausa, subtarefas, captura e continuidade. O registro de tempo efetivo é opcional e depende da duração confirmada pelo estudante. A comparação usa tarefas concluídas, agrupa os trechos por tarefa e só sugere a mediana a partir de três tarefas semelhantes confirmadas. |
| Intenções | O formulário da tarefa associa uma ação ao horário local, término previsto de um compromisso, conclusão de outra tarefa ou rotina descrita. O plano fica acessível na tarefa e no foco. A rotina é uma pista que o estudante reconhece. |
| Cadernos e busca | Páginas podem ter tópicos opcionais. O editor mantém o esquema Tiptap. O menu Inserir pode transformar uma seleção em rascunho de flashcard ou abrir uma captura de dúvida com vínculo à página. Referências bidirecionais usam o tipo e o ID estável e acompanham renomeações. A busca inclui o texto de capturas e cartões. |
| Revisão | Cinco formatos de pergunta, tentativa opcional antes de revelar, resposta de referência, quatro avaliações e filtro por tópico. O agendamento local considera intervalo anterior, tempo decorrido, avaliações recentes e prazo acadêmico opcional. Cada avaliação nova é registrada junto com o intervalo escolhido. |
| Autorregulação | Revisões diária e semanal opcionais, encerramento, tempos confirmados, estimativas, atividade por matéria, autoavaliações da recuperação e conteúdos com dificuldades recorrentes. Pontos e recompensas anteriores permanecem no backup para fins de continuidade. |

## Persistência e publicação

O esquema de snapshot passou para a versão 2. A leitura aceita os backups de versão 1 e acrescenta os campos opcionais e padrões novos. Datas e intervalos previamente guardados continuam válidos. O identificador do banco IndexedDB, a chave do snapshot e a cópia de contingência original foram mantidos. A confirmação de captura depende da gravação da transação. O armazenamento conserva a comparação de snapshots entre abas e oferece exportação em caso de conflito. A importação valida o arquivo antes de substituir a cópia atual.

A rotina do Vite continua gerando o service worker com o HTML e os recursos do build no escopo relativo. Os links continuam no formato `/NowWork/#/...`. A publicação usa o fluxo existente do GitHub Pages com testes, auditoria e build no Node 22. O atendimento offline depende de uma primeira visita com a instalação do cache concluída. Os dados ficam no navegador. Sincronização futura exigiria consentimento, uma política de conflitos entre dispositivos e infraestrutura de autenticação e recuperação.

## Limites e critérios de produto

- A distribuição é uma busca gulosa de intervalos e propõe tarefas atualmente executáveis. Um compromisso com data e sem horário aparece na agenda, com duração indeterminada para a análise de conflitos.
- A capacidade reserva janelas avançando a partir do horário local. O orçamento inicial atribui cerca de três minutos por cartão e o usuário pode continuar além da sugestão.
- Os planos SE–ENTÃO atualizam a interface aberta com base em registros locais. A conclusão de eventos externos deve ser observada pelo estudante. O aplicativo não programa alertas do sistema nem controla notificações de terceiros.
- A avaliação de recuperação é autorrelatada, com comparação a uma resposta de referência. Questões abertas e explicações ajudam a observar o raciocínio, que pode ser avaliado também em exercícios e aplicações.
- O agendamento preserva datas anteriores até uma avaliação ou reagendamento explícito. O FSRS foi avaliado como opção futura. O esquema anterior guardava apenas a última data e o intervalo, sem uma série de avaliações adequada para recalibrar os cartões existentes. A regra local é inspecionável e serve tanto para cartões migrados quanto novos.

## Fundamentação científica

| Evidência de pesquisa | Decisão de produto derivada |
| --- | --- |
| Ferramentas externas podem apoiar a memória de intenções. Alguns experimentos associaram planos específicos a menor interferência de objetivos pendentes. | Captura em uma etapa, caixa de processamento e encerramento voluntário. |
| A literatura de intenções de implementação analisa ações associadas previamente a pistas observáveis. | Planos SE–ENTÃO no formulário já usado para tarefas. |
| Alternar entre atividades pode deixar resíduo de atenção. Estudos de interrupções e micropausas apontam efeitos que dependem da tarefa, do momento e da duração. | Tela de foco, contexto de retomada e sugestões de pausa dispensáveis. |
| A literatura da falácia do planejamento mostra que estimativas podem ignorar experiências anteriores relevantes. | Comparação com tempos confirmados, mediana e faixa observada. O mínimo de três amostras é um parâmetro de produto. |
| A literatura de aprendizagem estuda recuperação ativa e prática distribuída, inclusive em escolas. | Pergunta anterior à resposta, autorrevisão e intervalos adaptativos. Os parâmetros do agendamento são escolhas de produto. |
| A pesquisa sobre autorregulação descreve ciclos de planejamento, acompanhamento e reflexão. | Revisões diária e semanal opcionais e indicadores vinculados a decisões. |

Os estudos fundamentam os mecanismos gerais. A eficácia da interface, dos pesos e da margem de capacidade deve ser avaliada no contexto de uso do NowWork.

### Referências

- ALBULESCU, P. et al. Give me a break! A systematic review and meta-analysis on the efficacy of micro-breaks for increasing well-being and performance. *PLOS ONE*, v. 17, n. 8, 2022. DOI: [10.1371/journal.pone.0272460](https://doi.org/10.1371/journal.pone.0272460).
- BUEHLER, R.; GRIFFIN, D.; ROSS, M. Exploring the planning fallacy: why people underestimate their task completion times. *Journal of Personality and Social Psychology*, v. 67, n. 3, p. 366–381, 1994. DOI: [10.1037/0022-3514.67.3.366](https://doi.org/10.1037/0022-3514.67.3.366).
- CARPENTER, S. K.; PAN, S. C.; BUTLER, A. C. The science of effective learning with spacing and retrieval practice. *Nature Reviews Psychology*, v. 1, p. 496–511, 2022. DOI: [10.1038/s44159-022-00089-1](https://doi.org/10.1038/s44159-022-00089-1).
- CASTRO-ALONSO, J. C. et al. Five strategies for optimizing instructional materials: instructor- and learner-managed cognitive load. *Educational Psychology Review*, v. 33, p. 1379–1407, 2021. Disponível em: [PubMed Central](https://pmc.ncbi.nlm.nih.gov/articles/PMC7940870/).
- DECI, E. L.; KOESTNER, R.; RYAN, R. M. A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin*, v. 125, n. 6, p. 627–668, 1999. DOI: [10.1037/0033-2909.125.6.627](https://doi.org/10.1037/0033-2909.125.6.627).
- DIGNATH, C.; BÜTTNER, G. Components of fostering self-regulated learning among students. *Metacognition and Learning*, v. 3, p. 231–264, 2008. DOI: [10.1007/s11409-008-9029-x](https://doi.org/10.1007/s11409-008-9029-x).
- DONOGHUE, G. M.; HATTIE, J. A. C. A meta-analysis of ten learning techniques. *Frontiers in Education*, v. 6, 581216, 2021. DOI: [10.3389/feduc.2021.581216](https://doi.org/10.3389/feduc.2021.581216).
- DUNLOSKY, J. et al. Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, v. 14, n. 1, p. 4–58, 2013. Disponível em: [PubMed](https://pubmed.ncbi.nlm.nih.gov/26173288/).
- GILBERT, S. J. et al. Outsourcing memory to external tools: a review of intention offloading. *Psychonomic Bulletin & Review*, v. 30, p. 60–76, 2023. DOI: [10.3758/s13423-022-02139-4](https://doi.org/10.3758/s13423-022-02139-4).
- GOLLWITZER, P. M.; SHEERAN, P. Implementation intentions and goal achievement: a meta-analysis of effects and processes. *Advances in Experimental Social Psychology*, v. 38, p. 69–119, 2006. DOI: [10.1016/S0065-2601(06)38002-1](https://doi.org/10.1016/S0065-2601(06)38002-1).
- LEROY, S. Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. *Organizational Behavior and Human Decision Processes*, v. 109, n. 2, p. 168–181, 2009. DOI: [10.1016/j.obhdp.2009.04.002](https://doi.org/10.1016/j.obhdp.2009.04.002).
- MASICAMPO, E. J.; BAUMEISTER, R. F. Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. *Journal of Personality and Social Psychology*, v. 101, n. 4, p. 667–683, 2011. Disponível em: [PubMed](https://pubmed.ncbi.nlm.nih.gov/21688924/).
- PANADERO, E. A review of self-regulated learning: six models and four directions for research. *Frontiers in Psychology*, v. 8, 422, 2017. DOI: [10.3389/fpsyg.2017.00422](https://doi.org/10.3389/fpsyg.2017.00422).
- RISKO, E. F.; GILBERT, S. J. Cognitive offloading. *Trends in Cognitive Sciences*, v. 20, n. 9, p. 676–688, 2016. DOI: [10.1016/j.tics.2016.07.002](https://doi.org/10.1016/j.tics.2016.07.002).
- RUITENBURG, S. K. et al. A meta-analysis of the effectiveness and boundary conditions of retrieval practice, distributed practice, and interleaved practice in authentic school classrooms. *Educational Psychology Review*, v. 38, art. 137, 2026. DOI: [10.1007/s10648-026-10225-5](https://doi.org/10.1007/s10648-026-10225-5).
- STOTHART, C.; MITCHUM, A.; YEHNERT, C. The attentional cost of receiving a cell phone notification. *Journal of Experimental Psychology: Human Perception and Performance*, v. 41, n. 4, p. 893–897, 2015. Disponível em: [PubMed](https://pubmed.ncbi.nlm.nih.gov/26121498/).

## Verificação

Execute `npm test` para os testes de armazenamento, migração, foco, captura, dependências, agenda e revisão. Execute `npm run build` para validar TypeScript, empacotamento e geração de cache. A verificação de navegação offline deve servir o conteúdo compilado em `/NowWork/` e aguardar que o service worker controle a página antes de desligar a conexão.

O build foi exercitado com Chromium nas dimensões de 1440 × 900, 768 × 1024, 390 × 844 e 320 × 720. Os testes de navegador cobriram captura e retomada offline, conversão, agenda, resposta oculta e avaliação. Em desktop e celular emulado também foram verificados caderno offline, criação de cartão por seleção, links bidirecionais e desfazer. A matriz local usou Chromium. Safari em um iPhone físico segue como teste de dispositivo.

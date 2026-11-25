# NowWork

Espaço de estudos por matéria. Disponível em [GitHub Pages](https://leo-ytnk.github.io/NowWork/).

- **Visão geral** com prazos, próxima ação e progresso do dia.
- **Tarefas** com prazos, prioridade, subtarefas, filtros e arquivo.
- **Agenda** semanal para organizar exercícios, entregas e compromissos.
- **Cadernos** por matéria com páginas de texto rico, títulos, listas, checklists, citações, código e links. O editor usa o conteúdo editável nativo do navegador, com Tiptap/ProseMirror empacotado no aplicativo.
- **Revisão** por cartões de pergunta e resposta com agendamento por desempenho.
- **Foco e evolução** com cronômetro, pausas e histórico.
- **Busca** por matéria ou pelo conteúdo de registros e páginas, com Ctrl/Cmd+K.

Os dados ficam no navegador. Depois do primeiro acesso online, o service worker guarda o aplicativo para abrir, editar e salvar localmente mesmo sem conexão. A seção Configurações permite exportar e importar backups JSON. Os registros e backups da versão Brisa são compatíveis com o NowWork no mesmo endereço.

## Componentes do design

- `src/styles/tokens.css` concentra cores, tipografia, espaçamento, raios e movimento para os dois temas.
- Plus Jakarta Sans é a fonte padrão da interface e dos cadernos, empacotada para uso offline. Blocos e trechos de código usam fonte monoespaçada por padrão. O editor respeita as fontes escolhidas nas preferências do caderno e na formatação do texto.
- `src/components/ui.tsx` e `src/styles/system.css` definem os componentes compartilhados, incluindo botões, superfícies, barras, grupos segmentados e navegação.
- Regras de layout do espaço de estudos e da folha do editor ficam em `workspace.css` e `document.css`.
- A navegação tem quatro áreas: Hoje, Planejar, Matérias e Estudar. Planejar reúne tarefas, agenda e caixa de entrada. Estudar reúne foco e progresso. A lista de matérias tem busca própria, e abrir uma matéria leva direto ao caderno. A URL mantém a área, matéria e página selecionadas.

## Desenvolvimento

```sh
npm install
npm run dev
npm test
npm run build
```

O GitHub Actions publica o diretório `dist` no GitHub Pages a partir de `main`. O Vite gera caminhos relativos para que o site funcione no diretório publicado pelo GitHub Pages.

Licença MIT.

[Arquitetura cognitiva, migração e referências](docs/arquitetura-cognitiva.md)

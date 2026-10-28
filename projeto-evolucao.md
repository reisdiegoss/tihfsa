# Plano de Evolução do Módulo de Projetos — Padrão Trello Board (TIHFSA)

> **Status:** Concluído com Sucesso  
> **Data:** 28/10/2026  
> **Escopo:** Transformação completa do módulo em uma cópia fiel do Trello: O Quadro Kanban horizontal organiza os Projetos em suas Etapas, e cada Projeto é um Cartão que ao ser aberto expande o Modal do Trello com Checklist (tarefas), Equipe, Ativos CMDB, Chamados e Linha do Tempo.

---

## 1. Arquitetura do Quadro Trello (Board View)

- **Colunas do Quadro (Listas / Etapas):**
  1. 📋 **Planejamento**
  2. ⚡ **Em Andamento**
  3. ⏸️ **Pausado / Bloqueado**
  4. ✅ **Concluído**
- **Cartões do Quadro (Projetos):**
  - Barra de etiqueta colorida por Categoria (Infraestrutura, Redes, Sistemas, etc.).
  - Código identificador (`PRJ-001`, `PRJ-002`) e Título do projeto.
  - Barra de progresso visual baseada nos itens de checklist concluídos.
  - Badges rápidos no rodapé:
    - 📅 Data de entrega com relógio (alerta visual se em atraso).
    - ☑️ Checklist de tarefas `x/y`.
    - 💻 Contador de equipamentos CMDB vinculados.
    - 🎫 Contador de chamados de suporte associados.
    - 👤 Avatares circulares sobrepostos da equipe técnica.
  - Arraste e solte nativo (Drag and Drop HTML5) entre as colunas para movimentação rápida de etapa.
  - Botão "+ Adicionar um cartão" no rodapé de cada lista (compositor rápido inline).

---

## 2. Modal do Cartão (Trello Card Modal)

Ao clicar em qualquer cartão do quadro, abre a visualização rica do projeto no padrão Trello:
- **Cabeçalho:** Título grande do projeto e seletor da lista atual ("na lista Em Andamento").
- **Coluna Principal (70%):**
  - **Membros & Etiquetas:** Avatares dos técnicos associados + botão `+ Membro` + etiqueta colorida de categoria.
  - **Descrição:** Caixa de texto do escopo e justificativa técnica.
  - **Checklist (Tarefas & Etapas):** Título com % de progresso, barra verde animada e checkboxes interativos (risca o texto quando feito) com indicação de responsável e bloqueio.
  - **Ativos CMDB Vinculados:** Lista de switches, APs, servidores associados com tag e IP + botão `+ Vincular Ativo`.
  - **Chamados Helpdesk:** Lista de tickets associados + botão `+ Vincular Chamado`.
  - **Atividade & Comentários:** Campo para publicar notas técnicas e feed cronológico com comentários e logs automáticos do sistema.
- **Barra Lateral Direita (30% - Ações do Trello):**
  - Adicionar ao cartão: `Membros da Equipe`, `Checklist de Tarefas`, `Equipamento CMDB`, `Chamado Helpdesk`.
  - Ações do projeto: `Editar Dados Gerais`, `Excluir Projeto`.

---

## ✅ PHASE X COMPLETE
- Frontend Build: ✅ Success (`dist/assets/index-CpI6R9oq.js` compilado sem erros)
- Interatividade: ✅ Drag & drop HTML5, criação inline de cartões, checklist interativo, modais de ativos e chamados
- Data: 28/10/2026

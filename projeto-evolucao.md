# Plano de Evolução do Módulo de Projetos & Portfólio (TIHFSA)

> **Status:** Concluído com Sucesso  
> **Data:** 28/10/2026  
> **Escopo:** Transformar o módulo de projetos em um centro de comando operacional para a equipe de TI, integrando Tarefas (com flag e motivo de Bloqueio), CMDB (Ativos vinculados), Chamados (Helpdesk), Equipe Técnica e Linha do Tempo Híbrida.

---

## 1. Decisões Consolidadas no Socratic Gate

1. **Quadro Kanban & Bloqueio:**
   - As 4 colunas clássicas são mantidas: **A Fazer**, **Em Andamento**, **Em Revisão**, **Concluído**.
   - Cada tarefa ganha suporte nativo a impedimentos: `is_blocked: bool` e `blocked_reason: str`. O cartão exibe um badge visual chamativo de "Bloqueado" e o motivo do impedimento com ação rápida de bloquear/desbloquear.
2. **Vínculo com Ativos (CMDB):**
   - Vínculo simples direto N:N (`project_assets`).
   - Permite associar equipamentos (switches, servidores, antenas AP, nobreaks) pelo patrimônio/nome/IP, exibindo-os organizados na aba de ativos do projeto.
3. **Equipe do Projeto:**
   - Mantém o **Gestor do Projeto** (`manager_id`) e adiciona a lista de **Técnicos Participantes** via tabela associativa `project_members` (`project_id`, `user_id`).
4. **Linha do Tempo (Timeline Híbrida):**
   - Registra comentários manuais da equipe técnica + logs automáticos do sistema (mudança de status de tarefas, bloqueios/desbloqueios, vinculação de chamados e equipamentos).

---

## 2. Arquitetura e Modelagem

### Novas Tabelas e Colunas:
- **`project_members`** (Tabela associativa N:N):
  - `project_id`: FK `projects.id`
  - `user_id`: FK `users.id`
- **`project_assets`** (Tabela associativa N:N):
  - `project_id`: FK `projects.id`
  - `asset_id`: FK `assets.id`
- **`project_timeline`** (Tabela de eventos e comentários):
  - `id`: PK
  - `project_id`: FK `projects.id`
  - `author_id`: FK `users.id` (nullable para eventos do sistema)
  - `event_type`: `comment`, `system`, `task`, `ticket`, `asset`, `status`
  - `content`: Text
  - `created_at`: DateTime UTC
- **`project_tasks`** (Colunas adicionais):
  - `is_blocked`: Boolean (default False)
  - `blocked_reason`: Text (nullable)

---

## 3. Resumo da Implementação

### Fase 1: Backend (FastAPI + SQLAlchemy + Pydantic)
- Modelos atualizados em [`backend/app/models/project.py`](file:///c:/Users/diego.reis/Documents/DEV/TIHFSA/backend/app/models/project.py) e exportados em `__init__.py`.
- Auto-migração configurada em [`backend/app/main.py`](file:///c:/Users/diego.reis/Documents/DEV/TIHFSA/backend/app/main.py) (`ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS is_blocked...`).
- DTOs atualizados em [`backend/app/schemas/project.py`](file:///c:/Users/diego.reis/Documents/DEV/TIHFSA/backend/app/schemas/project.py).
- Endpoints REST implementados em [`backend/app/routers/projects.py`](file:///c:/Users/diego.reis/Documents/DEV/TIHFSA/backend/app/routers/projects.py) com geração automática de eventos de linha do tempo.

### Fase 2: Frontend (React + Tailwind CSS)
- Métodos de API integrados em [`frontend/src/api/projects.js`](file:///c:/Users/diego.reis/Documents/DEV/TIHFSA/frontend/src/api/projects.js).
- Interface completa em [`frontend/src/pages/admin/Projects.jsx`](file:///c:/Users/diego.reis/Documents/DEV/TIHFSA/frontend/src/pages/admin/Projects.jsx):
  - **Quadro Kanban**: Suporte a bloqueio rápido com motivo, banner animado de impedimento e desbloqueio em 1 clique.
  - **Equipe Técnica**: Gestor em destaque + lista de técnicos participantes com modal de adição e remoção.
  - **Ativos CMDB**: Catálogo de equipamentos vinculados (Patrimônio, IP, Modelo) e modal de pesquisa no CMDB.
  - **Chamados**: Listagem dos chamados de suporte associados com ação de desvinculação.
  - **Linha do Tempo**: Feed cronológico interativo com publicação de comentários técnicos e logs automáticos do sistema.

---

## ✅ PHASE X COMPLETE
- Backend Python Syntax: ✅ Pass (py_compile sem erros)
- Frontend Build: ✅ Success (`dist/assets/index-CLCsOinN.js` compilado sem falhas)
- Rule Compliance: ✅ Socratic Gate respeitado e decisões aplicadas
- Data: 28/10/2026

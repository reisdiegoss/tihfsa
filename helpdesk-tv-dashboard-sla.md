# Projeto: Monitoramento de Chamados para TV & Parametrização de SLA (TIHFSA)

## 1. Visão Geral e Objetivos
Estruturar uma área de monitoramento completa para o Hotel Fasano Salvador com:
1. **Hub Unificado de Monitoramento (`/admin/monitoring`)**: Centraliza as operações em duas abas: **NOC (Infraestrutura/Redes)** e **Helpdesk (Chamados & SLA)**, com atalhos para os painéis de TV em tela cheia.
2. **Dashboard de Chamados para TV (`/tv/helpdesk` e `/tv/tickets`)**: Painel wallboard em Dark Mode de alto contraste projetado para ser exibido em uma TV dedicada, com KPIs ao vivo, fila prioritária, contagem regressiva de SLA, carga por técnico, ranking de setores e alertas visuais/sonoros.
3. **Parametrização Completa de SLA em Configurações (`Settings.jsx` -> Aba SLA)**:
   - SLA por Prioridade (Crítica, Alta, Média, Baixa) com tempos de 1ª Resposta e Resolução.
   - Opção de Horário Comercial (definir expediente e dias úteis) vs 24/7.
   - Opção de regras de SLA específicas por Categoria.

---

## 2. Arquitetura e Estrutura Técnica

### 2.1 Backend (Python / FastAPI / SQLAlchemy)
- **Model `SLAConfig` e `SLACategoryRule`** (`backend/app/models/sla.py`):
  - Configuração global de SLA com persistência no PostgreSQL/SQLite.
  - Campos: tempos por prioridade (resposta e resolução), flag de horário comercial (`calc_business_hours`), horários de início/fim e dias úteis, e flag de regras por categoria.
- **Migration Automática em `backend/app/main.py`**:
  - `CREATE TABLE IF NOT EXISTS sla_config (...)` e valores padrão corporativos (Crítica: 15m/2h, Alta: 1h/4h, Média: 2h/8h, Baixa: 4h/24h).
- **Service de Cálculo de SLA (`backend/app/services/sla_service.py`)**:
  - Calcula datas limites (`due_first_response_at`, `due_resolution_at`).
  - Calcula status de SLA para cada chamado: `OK`, `WARNING` (< 30 min ou 80% do tempo), `BREACHED` (estourado).
  - Cálculo de MTTA (Tempo Médio de Atendimento) e MTTR (Tempo Médio de Resolução).
- **Router `sla.py` (`/api/v1/sla`)**:
  - `GET /config`: Obtém parâmetros de SLA.
  - `POST /config` ou `PUT /config`: Salva parâmetros de SLA (apenas Administrador).
- **Router `monitoring.py` (`/api/v1/monitoring`)**:
  - `GET /helpdesk/summary`: Retorna KPIs consolidados, lista prioritária com timers de SLA, carga de técnicos e setores com mais chamados. Rota para a TV e painel administrativo.

### 2.2 Frontend (React / Vite / Tailwind)
- **Hub de Monitoramento (`frontend/src/pages/admin/MonitoringHub.jsx`)**:
  - Substitui `/admin/zabbix` no menu "Monitoramento" da `Sidebar.jsx`.
  - Abas: **NOC (Redes & Zabbix)** e **Helpdesk (Chamados & SLA)**.
  - Ações rápidas: **[ 📺 Abrir TV NOC ]** e **[ 📺 Abrir TV Helpdesk ]**.
- **Dashboard TV Wallboard (`frontend/src/pages/public/PublicHelpdeskTv.jsx`)**:
  - Rotas públicas `/tv/helpdesk` e `/tv/tickets` no `App.jsx`.
  - Design premium NOC/Helpdesk para TVs (Dark Mode profundo, cards com legibilidade à distância).
  - Alerta sonoro sintetizado (Web Audio API) com liga/desliga para chamados críticos e estouro de SLA.
  - Métricas e Fila ao vivo com contagem regressiva de SLA e refresh automático a cada 15 segundos.
- **Parametrização de SLA em `Settings.jsx`**:
  - Nova aba **"SLA & Prazos"** com ícone de relógio/cronômetro.
  - Configuração de Prioridades, Horário Comercial e Categorias com interface intuitiva.

---

## 3. Plano de Implementação (Passo a Passo)

| Etapa | Ação | Arquivos Envolvidos |
|---|---|---|
| **1** | Criar modelos de SLA e DDL de auto-migração | `backend/app/models/sla.py`, `backend/app/main.py` |
| **2** | Criar motor de cálculo de SLA e métricas de Helpdesk | `backend/app/services/sla_service.py` |
| **3** | Criar endpoints da API de SLA e Monitoring | `backend/app/routers/sla.py`, `backend/app/routers/monitoring.py`, registro no `main.py` |
| **4** | Criar aba de configuração de SLA em Configurações | `frontend/src/pages/admin/Settings.jsx` |
| **5** | Criar o Hub Unificado de Monitoramento | `frontend/src/pages/admin/MonitoringHub.jsx`, `Sidebar.jsx`, `App.jsx` |
| **6** | Criar o Dashboard de TV para Helpdesk | `frontend/src/pages/public/PublicHelpdeskTv.jsx`, `App.jsx` |
| **7** | Validação, compilação de front e back, e atualização do `DOC.md` | `DOC.md`, `npm run build`, `py -m py_compile` |

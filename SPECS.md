Technical Specifications (SPECS)

Projeto: TIHFSA - Helpdesk Fasano Salvador

1\. Stack Tecnológica

Frontend (Portal do Técnico): React.js (com Vite) + Tailwind CSS.

Frontend (Portal do Usuário/PWA): React.js focado em mobile-first e interface super limpa e direta.

Backend: Python (FastAPI). Escolhido pela facilidade em integrar com Active Directory (LDAP) e criar integrações com o Zabbix.

Banco de Dados: PostgreSQL (Relacional para garantir a integridade entre Chamados, Usuários e Ativos).

Autenticação: JWT para técnicos. Para o PWA dos usuários Windows, recomenda-se integração NTLM/Kerberos via backend (ou identificação baseada em token de máquina) para login sem senha.

2\. Modelo de Dados Relacional (Esquema do Banco)

Tabelas Principais (Core):

users (Importados do AD):

id, ad\_username, display\_name, email, department\_id, manager\_id (FK -> users), is\_room (Boolean - ex: Apt 101).

departments (Setores):

id, name, manager\_id.

assets (Equipamentos/CMDB):

id, asset\_tag (Patrimônio), type (TV, Sky, Notebook...), brand, model, specs (JSON), assigned\_user\_id (Pode ser um colaborador ou um Apartamento).

tickets (Chamados):

id, title, description, status (Novo, Em Andamento, Aguardando Validação, Fechado), category\_id, subcategory\_id, requester\_id, technician\_id, asset\_id (Opcional - equipamento com problema), created\_at, solved\_at.

ticket\_interactions (Interações do Chamado):

id, ticket\_id, user\_id, message, is\_solution, created\_at.

3\. Fluxo de Validação de Gestor (Workflow)

Técnico altera ticket\_status para PENDING\_VALIDATION.

Backend dispara E-mail para ticket.requester.manager.email.

E-mail contém Magic Links (Tokens JWT de uso único): \[Aprovar\] e \[Rejeitar\].

Clique na URL chama a rota do backend GET /api/tickets/{id}/validate?token={jwt}&action=approve.

Se aprovado, status = CLOSED. Se rejeitado, status = IN\_PROGRESS e notifica o técnico.

4\. Endpoints da API (Backend - FastAPI)

Módulo AD & Usuários

POST /api/v1/sync/ad: Rota de rotina para puxar usuários, atualizar setores e hierarquia (Gestores).

Módulo CMDB (Ativos)

GET /api/v1/assets/user/{user\_id}: Lista todos os equipamentos (TV, Sky, etc) do usuário ou do Apartamento selecionado.

Módulo Helpdesk

POST /api/v1/tickets: Abre um novo chamado (PWA ou Técnico).

PATCH /api/v1/tickets/{id}/solve: Técnico insere a solução. Dispara e-mail para o gestor.

POST /api/v1/tickets/{id}/validate: Gestor valida a solução.

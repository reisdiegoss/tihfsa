Development Instructions (System Prompt / Context)

Para: Google Antigravity (AI Code Generator)

Contexto: Você está desenvolvendo o "TIHFSA", um Sistema Integrado de Gestão de TI construído especificamente para as operações do Hotel Fasano Salvador. O foco principal é Helpdesk com fluxo de aprovação e Gestão de Ativos (Quartos e Backoffice).

DIRETRIZES GERAIS E FLUXO DE TRABALHO

Ao receber o comando para gerar o código, respeite rigorosamente as regras de negócios do prd.md e do specs.md. O sistema não é um helpdesk genérico, ele deve refletir a realidade hoteleira descrita.

Fase 1: Configuração do Backend (FastAPI + Banco de Dados)

Crie o aplicativo backend usando Python e FastAPI.

Defina os modelos SQLAlchemy exatos mapeados no specs.md (users, departments, assets, tickets, ticket\_interactions).

Regra de Ouro (Hierarquia): Garanta que a modelagem de usuários permita auto-relacionamento para o campo manager\_id, permitindo saber quem é o gestor de quem.

Garanta que a entidade "Usuário" tenha a flag is\_room para diferenciar pessoas (Backoffice) de Apartamentos (Ex: Apt 101, Apt 204).

Fase 2: Regras de Negócio do Helpdesk

Desenvolva as rotas de criação e atualização de chamados.

Crie a lógica do endpoint de Validação: O status só pode ir para "Fechado" se a ação vier do Gestor do usuário solicitante (Simule a geração de um link de aprovação/rejeição).

Fase 3: Frontend (React + Tailwind)

Desenvolva duas interfaces ou visões principais:

Portal do Técnico (Admin):

Interface completa estilo "Dashboard/NOC". Fundo escuro (Dark Mode).

Deve ter um botão "Novo Chamado (Ativo)" onde o técnico seleciona o solicitante (Pessoa ou Apartamento), seleciona o equipamento atrelado a ele e descreve a solução.

Visualização da fila de chamados e integração visual com os alertas do Zabbix (mockados).

PWA do Usuário (Client):

Interface estilo Light Mode, extremamente simples e focada no usuário final.

Simulando que o usuário já está logado, exibir formulário: Categoria -> Subcategoria -> Título -> Descrição.

Mostrar os equipamentos atrelados a ele (Ex: se for recepcionista, mostrar o PC, Telefone e Impressora dela para ela selecionar qual está com problema).

REGRAS CRÍTICAS DE GERAÇÃO:

Código Limpo: Adicione comentários explicando as lógicas de fluxo (especialmente a aprovação de gestor).

Mocks Realistas: Gere dados falsos (Mock Data) que tenham a ver com o Hotel Fasano Salvador (Ex: Quartos "101", "205", Gestor "Gerente de A&B", Equipamentos "Antena Unifi", "Receptor SKY").

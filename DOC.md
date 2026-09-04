TIHFSA - Helpdesk & IT Management (Fasano Salvador)

Bem-vindo ao repositório do TIHFSA, o sistema de operações de TI customizado para o Hotel Fasano Salvador.

Este ecossistema foi projetado para acabar com o "Shadow IT" e com os atendimentos informais, centralizando a abertura de chamados, a governança de aprovações por gestores e o inventário completo (CMDB) de equipamentos do Backoffice e dos Apartamentos do hotel.

Estrutura do Projeto

O projeto está dividido em duas partes principais:

/backend - API construída em Python (FastAPI). Gerencia a regra de negócios, tickets, integração AD (Gestores e Setores) e envio de aprovações.

/frontend - Interface de usuário construída em React (Vite) com Tailwind CSS. Contém tanto a visão tática (Dark mode) para os analistas de TI, quanto o frontend PWA (Light mode) simplificado para o usuário final abrir chamados.

Pré-requisitos

Node.js (v18+)

Python (3.9+)

PostgreSQL (Obrigatório para produção, suporta SQLite para testes).

Como rodar o projeto localmente (Ambiente de Desenvolvimento)

1\. Inicializando o Backend (API)

Navegue até a pasta do backend e instale as dependências.

cd backend

python -m venv venv

\# Ative o ambiente virtual

\# Windows: venv\\Scripts\\activate

\# Linux/Mac: source venv/bin/activate

pip install fastapi uvicorn sqlalchemy psycopg2-binary

Inicie o servidor local:

uvicorn main:app --reload

A API estará rodando em <http://localhost:8000>. Acesse <http://localhost:8000/docs> para visualizar a documentação interativa das rotas de Helpdesk e Ativos.

2\. Inicializando o Frontend

Navegue até a pasta do frontend e instale os pacotes necessários:

cd frontend

npm install

npm install lucide-react # Instala a biblioteca de ícones

Inicie o servidor de desenvolvimento:

npm run dev

A interface do sistema abrirá em <http://localhost:5173>.

Processos Chave (Workflows Específicos)

Sincronização AD: O backend possui um script que importa toda a árvore de usuários e organiza a hierarquia de Gestor -> Colaborador. Isso é vital para a aprovação de chamados.

Usuários vs. Apartamentos: Para fins de controle de inventário (TV, SKY, Unifi), os apartamentos do hotel são tratados como Entidades/Usuários dentro do sistema.

Fechamento de Ticket: Técnicos não fecham chamados de usuários comuns. O técnico altera para "Resolvido", e o sistema notifica o Gestor do solicitante para dar o crivo final.

Painel NOC & Topologia de Rede (TV / 4K Ready):
- **Diagramas de Topologia Interativos**: Suporte completo a nós de infraestrutura (Switches, Racks, Access Points, Servidores, Firewalls, Roteadores).
- **Dimensionamento Personalizado de Cards**: Suporte a ajuste de largura e altura (pixels manuais ou presets: Padrão, Médio, Largo, Extra Largo), além de alça interativa de redimensionamento direto no canvas. Quebra de texto inteligente para manter nomes longos legíveis sem corte.
- **Opções de Exibição Granulares**: Seleção precisa do que exibir em cada card (tanto dentro do Rack quanto em equipamentos avulsos fora do rack), incluindo exibição de IP e métricas UniFi detalhadas (CPU, RAM, Uptime, Firmware, WiFi Experience, Clientes conectados, Utilização de Canais, LAN Experience e Taxas RX/TX).
- **Alerta Sonoro Inteligente para Dispositivos Offline (Intercalado a cada 2s)**:
  - Configurado diretamente no painel do Fluxograma / Topologia NOC:
    - **1-Clique no Card**: Clique direto no ícone de sino (🔔) no cabeçalho do card no canvas para ativar/desativar o alerta do dispositivo instantaneamente.
    - **No Modal do Nó**: Opção "Alerta Sonoro se Offline (2s)" ao adicionar ou editar qualquer nó ou rack.
  - Emite aviso sonoro suave e não irritante (tom dual D5/A5 com decaimento harmônico via Web Audio API) intercalado a cada 2 segundos enquanto o dispositivo monitorado estiver offline ou inacessível.
  - Barra de controle flutuante com contador de nós com alerta configurado e botão rápido para silenciar (Mudo), reativar ou testar o som.
- **Modo TV Pública (/noc)**: Acesso sem autenticação de login para telas NOC/monitores de parede, com suporte a Fullscreen nativo, Fit Tela inteligente e escala para monitores 4K.
- **Sincronização Automática com Countdown (TVs & Telas NOC)**:
  - A cada ciclo da contagem regressiva da TV (countdown padrão de 15s) ou clique no botão de atualizar, o fluxograma recarrega silenciosamente a versão completa do diagrama do backend.
  - Qualquer alteração feita no fluxograma por outro computador (novos equipamentos inseridos, nós reposicionados, novos cabos de rede, nós deletados, alterações de tamanho de card ou alertas sonoros) é exibida automaticamente na TV sem necessitar de acesso remoto nem F5 manual no navegador.
  - Atualização 100% fluida, sem piscar o layout nem travar a transmissão em tempo real.
- **Persistência Imediata de Opções e Métricas do Equipamento**:
  - Ao editar um nó no modal ("Salvar Alterações"), o fluxograma agora salva imediatamente no banco de dados (`/network-maps/{id}`) todas as preferências de exibição de IP, métricas UniFi selecionadas, métricas Zabbix personalizadas, alertas sonoros e dimensões, sem depender de um segundo clique no topo da página.
  - Correção nas condições de renderização das métricas Zabbix e UniFi: quando o usuário desmarca métricas ou desmarca todas as opções, o card respeita a seleção e oculta os blocos correspondentes.
  - Adicionado `flag_modified` no backend SQLAlchemy para garantir que atualizações nos campos JSON de `nodes_data` e `edges_data` sejam gravadas com sucesso no PostgreSQL/SQLite.
- **Bloqueio Exclusivo por Inatividade Real (Modo Edição TV ao Vivo)**:
  - O modo de edição inline da TV pública (`isUnlocked`) agora opera com rastreamento de inatividade real via `useRef`, eliminando timers órfãos e re-renderizações indesejadas.
  - Qualquer interação do usuário (movimentar o mouse, clicar, arrastar equipamentos, digitar em formulários ou rolar a tela) atualiza o carimbo de tempo sem travar o painel.
  - O bloqueio automático para o cadeado ("Transmissão Pública ao Vivo") ocorre somente após **15 minutos contínuos de ausência total de interação**.
- **Persistência de Resolução (Zoom) e Posicionamento (Pan) em Cookies/LocalStorage**:
  - Cada TV ou monitor agora salva automaticamente seu enquadramento personalizado (nível de zoom e coordenadas de posicionamento `pan.x` e `pan.y`) nos Cookies e no LocalStorage do navegador com validade de 1 ano.
  - Ao ajustar o zoom, clicar em "Fit Tela" ou arrastar o diagrama na TV, as preferências daquele monitor são memorizadas automaticamente após 400ms.
  - Ao fechar o navegador da TV, desligar a TV ou reiniciar a máquina, o fluxograma reabre exatamente na escala, resolução e posicionamento definidos para aquela tela.
- **Carrossel Inteligente de Fluxogramas (TV NOC)**:
  - Permite criar uma playlist com múltiplos diagramas de rede para rotação contínua em loop em televisores e video walls.
  - **Tempo e Ordem Personalizáveis**: Cada fluxograma tem seu próprio tempo de exibição em segundos (mínimo de 5s) e ordem configurada em um modal interativo com botões de subir/descer e checkbox de ativação.
    - **Critério Preciso de Incidentes**: Apenas nós com alerta crítico configurado no fluxograma (`sound_alert_offline: true`) são considerados para congelar ou priorizar o carrossel, evitando bloqueios indevidos por equipamentos sem monitoramento.
    - Se todos os diagramas estiverem saudáveis, o carrossel percorre toda a playlist continuamente no tempo estipulado.
    - Se houver um alerta/incidente em **um único diagrama**, o carrossel **trava imediatamente** nesse mapa com um banner de alerta pulsante, garantindo que o problema seja visto pela equipe de TI.
    - Se houver alertas em **dois ou mais diagramas**, o carrossel entra em **Modo Prioritário**, alternando exclusivamente entre os mapas que possuem incidentes e ignorando os mapas normais.
    - Assim que todos os incidentes forem normalizados, o carrossel retoma o ciclo completo de todos os mapas.
  - **Interface Limpa para TV (Bloqueio de Controles)**:
    - No modo bloqueado da TV (`isUnlocked === false`), toda a linha superior com filtros (Localização, Tipo, Status), seletor de mapa, botões de visualização e engrenagem de configuração fica totalmente oculta.
    - **Apenas o botão Play/Pause do carrossel** (com status e contagem regressiva) permanece visível na TV para controle rápido.
    - Todos os controles e configurações são exibidos apenas quando o operador clica no cadeado e digita a senha de admin para desbloquear o painel.
  - **Pausa Automática na Edição**: Caso o operador destrave o painel da TV para editar equipamentos (`isUnlocked`), o carrossel pausa automaticamente para não atrapalhar o manuseio.
  - **Suporte a Link de Inicialização Direta**: Ao clicar em "Copiar URL TV", se o carrossel estiver ativo, a URL gerada já inclui `&carousel=true`, iniciando a rotação automaticamente na TV.
- **Duplicar / Clonar Fluxogramas**:
  - Disponível tanto no editor administrativo (`/admin/topology`) quanto no Painel NOC TV quando desbloqueado (`isUnlocked`).
  - Permite clonar instantaneamente um fluxograma existente com um único clique no botão **"Clonar"** (ao lado da seleção de mapas).
  - **Reutilização Total de Infraestrutura**: O clone preserva fielmente todos os racks, switches, nós, dimensões personalizadas, posições `(x, y)`, conexões e cabos (edges), nível de zoom e coordenadas de enquadramento.
  - Abre um modal solicitando o nome do novo fluxograma (preenchido por padrão como `[Nome] (Cópia)`) e descrição opcional.
  - Ao confirmar, o novo mapa é gravado no banco de dados e a interface alterna imediatamente para o diagrama recém-criado. O operador pode então apenas alterar os dispositivos conectados aos switches e racks (ex: trocar APs ou computadores de uma sala para outra) sem precisar remontar toda a estrutura física de racks e switches.
- **Áreas / Zonas com Contorno Adaptativo Dinâmico (Remodelagem Geométrica em Tempo Real via SVG)**:
  - Permite criar blocos de agrupamento espacial no canvas para separar setores físicos ou lógicos (ex: antenas do Administrativo vs. antenas dos Apartamentos).
  - **Geometria Dinâmica Adaptativa Nívelada (SVG Orthogonal + Rounded Corners + Medição Real DOM)**:
    - O contorno da área é renderizado na camada SVG através de um polígono ortogonal dinâmico com cantos arredondados (`rx="28" ry="28"`), garantindo que itens alinhados horizontal ou verticalmente mantenham bordas perfeitamente retas e niveladas (sem linhas diagonais inclinadas ou trapézios distorcidos).
    - **Leitura Direta da Altura Real no DOM**: O motor `getNodeRealDimensions` consulta o elemento do card renderizado (`topology-node-card-{id}` via `offsetHeight`), obtendo a altura e largura exatas pixel a pixel (incluindo todas as métricas UniFi, frequências 2.4G/5G, status e títulos longos), além de fallback seguro de 340px.
    - **Acompanhamento e Remodelagem em Tempo Real**: Ao arrastar qualquer equipamento membro pelo canvas, a área se expande, retrai e acompanha o movimento imediatamente a 60fps sem corte nem atraso.
    - **Cabeçalho Flutuante com Arrastar em Bloco**: O badge de identificação da área (`[ 🏢 ADM 4º ANDAR (2 itens) ]`) flutua dinamicamente no topo do bloco (`x + 24, y - 18`). Ao arrastar por esse cabeçalho, todos os nós membros se movem em sincronia pelo canvas.
    - **Cards de Áreas Vazias**: Áreas sem membros exibem um container delimitado com card central de configuração e botão direto para editar o nome ou vincular equipamentos, também podendo ser arrastados livremente.
  - **Paleta de Cores Temáticas**: Suporte a temas visualmente harmônicos com cores de traço SVG, preenchimentos translúcidos e realces de brilho (Azul Índigo, Verde Esmeralda, Roxo/Violeta, Âmbar/Laranja, Rosa/Carmim e Ciano/Turquesa).
  - **Associação Mútua Exclusiva**:
    - Cada equipamento só pode pertencer a uma única área/zona simultaneamente.
    - Pode ser vinculado pelo modal da Área (checklist com detecção de transferência) ou pelo modal individual do próprio equipamento (dropdown com seleção de bloco).
  - **Barra de Ferramentas com Botões Diretos e Alinhados**:
    - A barra de ferramentas mantém todos os botões principais organizados lado a lado:
      1. `[ + Adicionar Equipamento ]`
      2. `[ 🏢 Nova Área / Bloco ]`
      3. `[ 🔗 Conectar Nós (Cabos) ]`
      4. `[ ✏️ Editar Nó ]`: Botão direto na barra. Ao clicar em qualquer equipamento no mapa, ele abre o **modal de Conectar Nós em Modo Edição** (`Editar Conexão de Nós`), permitindo editar o rótulo/portas da conexão (ex: "Porta 19"), alterar origem/destino ou excluir o cabo com persistência imediata.
      5. `[ 🗑️ Excluir Nó ]`: Botão para exclusão do nó ou área selecionada.
  - **Edição de Conexões e Cabos (Edges)**:
    - **Clique no Botão "Editar Nó"**: Abre o modal de conexão no modo de edição para o equipamento selecionado. Caso o nó possua mais de uma ligação (ex: Switch ligado a múltiplos APs), uma barra superior no modal permite alternar entre as conexões em 1 clique.
    - **Clique Direto no Cabo no Canvas**: Clicar sobre qualquer linha de conexão ou etiqueta de porta no diagrama SVG abre imediatamente o modal de edição daquele cabo.
    - **Persistência Imediata**: Qualquer alteração de rótulo de porta ou nós de ligação é salva imediatamente no backend (`/network-maps/{id}`).
  - **Edição Imediata de Hardware e Equipamentos**:
    - **1-Clique no Card**: O card de cada equipamento mantém seu botão de lápis (✏️) dedicado para editar dados de hardware/CMDB, endereço IP e métricas UniFi/Zabbix.
    - **Vínculo com Áreas & Cards Compactos**: O campo *Área / Bloco de Agrupamento* permite vincular o equipamento, mas o nome da área não é exibido dentro do card, mantendo o tamanho do equipamento compacto e preservando espaço útil no fluxograma conforme configurado pelo usuário.
  - **Sanitização Automática de Coordenadas (Prevenção de Nós Invisíveis)**:
    - Qualquer nó ou área criada é posicionado de forma segura dentro dos limites visíveis do canvas (`safeX >= 80, safeY >= 80`), impedindo coordenadas negativas decorrentes de arrastos extremos de câmera ou TVs de alta resolução.
    - No carregamento do mapa, coordenadas fora do padrão são sanitizadas automaticamente para garantir visibilidade imediata.
  - **Card Central em Áreas Vazias**:
    - Áreas/Blocos recém-criados que ainda não possuem equipamentos associados agora exibem um card central intuitivo com o ícone, o nome da área e o botão `[ ✏️ Editar Nome & Vincular Itens ]`, eliminando caixas vazias ou imperceptíveis.
- **Alteração de Nome e Descrição do Fluxograma (Renomear)**:
  - Disponível tanto na barra superior quanto diretamente pelo canvas no editor e no Painel NOC TV (quando desbloqueado):
    1. **Botão "Renomear" na Barra Superior**: Localizado imediatamente ao lado do seletor de mapas e do botão de clonar (`[ ✏️ Renomear ]`), abre o modal para editar o título e descrição do fluxograma ativo com persistência imediata no backend.
    2. **Clique Direto no Badge Flutuante do Canvas**: O badge de identificação do fluxograma no canto superior esquerdo agora conta com ícone de lápis interativo (✏️) e pode ser clicado diretamente para editar o nome e descrição do ambiente sem precisar procurar na barra de ferramentas.
  - Atualiza instantaneamente a lista de mapas (`mapsList`), o cabeçalho, a tela do operador e os dashboards de TV.
- **Badge Flutuante de Identificação do Fluxograma (Modo TV & Edição)**:
  - Overlay em estilo Glassmorphism fixado no canto superior esquerdo do canvas (`absolute top-4 left-4 z-40`).
  - Exibe o nome do fluxograma ativo (`mapData.name`) com indicador luminoso pulsante e descrição do ambiente, garantindo que em monitores de TV (mesmo no modo trancado) e durante o carrossel a equipe saiba no primeiro segundo qual andar ou setor está sendo exibido.


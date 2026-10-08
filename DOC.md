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

Fechamento de Ticket: Técnicos não fecham chamados de usuários comuns sem aprovação; o técnico altera para "Resolvido" e o gestor valida via magic link. Para encerramentos diretos por técnicos/admins (inclusive alertas NOC e manutenções) ou aprovação do gestor, o sistema exige obrigatoriamente a inclusão do Motivo do Fechamento (`closure_reason`), persistido no banco e na timeline tanto em fechamentos individuais quanto em massa.

Seletor Inteligente de Localização Física vs. UH:
- **Disponibilidade**: Disponível tanto no Portal Público de Chamados (`/public/ticket`), no PWA do Colaborador (`/app/new-request`) quanto no Painel da TI (`/admin/tickets/new`).
- **Alternador Visual**: Permite alternar instantaneamente entre `🏢 Local Físico / Setor` e `🛏️ Apartamento / UH`.
- **Modo UH (Apartamento)**: Lista dinamicamente as 30 UHs cadastradas no sistema (`User.is_room == True`), organizadas por andares (1º, 2º e 3º Andar).
- **Modo Local Físico / Setor**: Lista os locais cadastrados na tabela `Location` (`Gero`, `Bar da Piscina / Rooftop`, `Recepção/Lobby`, etc.), com destaque visual automático `⭐ [Seu Setor]` combinando o departamento do solicitante. Permite ainda preenchimento de ponto de referência/complemento ou especificação de "Outro Local".
- **Identificação no Chamado**: O local selecionado é automaticamente prefixado no título do ticket (ex: `[UH 204] Wi-Fi oscilando` ou `[GERO - MESA 4] Ponto de rede inoperante`), garantindo triagem visual imediata e notificações precisas.

Categorias Públicas vs. Internas (TI / Atendentes):
- **Campo `is_public` no Banco**: Adicionado campo booleano na tabela `categories` para determinar se a categoria pode ser visualizada por usuários finais e colaboradores comuns.
- **Governança no Painel de Configurações (`/admin/settings`)**:
  - Badge/Toggle de 1 clique (`🌐 Pública` / `🔒 Interna TI`) diretamente no cabeçalho do card de cada categoria.
  - Seleção nos modais de criação e edição de categorias.
- **Isolamento de Segurança**: Categorias técnicas de infraestrutura (ex: `Docker Server`, `Hypervisors`, `Linux servers`, `Virtual machines`, `Databases`, `Windows Server`) são restritas estritamente para a equipe de TI.
- **Filtro Automático de APIs**:
  - `GET /api/v1/public/categories`: Retorna apenas categorias ativas e públicas.
  - `GET /api/v1/categories`: Retorna categorias públicas para usuários comuns do portal, e o catálogo completo para técnicos e administradores.
  - No Painel de Criação da TI (`/admin/tickets/new`), categorias internas são sinalizadas com o selo `🔒 [Interna TI]`.

Locais Físicos Públicos vs. Internos (`Location.is_public`):
- **Campo `is_public` no Banco**: Adicionado à tabela `locations` com default `True`.
- **Governança no Painel de Configurações (`/admin/settings`)**:
  - Coluna de Visibilidade com botão toggle de 1 clique (`🌐 Pública` / `🔒 Interna TI`) na tabela de locais.
  - Checkbox explicativo nos modais de criação e edição de localizações físicas.
- **Controle de Escopo**: Locais estritamente técnicos (ex: `Racks TI - CPD`, Data Centers, Salas Elétricas) permanecem marcados como `Interna TI`, servindo para alocação de ativos CMDB e chamados de técnicos, mas ocultos para usuários comuns e do formulário público.
- **Filtro nas APIs**:
  - `GET /api/v1/public/locations`: Retorna somente locais onde `is_active == True` e `is_public == True`.
  - `GET /api/v1/locations/`: Retorna locais públicos para usuários comuns e o catálogo completo para admins/técnicos.

Gestão Completa de Apartamentos & UHs (`/admin/settings`):
- **Módulo Dedicado de UHs**: Interface completa para gestão dos quartos do hotel integrada à tabela de `User` (`is_room == True`), preservando histórico e vínculos de ativos do CMDB.
- **Dashboard Operacional Redesenhado**: Substituídos os contadores individuais por andar por 4 métricas essenciais de gestão hoteleira e TI:
  1. **Total de UHs**: Contagem total de apartamentos cadastrados.
  2. **UHs Operacionais**: Quartos ativos disponíveis para hóspedes e chamados, com sinalização de desativações.
  3. **Ativos em UHs**: Quantidade total de TVs, APs UniFi, decodificadores e ramais alocados no CMDB.
  4. **Chamados em Aberto**: Quantidade de tickets técnicos pendentes em apartamentos.
- **Filtro Inteligente de Andares**: A barra de filtros exibe exclusivamente os andares que possuem UHs cadastradas (ex: 1º Andar, 2º Andar, 3º Andar), acompanhados do badge com a contagem de quartos. Andares prediais sem quartos (Subsolos, Térreo, Rooftop, salas técnicas) são automaticamente omitidos do grid de UH para não poluir a interface.
- **Barra de Busca**: Busca em tempo real por número ou nome descritivo da UH.
- **Tabela de Inventário**: Exibe número, nome descritivo, ramal telefônico, contadores de ativos alocados (TVs, APs, etc.), chamados abertos e status ativo/inativo.
- **Ações Rápidas**:
  - Toggle de 1 clique para ativar/desativar UH.
  - Modal para cadastrar ou editar número, nome, ramal e status.
  - Exclusão com desativação preventiva de segurança caso possua histórico de chamados ou ativos vinculados.
- **Endpoints de Backend**: `GET /api/v1/rooms/`, `POST /api/v1/rooms/`, `PATCH /api/v1/rooms/{id}`, `PATCH /api/v1/rooms/{id}/toggle-active`, `DELETE /api/v1/rooms/{id}`.

Gestão Completa de Andares & Pavimentos (`/admin/settings` - Módulo Andares):
- **Tabela `Floor` no Banco**: Mapeamento estrutural de andares e pavimentos do hotel com `name` (ex: "Térreo", "Subsolo", "1º Andar" ao "7º Andar / Rooftop"), `number` (nível numérico para ordenação vertical), `description` e `is_active`.
- **Painel de Controle em "Hotel & Espaços"**:
  - Interface dedicada com métricas de topo: Total de andares, andares ativos, UHs alocadas por andar e quantidade de locais físicos vinculados.
  - Tabela com ordenação por nível vertical, busca em tempo real e botão toggle de ativação/desativação em 1 clique.
  - Modal para cadastrar novos andares, definir ordem numérica e editar descrições.
- **Integração Bidirecional**:
  - **No Cadastro de UHs**: Campo select dinâmico permitindo atribuir explicitamente qualquer andar cadastrado ou manter auto-detecção numérica.
  - **No Filtro de UHs**: Botões de filtro gerados dinamicamente a partir dos andares cadastrados e ativos.
  - **No Cadastro de Locais Físicos**: Seletor inteligente integrado com a lista de andares cadastrados.
  - **Nos Portais de Chamados (PWA, Público e Admin)**: Agrupamento dinâmico automático das UHs pelos andares reais cadastrados (`r.floor`).
- **Endpoints de Backend**: `GET /api/v1/floors/`, `POST /api/v1/floors/`, `PATCH /api/v1/floors/{id}`, `PATCH /api/v1/floors/{id}/toggle-active`, `DELETE /api/v1/floors/{id}`.

Ordenação Personalizada de Localizações Físicas (`Location.order_index`):
- **Controle Total da Sequência Predial**: Adicionada a coluna `order_index` (inteiro) na tabela `locations` para permitir que o usuário defina a ordem exata das áreas físicas (ex: Subsolo 2, Subsolo 1, Térreo, 1º Andar, 2º Andar, Racks TI - CPD), superando a ordenação alfabética padrão.
- **Reordenação com 1 Clique (⬆️ / ⬇️)**: Na tabela de configurações (`/admin/settings`), cada localidade possui botões dedicados de subir e descer que reorganizam e normalizam instantaneamente a sequência inteira.
- **Edição Numérica no Formulário**: O modal de cadastro/edição de localização física possui o campo "Ordem de Exibição" para ajuste manual direto da posição.
- **Endpoint de Backend**: `PATCH /api/v1/locations/{id}/move?direction=up|down` que reordena e salva as posições sequenciais.
- **Consistência em Toda a Aplicação**: Os seletores de chamados (`PublicTicketForm.jsx`, `NewRequest.jsx`, `NewTicket.jsx`), CMDB de ativos (`Assets.jsx`) e Topologia agora listam as localizações rigorosamente ordenadas por `order_index ASC, name ASC`.

Atribuição e Criação Rápida de Andar no Cadastro de UHs:
- **Criação Inline sem Sair do Modal**: No formulário de "Novo / Editar Apartamento (UH)", o campo "Andar / Pavimento" conta com um botão em destaque `+ Novo Andar`, que abre o modal de criação de andar com sobreposição de camada (`z-60`).
- **Auto-Preenchimento Imediato**: Ao salvar o novo andar criado, o formulário da UH seleciona e preenche automaticamente o novo pavimento criado.
- **Atalho Rápido na Aba de UHs**: Adicionado o botão `Gerenciar Andares` no cabeçalho da aba de Apartamentos/UHs para navegação instantânea à gestão completa de pavimentos.
- **Campo Flexível**: Permite selecionar da lista existente ou digitar livremente um pavimento específico.

Navegação Direta e Detalhada do Ativo CMDB a partir do Agente / Telemetria:
- **Acesso Direto com 1 Clique**: Ao clicar no selo `CMDB #{id}` no card de qualquer estação ou servidor monitorado (`StationMonitoringTab.jsx`), o sistema redireciona diretamente para `/admin/assets?assetId={id}&search={hostname}`.
- **Abertura Automática do Inventário**: A página de Ativos (`Assets.jsx`) detecta os parâmetros de URL, localiza o ativo correspondente, aplica realce visual (borda azul e fundo destacado) na linha da tabela e abre imediatamente o Modal de Inventário Completo (GLPI) com todos os dados de hardware, CPU, memória, discos, SO e histórico.
- **Interatividade na Grid de Ativos**: O nome e ícone de qualquer ativo na tabela e nos cards agora são clicáveis diretamente para abrir a ficha de inventário completa.

Integridade dos Seletores de Localização Física (CMDB & Chamados):
- **Correção de Escopo de Retorno**: Ajustada a lógica de `GET /api/v1/locations/` para que o painel de Ativos (CMDB) e administradores/técnicos recebam todas as localizações ativas (públicas e internas à TI como CPD e Racks), sem bloqueio indevido por ausência de filtro explícito.
- **Carga de Locais Oficiais do Hotel**: Semeadas as localizações essenciais do Hotel Fasano Salvador com status ativo: `Recepção / Lobby`, `Restaurante Fasano / Gero`, `Bar da Piscina / Rooftop`, `Academia & Spa`, `Salão de Eventos / Business Center`, `Racks TI - CPD`, `Cozinha Central`, `Governança & Rouparia`, `Sala de Manutenção / Oficina` e `Garagem / Valet`.
- **Preenchimento nos Modais**: O seletor de localização física do modal "Editar Equipamento" (`Assets.jsx`) e telas de chamados (`NewTicket.jsx`, `NewRequest.jsx`, `PublicTicketForm.jsx`) agora exibe toda a árvore de locais cadastrados com o andar correspondente entre parênteses.

Novo Menu Lateral Agrupado de Configurações (`/admin/settings`):
- **Substituição da Barra Horizontal**: A barra horizontal anterior (que quebrava em múltiplas linhas com o crescimento dos módulos) foi substituída por uma barra lateral moderna (Sticky Sidebar) agrupada em 5 categorias temáticas:
  1. **Hotel & Espaços**: Localizações Físicas, Apartamentos (UHs), Andares & Pavimentos, Setores & Grupos.
  2. **Helpdesk & Chamados**: Categorias, Tipos de Problema, Diretrizes de SLA.
  3. **Equipamentos & CMDB**: Tipos de Equipamento.
  4. **Integrações**: Importação AD / LDAP, Integração Zabbix, Telefonia & WhatsApp.
  5. **Segurança & Sistema**: Usuários & Permissões, Parâmetros Gerais.
- **Experiência Visual**: Navegação categorizada, indicação do módulo ativo com realce azul e contador dinâmico de módulos disponíveis, mantendo layout limpo e expansível.

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
    - **Critério Preciso de Incidentes (Detecção Híbrida UniFi + Zabbix)**:
      - Apenas nós com alerta crítico configurado no fluxograma (`sound_alert_offline: true`) são considerados para congelar ou priorizar o carrossel.
      - **Integração Realtime no Backend (`/network-maps`)**: Cruza os nós monitorados tanto com triggers do **Zabbix** quanto com o status em tempo real da controladora **UniFi Controller** (`state === 0`), identificando quedas de antenas APs e switches UniFi instantaneamente (com checagem de IP e MAC tanto em nós avulsos quanto em ativos contidos em Racks).
      - **Callback Instantâneo no Frontend (`onAlertStatusChange`)**: O `TopologyMapBuilder` comunica imediatamente o componente pai (`PublicNocPanel`) no milissegundo em que um alarme sonoro é disparado, sem aguardar o próximo ciclo de polling.
    - Se todos os diagramas estiverem saudáveis, o carrossel percorre toda a playlist continuamente no tempo estipulado.
    - Se houver um alerta/incidente em **um único diagrama**, o carrossel **pula imediatamente para este mapa e congela a rotação**, exibindo badge luminoso `ROTAÇÃO CONGELADA NO INCIDENTE` e banner de atenção, permanecendo travado até a normalização do equipamento.
    - Se houver alertas em **dois ou mais diagramas**, o carrossel entra em **Modo Prioritário de Incidentes**, alternando exclusivamente entre os mapas afetados no tempo estipulado de cada um e ignorando completamente os mapas normais.
    - Assim que todos os incidentes forem normalizados, o carrossel retoma automaticamente o ciclo completo de todos os mapas da TV.
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
  - **Geometria Dinâmica Adaptativa em Formato de Bolha (SVG Bubble / Convex Hull com Cantos Arredondados + Medição Real DOM)**:
    - O contorno da área é calculado e renderizado dinamicamente na camada SVG através de um envelope convexo com cantos arredondados (`generateBubblePath` e `computeConvexHull`), formando uma **"bolha" orgânica e adaptativa** ao redor de todos os equipamentos do bloco.
    - **Comportamento quando alinhados horizontalmente**: Mantém as bordas superior e inferior rigorosamente retas, niveladas e sem inclinações indesejadas.
    - **Comportamento quando deslocados ou baixados (diagonal/altura diferente)**: As linhas superior e inferior conectam os equipamentos suavemente pelas tangentes externas das caixas, seguindo a geometria exata como uma cápsula/bolha (sem formar retângulos vazios gigantescos e sem cortar nenhum equipamento).
    - **Leitura Direta da Altura Real no DOM**: O motor `getNodeRealDimensions` consulta o elemento do card renderizado (`topology-node-card-{id}` via `offsetHeight`), obtendo a altura e largura exatas pixel a pixel (incluindo todas as métricas UniFi, frequências 2.4G/5G, status e títulos longos), além de fallback seguro de 340px.
    - **Acompanhamento e Remodelagem em Tempo Real**: Ao arrastar qualquer equipamento membro pelo canvas, a bolha se expande, retrai e acompanha o movimento imediatamente a 60fps sem corte nem atraso.
    - **Movimento e Arraste Fluido de Áreas e Equipamentos**:
      - **Zero Atraso (Zero-Lag Dragging)**: Durante o arrasto de cards ou blocos, a transição CSS é desativada instantaneamente (`transition: none`), eliminando a latência de 150ms e garantindo que o card acompanhe o cursor com precisão absoluta pixel a pixel.
      - **Rastreamento Global Contínuo**: O movimento é capturado nos eventos globais de `window`, impedindo que o cursor escape do card ou perca o foco durante arrastos rápidos.
      - **Proteção Anti-Reversão de Posições antes de Salvar (`hasUnsavedChangesRef`)**:
        - Ao arrastar nós, mover áreas completas ou redimensionar elementos no canvas, o sistema registra as novas coordenadas em memória e ativa o estado de alterações pendentes com proteção em tempo real (`hasUnsavedChangesRef`).
        - O timer periódico de 15 segundos (`refreshMapStatuses`) e o countdown da TV pública (`refreshTrigger`) consultam essa referência mutável: enquanto houver edições locais em andamento, o recarregamento do mapa do banco de dados é rigorosamente bloqueado, executando apenas a sincronização não-destrutiva de status de ICMP e Zabbix sem alterar as posições `(x, y)` dos nós.
        - O usuário pode arranjar e mover livremente todos os equipamentos e áreas sem risco de reversão ou snap-back involuntário, confirmando todas as novas posições de forma definitiva ao clicar no botão **`[ 💾 Salvar Mapa ]`**.
        - Inclui listener de proteção de navegador (`beforeunload`) avisando sobre alterações pendentes antes de fechar ou atualizar a aba.
      - **Prevenção de Colisão e Desvio Inteligente de Racks (`avoidRacksInHull`)**:
        - Nenhum equipamento de área pode ficar embaixo ou sobreposto a racks durante o arrasto manual (`margin: 25px`).
        - O motor de geometria adaptativa (`avoidRacksInHull`) detecta todos os Racks no diagrama e intercepta qualquer segmento de contorno que cruze a caixa delimitadora do Rack (margem de segurança de 28px).
        - A linha pontilhada da bolha calcula uma rota de desvio pelas quinas externas do Rack (arestas $TL$, $TR$, $BL$, $BR$), contornando suavemente as bordas e garantindo que o contorno da área **nunca passe por trás nem corte o Rack**, respeitando 100% o espaço físico do Rack na topologia.
      - **Suporte Total a Coordenadas Negativas e Overflow Sem Cortes**:
        - A camada SVG de contornos e a camada DOM de cabeçalhos contam com `overflow: visible`, impedindo cortes na linha $X = 0$ e garantindo que bolhas envolvendo equipamentos em qualquer quadrante do canvas permaneçam 100% visíveis e contínuas.
    - **Cards de Áreas Vazias**: Áreas sem membros exibem um container delimitado com card central de configuração e botão direto para editar o nome ou vincular equipamentos, também podendo ser arrastados livremente.
  - **Paleta de Cores Temáticas**: Suporte a temas visualmente harmônicos com cores de traço SVG, preenchimentos translúcidos e realces de brilho (Azul Índigo, Verde Esmeralda, Roxo/Violeta, Âmbar/Laranja, Rosa/Carmim e Ciano/Turquesa).
  - **Associação Mútua Exclusiva**:
    - Cada equipamento só pode pertencer a uma única área/zona simultaneamente.
    - Pode ser vinculado pelo modal da Área (checklist com detecção de transferência) ou pelo modal individual do próprio equipamento (dropdown com seleção de bloco).
  - **Barra de Ferramentas com Botões Diretos e Alinhados**:
    - A barra de ferramentas mantém todos os botões principais organizados lado a lado:
      1. `[ + Adicionar Equipamento ]`: Adiciona um equipamento individualmente.
      2. `[ 📑 Adicionar em Lote ]`: Adiciona múltiplos equipamentos do CMDB de uma só vez (ex: várias antenas UniFi ou switches de um andar) com configurações padrão compartilhadas (área/bloco de destino, tipo de ícone, métricas UniFi e alerta sonoro), organizando-os automaticamente em grade no canvas sem sobreposição.
      3. `[ 🏢 Nova Área / Bloco ]`
      4. `[ 🔗 Conectar Nós (Cabos) ]`
      5. `[ ✏️ Editar Equipamento ]` / `[ ✏️ Editar Área ]`: Botão contextual na barra quando exatamente 1 item está selecionado. Ao clicar em qualquer equipamento no mapa, abre o modal de edição de hardware do equipamento (nome, IP, dimensões, métricas UniFi/Zabbix, som de alerta, ativo vinculado). Se uma área for selecionada, abre a edição da área.
      6. `[ 🔗 Editar Nó ]` e `[ ✂️ Excluir Nó ]`: Exibidos dinamicamente apenas quando o equipamento selecionado possuir conexões/nós de cabo ligados a ele (`nodeEdges.length > 0`). Permitem editar portas, destino ou remover com segurança a conexão do nó de cabo sem apagar o equipamento. Se o equipamento não possuir nós conectados, esses botões não são exibidos.
      7. `[ 🗑️ Excluir Equipamento ]` / `[ 🗑️ Excluir Área ]`: Botão contextual com confirmação para excluir com segurança o equipamento ou a área selecionada do fluxograma.
      8. `[ 🗹 X selecionados ]` + `[ 🗑️ Excluir Selecionados (X) ]` + `[ ✕ Limpar ]`: Painel de ações em lote exibido quando múltiplos equipamentos são selecionados simultaneamente (segurando `Ctrl` ou `Cmd`).
  - **Seleção Múltipla com Ctrl / Cmd e Operações em Bloco**:
    - **Seleção com `Ctrl + Clique`**: Segure a tecla `Ctrl` (ou `Cmd` no macOS) e clique em múltiplos equipamentos ou áreas para adicioná-los ou removê-los da seleção ativa.
    - **Feedback Visual Claro**: Cards selecionados recebem anel de destaque em azul brilhante e um badge circular com ícone de `Check` no cabeçalho quando fazem parte de uma seleção múltipla.
    - **Exclusão em Lote**: Botão dedicado `Excluir Selecionados (X)` na barra superior e atalhos rápidos de teclado (`Delete` ou `Backspace`) com caixa de diálogo de confirmação detalhada para remover múltiplos equipamentos e suas respectivas conexões de cabo de uma só vez.
    - **Arrasto e Movimentação Sincronizada em Grupo**: Ao clicar e arrastar qualquer um dos equipamentos pertencentes à seleção múltipla, todos os itens selecionados se deslocam juntos em tempo real mantendo o alinhamento e distâncias relativas intactas.
    - **Desmarcação Rápida**: Clique no botão `Limpar` ou em qualquer área vazia do canvas (sem Ctrl) para desmarcar todos os equipamentos.
  - **Adicionar e Atualizar Equipamentos em Lote (Batch Import com Dimensões e Métricas Personalizadas)**:
    - Permite selecionar múltiplos equipamentos através de filtros rápidos de tipo (`Antenas / APs`, `Switches`, `Servidores`, `Todos`) e busca por texto/IP.
    - **Ajuste de Dimensões em Lote (Largura e Altura)**:
      - Inclui controle de largura (px) com botões de preset rápido: `Padrão (220px)`, `Médio (260px)`, `Largo (300px)`, `Extra (340px)` e `Auto`.
      - Campo opcional de altura mínima (px) para padronizar o layout visual de todos os equipamentos selecionados.
      - Espaçamento horizontal (`gapX`) e vertical (`gapY`) dinâmico e inteligente baseado na largura e altura escolhidas, garantindo grade limpa sem sobreposições.
    - **Atualização / Edição em Lote de Nós Existentes ("Já no Mapa")**:
      - Se um equipamento selecionado na lista já estiver presente no fluxograma, a ação de lote **atualiza / edita** suas métricas, dimensões (largura/altura), área/bloco de destino, ícone e alerta sonoro in-place, sem criar nós duplicados e preservando suas posições `(x, y)` no canvas.
      - Para equipamentos que ainda não estão no mapa, novos nós são criados com as configurações e posicionados automaticamente.
      - O rodapé do modal indica com precisão o resumo da ação: `Adicionando X novo(s) e Atualizando/Editando Y já no mapa`.
    - **Seleção Precisa de Métricas e Presets Rápidos**:
      - Presets em 1 clique: `[ 📡 Wi-Fi (AP) ]` (seleciona WiFi Exp., Clientes e Uso de Canal), `[ 🔀 Switches ]` (LAN Exp., RX/TX Rates e Uptime), `[ ⚡ Todas ]` e `[ 🚫 Nenhuma ]`.
      - Clonagem profunda dos arrays de métricas em `display_options` e `rack_display_options`, garantindo que seleções customizadas sejam gravadas com fidelidade no banco de dados e refletidas imediatamente nos cards.
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
- **Reorganização e Ordenação dos Fluxogramas (Dropdown e Carrossel da TV NOC)**:
  - Disponível diretamente na barra de ferramentas ao lado do seletor de mapas através do botão **`[ ↕️ Ordenar ]`** no Construtor de Topologia (`TopologyMapBuilder`) e na modal de configuração do carrossel no Painel NOC TV (`PublicNocPanel`).
  - **Ordenação Rápida Inteligente A → Z (Numérica Natural)**:
    - Botão **`[ 🔤 A → Z (Numérica) ]`** que reorganiza todos os fluxogramas em 1 clique utilizando ordenação natural (`localeCompare` com `{ numeric: true }`).
    - Resolve cenários onde fluxogramas foram criados fora de sequência (ex: criou 4º ao 6º Andar e depois 1º ao 3º Andar): o algoritmo agrupa e ordena respeitando os números de cada andar (`1º Andar`, `2º Andar`, ..., `6º Andar`).
    - Botão **`[ Z → A ]`** para inversão de ordem quando desejado.
  - **Reordenação Manual Fina (Setas ↑ e ↓)**:
    - Lista visual com identificadores de posição (`#1`, `#2`, `#3`...), badge indicando o mapa atualmente aberto e botões de subir e descer para posicionar qualquer ambiente na ordem exata desejada.
  - **Sincronização Imediata e Persistência Determinística no Backend**:
    - Ao salvar, os dados são enviados em lote via `PUT /api/v1/network-maps/carousel/batch`, atualizando o atributo `carousel_order` de cada mapa.
    - A nova sequência é refletida instantaneamente no dropdown de seleção do topo da página e na playlist de rotação da TV.
    - O backend passa a listar os mapas de forma rigorosamente estável por `NetworkMap.carousel_order.asc(), NetworkMap.id.asc()`. Ao criar um novo mapa em branco ou clonar um mapa existente, o sistema atribui automaticamente a próxima ordem disponível (`func.max(NetworkMap.carousel_order) + 1`), evitando colisão de posições e preservando a organização já definida pelo usuário.
- **Métrica UniFi de Portas de Switches (Portas Conectadas e Livres)**:
  - Integração nativa com a API UniFi para leitura em tempo real do array `port_table` de cada switch gerenciado na rede do hotel.
  - **Exibição Visual no Card do Switch**:
    - **Contador Dinâmico**: Exibe o total de portas do switch com contagem exata de portas conectadas (`● X up` em verde) e desconectadas/livres (`○ Y down` em cinza escuro).
    - **Indicador de PoE Ativo**: Exibe badge sutil `⚡ Z PoE` indicando a quantidade de portas que estão ativamente alimentando dispositivos PoE (como antenas UniFi AP e telefones IP).
    - **Barra de Ocupação Visual**: Mini barra horizontal de ocupação indicando graficamente o percentual de portas ocupadas vs. livres com tooltip explicativo.
    - **Configuração Flexível**: Disponível nas *Opções de Exibição / Métricas UniFi* com o checkbox **"Portas Up/Down (SW)"** nos modais de criação, edição individual e adição/atualização em lote (incluído por padrão no preset rápido `[ 🔀 Switches ]`).
- **Segregação Contextual Estrita de Métricas UniFi (Switches vs. Antenas/APs)**:
  - **Cards de Switches**: Exibem exclusivamente métricas pertinentes a comutação e infraestrutura: CPU, RAM, Uptime, Firmware, Portas Up/Down (Conectadas e Livres com PoE), Taxas RX/TX das portas físicas e Experiência LAN (%). Bloqueio absoluto de dados irrelevantes de Wi-Fi (como WiFi Experience, Clientes conectados e Uso de canais 2.4G/5G).
  - **Cards de Antenas / Access Points (APs)**: Exibem exclusivamente métricas pertinentes à rede sem fio e rádio: CPU, RAM, Uptime, Firmware, WiFi Experience (%), Clientes Conectados, Uso de Canais (2.4G / 5G / 6G com canal e % de ocupação), Taxas RX/TX de Wi-Fi e Uplink LAN (velocidade e duplex do cabo de rede do AP). Bloqueio absoluto de métricas de portas físicas de switch.
  - **Cards de Racks e Equipamentos Agregados**:
    - Detecção dinâmica baseada nos ativos contidos no Rack (`child_asset_ids`): caso o Rack possua apenas Switches, o painel e os modais exibem exclusivamente métricas pertinentes a Switches (`Métricas UniFi (Switches no Rack)`), suprimindo totalmente opções de AP. Caso possua apenas Antenas, exibe exclusivamente métricas de Antenas/Wi-Fi (`Métricas UniFi (Antenas no Rack)`), suprimindo contadores de portas. Caso possua ambos, categoriza e exibe ambos.
    - No canvas, cada ativo filho renderiza suas métricas contextuais de acordo com sua categoria individual (`isAssetOrDeviceSwitch` vs `isAssetOrDeviceAP`).
  - **Filtro Dinâmico nos Formulários e Modais de Configuração (`batchAddForm`, `newNodeForm`, `editNodeForm`)**:
    - As opções de seleção de métricas são filtradas dinamicamente com base no tipo de equipamento selecionado (`icon_type`) e nos ativos contidos no Rack em tempo real.
    - Botões rápidos `[ Todas ]` e `[ Nenhuma ]` adicionados aos modais de criação e edição individual para aplicar ou limpar opções contextuais em 1 clique.
- **Monitoramento Contínuo UniFi (Switches e APs Offline & Notificação WhatsApp)**:
  - **Worker Periódico em Background (`unifi_poller_task`)**:
    - Executado continuamente em segundo plano pelo FastAPI (`backend/app/main.py`) a cada 60 segundos com processamento não-bloqueante (`asyncio.to_thread`).
    - Consulta os dispositivos adotados na controladora UniFi (`UnifiService.get_devices()`).
  - **Abertura Automática de Chamados (`sync_active_unifi_devices`)**:
    - Quando um Switch ou Access Point fica desconectado/offline na controladora (`state == 0`):
      - Identifica se o dispositivo possui ativo correspondente no CMDB (por MAC, IP ou Nome).
      - Checa idempotência: caso já exista um chamado aberto ou em andamento (`NEW`, `IN_PROGRESS` ou `PENDING_VALIDATION`) com o título `[NOC UniFi] Dispositivo Offline - {nome}`, não gera duplicatas.
      - Cria automaticamente o chamado com status `Novo` (`NEW`), prioridade Crítica para Switches e Alta para APs, vinculado ao solicitante de sistema `unifi.system` (`Sistema UniFi NOC`).
  - **Notificação Imediata no WhatsApp para o Grupo de TI**:
    - Dispara mensagem automática com alta visibilidade para o grupo de TI configurado na Evolution API:
      ```text
      🚨 *ALERTA UNIFI: DISPOSITIVO OFFLINE* 🚨
      
      ⚠️ *Equipamento:* {nome}
      🏷️ *Tipo:* Switch de Rede / Access Point (Wi-Fi) ({modelo})
      🌐 *IP:* {ip} | *MAC:* {mac}
      🔴 *Status:* Desconectado na Controladora UniFi
      
      🎫 *Chamado automático aberto:* #{ticket.id}
      ```
  - **Auto-Resolução e Notificação de Restabelecimento**:
    - Assim que o Switch ou AP volta a responder na controladora (`state == 1`), o chamado aberto é atualizado automaticamente para `Aguardando Validação` (`PENDING_VALIDATION`) com registro da normalização no histórico.
    - O sistema envia a notificação de restabelecimento no WhatsApp:
      ```text
      ✅ *UNIFI: DISPOSITIVO RESTABELECIDO!* ✅
      
      O equipamento *{nome}* ({modelo}) restabeleceu a comunicação com a controladora UniFi.
      
      🎫 O chamado *#{ticket.id}* está aguardando validação para encerramento.
      👉 *Atenção equipe de TI: favor validar e finalizar o chamado no painel!*
      ```
- **Monitoramento Ativo de Conflitos de IP e Alertas Críticos UniFi (Abertura Automática de Chamados & Notificação Dual)**:
  - **Objetivo**: Detectar proativamente e transformar em chamados de suporte técnico de prioridade **CRÍTICA** qualquer anomalia grave ou evento não resolvido da controladora UniFi antes mesmo de a equipe precisar acessar o painel da controladora.
  - **Fontes Monitoradas Continuamente no Poller (60s)**:
    1. **Conflitos de Endereço IP na Rede Local**:
       - Monitora em tempo real a tabela de clientes conectados (`/stat/sta`).
       - Detecta conflitos reais quando dois ou mais dispositivos distintos (MAC addresses diferentes) estão conectados e ativos **simultaneamente** com o mesmo endereço IP (desconsiderando histórico de leases de clientes desconectados para não gerar falso positivo em rotação comum de DHCP).
       - Mapeia com exatidão os nomes dos equipamentos, MACs, rede/VLAN e em qual switch e porta física cada dispositivo está conectado.
    2. **Logs Críticos e Unresolved Events da Aba "Crítico" (`/v2/api/site/{site}/next-ai/logs`)**:
       - Servidor DHCP fraudulento na rede (*Rogue DHCP*) e esgotamento de pool DHCP.
       - Loops de rede detectados por Spanning Tree Protocol (*STP*) ou keepalive.
       - Quedas de fornecimento elétrico em switch ou fonte redundante (*RPS*).
       - Falhas severas de conexão de internet WAN e transições de *Failover LTE*.
       - Quedas de túneis VPN Site-to-Site corporativos.
       - Problemas de servidor RADIUS corporativo ou expiração iminente de certificados SSL.
    3. **Alarmes de Infraestrutura Ativos (`/api/s/{site}/stat/alarm?archived=false`)**:
       - Portas bloqueadas por protocolo Spanning Tree (`EVT_SW_StpPortBlocking`), sobrecarga de energia PoE (`EVT_SW_PoeOverload`), anomalias de gateway e roteamento.
  - **Regras de Chamado Automático e Idempotência Rigorosa**:
    - **Criação de Chamado**: Cria chamado de prioridade `Crítica` (`CRITICAL`), status `Novo` (`NEW`), vinculado ao usuário de sistema `Sistema UniFi NOC` e associado ao ativo no CMDB (se identificado por MAC ou IP).
    - **Idempotência**: Verifica se já existe chamado gerado no dia de hoje (`Ticket.created_at >= today_start_utc`) para o mesmo conflito ou alarme, impedindo a abertura de chamados duplicados a cada ciclo do poller.
    - **Reabertura Automática em Reincidência**: Caso o chamado do dia tenha sido fechado ou colocado em validação e o alerta crítico ou conflito volte a ocorrer, o chamado é reaberto automaticamente para `Em Andamento` (`IN_PROGRESS`), com registro da reincidência no histórico e notificação de alerta reaberto.
    - **Auto-Normalização**: Quando o conflito cessa ou o alerta é resolvido na rede, o chamado avança para `Aguardando Validação` (`PENDING_VALIDATION`) com nota explicativa para conferência do técnico.
  - **Disparo Dual Imediato (WhatsApp Evolution API + E-mail Corporativo)**:
    - **Notificação no WhatsApp**: Formatação clara com emojis de alerta NOC, IP conflitante, lista de dispositivos concorrentes (com switch e porta física) e recomendações de intervenção técnica.
    - **E-mail Corporativo**: Mensagem com tabela HTML estilizada e orientações de correção imediata.
  - **Sincronização Integrada em Tempo Real nos Mapas de Rede**: O endpoint `/api/v1/network-maps/` executa a checagem e disparo imediato no instante em que o NOC detecta o nó desconectado no painel visual, sem aguardar o intervalo do background poller.
  - **Isolamento de Chamados por Origem**: A checagem de chamados abertos valida exclusivamente tickets gerados pelo próprio NOC UniFi (`[NOC UniFi]`), evitando que chamados manuais ou de outras origens associados ao ativo bloqueiem o alerta.
  - **Endpoint de Sincronização Manual**: `POST /api/v1/integrations/unifi/sync-devices` disponível para administradores forçarem a checagem imediata.
  - **Garantia Geral em Ativos Offline (`_auto_create_ticket_if_offline`)**: Qualquer ativo do CMDB detectado como sem resposta a Ping ICMP agora também dispara notificação com o chamado criado para o WhatsApp do grupo de TI.


Deploy e Operação em Produção (Ubuntu / Debian com Nginx e HTTPS)


A infraestrutura foi totalmente profissionalizada para permitir instalação e operação rápida e sem dores de cabeça em qualquer servidor Ubuntu (20.04 / 22.04 / 24.04) ou Debian:

1. **Acesso Direto sem Portas na URL e com HTTPS Obrigatório**:
   - **Porta 80 (HTTP)**: Redirecionamento automático 301 para HTTPS.
   - **Porta 443 (HTTPS)**: Servidor Web Nginx como Reverse Proxy central com SSL TLSv1.2 e TLSv1.3.
   - O usuário e as TVs acessam diretamente através de `https://<IP_OU_DOMINIO>/` (sem portas `:5173` ou `:8000`).
   - O frontend React/Vite é servido estaticamente pelo Nginx a partir de `frontend/dist` com cache de alta performance para arquivos de assets (`/assets/`).
   - As chamadas da API são roteadas transparentemente pelo Nginx através de `/api/` para o FastAPI em `127.0.0.1:8000`.
   - O tráfego de uploads e mídias de chamados é roteado através de `/uploads/`.
   - A documentação interativa Swagger fica acessível em `https://<IP_OU_DOMINIO>/docs`.

2. **Certificado SSL Automático com Suporte a SAN (Subject Alternative Names)**:
   - O script `start.sh` gera automaticamente um certificado X.509 v3 autoassinado de 10 anos (3650 dias) em `/etc/ssl/tihfsa/tihfsa.crt` e `tihfsa.key`.
   - O certificado inclui SAN cobrindo `localhost`, o hostname da máquina e todos os IPs de rede do servidor, eliminando erros de incompatibilidade de certificado em navegadores modernos.
   - Caso o servidor disponha de certificados comerciais ou corporativos (ex: Let's Encrypt / Wildcard), basta copiá-los para `/etc/ssl/tihfsa/`.

3. **Banco de Dados e Migração Autônoma via `.env` (`backend/init_db.py`)**:
   - O script conecta ao servidor PostgreSQL utilizando os parâmetros fornecidos no `DATABASE_URL` do `.env`.
   - Se o banco de dados configurado (ex: `tihfsa`) ainda não existir no servidor, ele é criado automaticamente com codificação UTF-8.
   - Criação automática de todo o schema (`Base.metadata.create_all`).
   - Aplicação de todas as migrações estruturais incrementais de forma idempotente (`ADD COLUMN IF NOT EXISTS`, criação da tabela `department_managers`, campos do carrossel e topologia NOC).
   - Inserção dos 8 tipos de equipamentos padrão do Fasano.
   - Criação automática do departamento TI e do usuário Administrador Root caso o banco de dados esteja limpo, permitindo login imediato com as credenciais definidas no `.env`.

4. **Instalação em Servidor Zerado em 1 Comando (Assistente Interativo)**:
   Em uma máquina Linux (Ubuntu / Debian) recém-criada, basta baixar o `start.sh` e executá-lo:
   ```bash
   # Baixar o start.sh (ou copiar para o servidor) e executar:
   chmod +x start.sh
   ./start.sh
   ```
   O assistente detectará automaticamente que o sistema ainda não está instalado e solicitará interativamente:
   1. **Usuário do GitHub** (ex: `reisdiegoss`)
   2. **Senha ou Personal Access Token (PAT) do GitHub** (entrada oculta por segurança)
   3. **Nome da pasta de instalação** (ex: `tihfsa`, `tihfsa-salvador`, `tihfsa-bh`)
   4. **Nome da Unidade** (ex: `Hotel Fasano Salvador`, `Hotel Fasano Belo Horizonte`)

   A partir daí, o script faz **TODO o trabalho de forma autônoma**:
   - Instala `git` e `curl` se necessário
   - Clona o repositório privado do GitHub dentro da pasta informada
   - Remove tokens e senhas das URLs do git local por segurança
   - Configura o `.env` específico daquela unidade com JWT Secret aleatório e nomes da unidade
   - Instala dependências do SO (Python 3, venv, pip, Node.js 20 LTS, Nginx, OpenSSL, lsof)
   - Cria o virtualenv e instala os pacotes do Backend
   - Instala os pacotes do Frontend e compila a SPA para produção (`npm run build`)
   - Executa a inicialização do banco (`backend/init_db.py`), criando o banco no PostgreSQL se não existir e aplicando migrações
   - Gera o certificado SSL autoassinado com IP e localhost em `/etc/ssl/<nome_da_pasta>/`
   - Configura e ativa o proxy reverso Nginx em `/etc/nginx/sites-available/<nome_da_pasta>`
   - Sobe o backend FastAPI e valida os serviços
   - Exibe a URL de acesso pronta: `https://<ip_do_servidor>/` sem necessidade de portas!

5. **Guia de Comandos do Script `start.sh`**:
   ```bash
   chmod +x start.sh

   # 1. Instalação Completa / Inicialização Geral:
   ./start.sh

   # 2. Atualizar Aplicação (Git Pull + Recompilar Frontend + Reiniciar Backend):
   ./start.sh --update

   # 3. Executar o Assistente de Clone e Setup:
   ./start.sh --setup

   # 4. Inicialização Rápida (Sobe backend e recarrega Nginx):
   ./start.sh --start

   # 5. Verificar Status dos Serviços (Portas 80, 443 e Backend):
   ./start.sh --status

   # 5. Acompanhar Logs do Backend em Tempo Real:
   ./start.sh --logs

   # 6. Executar Apenas Migrações do Banco:
   ./start.sh --migrate

   # 7. Recompilar o Frontend para Produção:
   ./start.sh --build

   # 8. Reiniciar Serviços:
   ./start.sh --restart

   # 9. Encerrar Serviços:
   ./start.sh --stop
   ```

6. **Configuração de Ambiente (`.env.example`)**:
   - Um template completo e documentado foi disponibilizado na raiz como `.env.example`.
   - Em novas instalações, o script gera o `.env` automaticamente através do assistente interativo.

6. **Deploy Multi-Unidades Dinâmico (Sem Nomes ou Pastas Fixas)**:
   - O script `start.sh` detecta automaticamente o nome do diretório em que o repositório foi clonado do Git (`basename "$SCRIPT_DIR"`).
   - **Nginx Web Root**: Publicado em `/var/www/<nome_da_pasta>` com permissões automáticas `755` para o usuário `www-data`.
   - **Certificados SSL**: Gerados e armazenados isoladamente em `/etc/ssl/<nome_da_pasta>/`.
   - **Configuração Nginx**: Registrada isoladamente em `/etc/nginx/sites-available/<nome_da_pasta>` e linkada em `sites-enabled/`.
   - Permite a instalação em qualquer servidor ou unidade hoteleira sem necessidade de alterar caminhos ou scripts.

7. **Governança de Senhas (Admin Local vs. Usuários LDAP)**:
   - **Administrador Local (.env)**: Possui permissão exclusiva para alterar sua senha de emergência diretamente pela interface web (botão de chave no cabeçalho ou em *Configurações &rarr; Parâmetros Gerais &rarr; Credenciais & Segurança*).
   - **Usuários do Domínio (Active Directory / LDAP)**: Utilizam a autenticação corporativa centralizada da empresa. O sistema bloqueia a alteração local de senha para contas LDAP, garantindo que as políticas de senha e expiração do domínio Windows sejam preservadas.

8. **Resolução de DNS & Tolerância a Falhas na Evolution API (Suporte a Docker)**:
   - **Compatibilidade Obrigatória com Docker**: Como a Evolution API roda em ambiente Docker com proxy reverso (Traefik/Nginx), a URL utilizada no painel **deve ser obrigatoriamente** `https://evo2.fassa26.fasanobr.local` para manter o Server Name Indication (SNI TLS) e o cabeçalho `Host` necessários para o roteamento correto até o container.
   - **Resolvedor Corporativo no Nível de Socket (`dns_resolver.py`)**: Para evitar que contêineres ou servidores Linux falhem com `[Errno -3] Temporary failure in name resolution` devido à ausência do DNS interno ou bloqueio de domínios `.local`, o backend intercepta a chamada de rede no nível de `socket.getaddrinfo`. Ele roteia o tráfego diretamente para o IP correto preservando intactos o hostname, o SNI e o cabeçalho `Host`. Dessa forma, o usuário mantém `https://evo2.fassa26.fasanobr.local` na interface e a conexão é estabelecida com sucesso instantâneo.
   - **Automação no `start.sh`**: O script de inicialização também injeta preventivamente a entrada `192.168.168.26 evo2.fassa26.fasanobr.local` no `/etc/hosts` do servidor hospedeiro.

9. **Fila de Chamados: Filtros Avançados e Ordenação Cronológica (Data & Hora)**:
    - **Visualização Completa de Data e Hora**: A tabela de chamados exibe tanto a data (`DD/MM/AAAA`) quanto o horário preciso (`HH:mm:ss`) e tempo decorrido relativo (`há X min`, `ontem`, etc.), permitindo acompanhamento exato da abertura de incidentes e alarmes.
    - **Ordenação Clicável por Coluna**: Alternância ascendente/descendente com setas visuais nas colunas `Data & Hora`, `Chamado / ID`, `Solicitante`, `Categoria`, `Prioridade` e `Status`.
    - **Filtros Temporais Inteligentes**: Atalhos para filtrar por *Hoje (00h às 23:59)*, *Últimas 24 horas*, *Últimos 7 dias*, *Últimos 30 dias*, *Este Mês* e *Intervalo Personalizado (De/Até)*.
    - **Filtros por Origem**: Separação clara entre chamados manuais de usuários e alertas automatizados do NOC (*Zabbix NOC*, *UniFi NOC* e *Auto-Alertas de Ativos*).
    - **Contadores em Tempo Real**: As abas de status exibem a quantidade exata de chamados em cada estágio (`Todos`, `Novo`, `Em Andamento`, `Aguardando Validação`, `Fechado`).
    - **Limpeza de Filtros**: Botão de reset rápido que restaura a visualização padrão com um clique.

10. **Atualização de Status em Massa & Fechamento com Motivo Obrigatório (`closure_reason`)**:
    - **Seleção Múltipla**: Disponível exclusivamente para a equipe de TI (Admins e Técnicos), permitindo selecionar um, vários ou todos os chamados da lista filtrada com checkbox mestre.
    - **Barra de Ações Flutuante**: Exibe a contagem de itens selecionados e atalho para o modal de alteração em massa.
    - **Fechamento em Massa com Motivo Replicado**: Quando o operador escolhe o status `Fechado`, o campo de justificativa técnica torna-se estritamente **obrigatório**. O mesmo motivo inserido é replicado e gravado em massa em todos os chamados selecionados (na coluna `closure_reason` da tabela `tickets` e no histórico de auditoria individual).
    - **Fechamento Unitário com Modal de Resolução**: Ao encerrar um chamado individualmente pelo Drawer lateral (`TicketDetailDrawer`) ou pela tela de detalhes (`TicketDetail`), um modal intuitivo solicita obrigatoriamente o motivo da resolução técnica, preenchendo `closed_at`, `closure_reason` e criando registro na linha do tempo.
    - **Registro de Auditoria Individual na Timeline**: Toda alteração em lote registra uma interação no histórico (`TicketInteraction`) de cada chamado afetado, gravando:
      - Nome completo e perfil do responsável pela alteração.
      - Data e hora exatas da operação.
      - Status anterior e novo status aplicado.
      - Motivo / justificativa informada pelo técnico (com identificação `🔒 [Fechamento em Massa]`).
    - **Disparo Opcional no WhatsApp**: Opção de notificar o grupo de TI sobre o encerramento ou alteração em massa consolidada através da Evolution API, constando o motivo do fechamento e quantidade de chamados.
    - **Segurança e Controle de Permissão**: Endpoints `/api/v1/tickets/batch-status` e `PATCH /api/v1/tickets/{id}` protegidos pela dependência `require_technician` (apenas administradores e técnicos autorizados).

11. **Ciclo de Vida de Alertas NOC (UniFi e Zabbix) & Histórico Contínuo no Mesmo Dia**:
    - **Cenário 1 — Queda Inicial**: Ao detectar um equipamento offline na controladora UniFi ou disparo crítico no Zabbix, o sistema abre automaticamente um chamado (`Novo`), registra a interação inicial na linha do tempo e notifica imediatamente a equipe.
    - **Cenário 2 — Restabelecimento / Normalização**: Quando o equipamento volta a comunicar (`state == 1` ou recuperação Zabbix), o chamado avança para `Aguardando Validação` (`PENDING_VALIDATION`). Uma interação é registrada solicitando que a equipe de TI valide o pleno funcionamento e execute o encerramento formal.
    - **Cenário 3 — Nova Queda no Mesmo Dia (Reabertura Automática)**: Caso o equipamento caia novamente no mesmo dia civil (considerando o fuso horário UTC-3 de Salvador), o sistema **reabre o chamado existente daquele dia** (status `Em Andamento`), limpa datas de encerramento e anexa a nova queda à timeline do chamado. Isso evita a proliferação desordenada de múltiplos chamados fragmentados para um dispositivo instável no mesmo dia.
    - **Comunicação Sem Ruídos**: Toda transição gera alerta imediato, garantindo que o corpo de TI saiba exatamente quando o dispositivo caiu, quando retornou e quando voltou a cair.

12. **Notificações Simultâneas (Dual Dispatch: WhatsApp + E-mail Corporativo)**:
    - Todas as notificações críticas de NOC e Helpdesk são disparadas em duplicidade e de forma independente:
      1. **WhatsApp (Evolution API)**: Mensagens estruturadas no grupo corporativo de TI com emojis de gravidade, dados técnicos (IP, MAC, localização) e link direto.
      2. **E-mail Corporativo (`ti-hfsa@fasano.com.br`)**: Disparo via SMTP corporativo configurado no `.env` (`smtp-mail.outlook.com:587`) com TLS obrigatório.
    - **Templates HTML Responsivos Fasano**: Layout com cabeçalhos degradê temáticos (vermelho para queda, laranja para reabertura de chamado, verde para restabelecimento e azul para resumos operacionais), tabela de dados técnicos e botão de ação direta para o chamado.
    - **Desacoplamento e Tolerância a Falhas**: Falhas na API do WhatsApp não interferem no envio do e-mail e vice-versa.

13. **Cobrança Operacional & Resumo Periódico com Múltiplos Horários no Dia**:
    - **Painel de Configurações (`Configurações &rarr; Integrações &rarr; Cobrança & Resumo Periódico`)**:
      - **Ativação / Desativação**: Interruptor geral para a rotina de cobrança automática de chamados.
      - **Múltiplos Horários no Dia**: Permite cadastrar qualquer quantidade de horários ao longo do dia (ex: `08:00`, `11:30`, `15:00`, `18:00`). Gerenciamento visual por tags interativas com inclusão rápida via seletor de hora (`type="time"`).
      - **Seleção de Canais**: Opção de ativar ou desativar individualmente o envio no WhatsApp (Grupo TI) e por E-mail (`ti-hfsa@fasano.com.br`).
      - **Disparo Manual Sob Demanda**: Botão **`[ Disparar Resumo Agora ]`** para enviar imediatamente a cobrança atual aos técnicos para testes ou alinhamento rápido de turno.
    - **Agendador em Background (`ticket_summary_scheduler_task` no `backend/app/main.py`)**:
      - Monitora a cada 30 segundos o relógio local de Salvador (UTC-3).
      - Quando o horário coincide com a lista programada, compila todos os chamados não finalizados (`Novo`, `Em Andamento`, `Aguardando Validação`).
      - Envia o relatório de cobrança enfatizando chamados pendentes há mais tempo e cobrando validação final dos chamados restabelecidos.

14. **Atualização Automatizada do Sistema em Produção (`./start.sh --update`)**:
    - Adicionado suporte nativo ao parâmetro `--update` no assistente `start.sh`.
    - Executa em 1 comando no servidor Ubuntu:
      ```bash
      ./start.sh --update
      ```
    - O comando realiza: `git pull`, checagem de dependências Python, build de produção do frontend (`npm run build`), sincronização do Nginx e reinício gracioso do serviço systemd `tihfsa-backend.service`.

15. **Governança e Resiliência de Conexões do Banco de Dados (PostgreSQL Connection Pooling)**:
    - **Proteção Contra Sobrecarga (`FATAL: sorry, too many clients already`)**: O pool de conexões do SQLAlchemy (`backend/app/database.py`) foi estruturado de forma ultra conservadora com `pool_size=5`, `max_overflow=5`, `pool_recycle=180` (renovação forçada a cada 3 minutos) e `pool_timeout=10` com `pool_pre_ping=True`.
    - **Timeout de Sessões Ociosas no PostgreSQL (`idle_session_timeout = '15min'`)**: O servidor PostgreSQL foi parametrizado para encerrar automaticamente conexões clientes zumbis ou ociosas que fiquem sem atividade por mais de 15 minutos, impedindo que serviços integrados (como containers da Evolution API / WhatsApp) saturem o limite de 500 conexões do servidor.
    - **Uvicorn Assíncrono com 1 Worker Dedicado**: No script `start.sh`, o Uvicorn foi ajustado para `--workers 1`. O FastAPI assíncrono com `uvloop` processa milhares de requisições por segundo em 1 único worker, eliminando o risco de colisão de workers no startup e assegurando que os pollers do Zabbix, UniFi e Agendador de Resumo executem pontualmente sem duplicação de instâncias ou sobrecarga no banco de dados.

16. **Filtro Inteligente de Severidade e Blacklist para Alertas Zabbix vs. UniFi On/Off**:
    - **Diferenciação de Comportamento entre UniFi e Zabbix**:
      - **UniFi Controller (Conectividade On/Off)**: Focado estritamente na disponibilidade física e de rádio da rede (dispositivo conectado ou desconectado). Quedas geram chamados imediatos e retorno atualiza o chamado para validação e notifica a equipe.
      - **Zabbix Server (Filtro por Severidade e Palavras-Chave)**: Por monitorar centenas de itens de software, sistema operacional e banco de dados, conta com motor de filtragem configurável para evitar abertura desnecessária de chamados por alertas secundários ou transitórios.
    - **Filtro por Severidade Mínima Configurável (Painel de Configurações &rarr; Integrações)**:
      - O Administrador pode selecionar o nível mínimo de gravidade necessário para abertura de chamados:
        - `1`: Informação (Information) — Abre para todos os disparos.
        - `2`: Atenção (Warning) — Pode gerar alertas de baixo impacto.
        - `3`: Média / Normal (Average) [Padrão Recomendado] — Descarta ruídos e foca em quedas e indisponibilidades reais.
        - `4`: Alta (High) — Apenas falhas de infraestrutura graves.
        - `5`: Desastre (Disaster) — Apenas paradas críticas gerais.
      - Alertas com severidade inferior ao limite configurado são descartados silenciosamente pelo motor de sincronização, sem abertura de chamados, reaberturas ou envio de mensagens.
    - **Blacklist de Triggers (Termos Ignorados no Título do Alerta)**:
      - Gerenciador visual interativo de palavras-chave / termos proibidos na aba de Integrações.
      - Termos padrão cadastrados: `System time is out of sync`, `Failed to fetch info data`, `has just been restarted`.
      - Qualquer trigger cujo nome ou descrição contenha qualquer um dos termos cadastrados é sumariamente ignorada pelo poller.
    - **Eliminação Definitiva do Loop de Reabertura / Normalização**:
      - A checagem de problemas ativos na FASE 1 (abertura/reabertura) e FASE 2 (auto-resolução) passa a compartilhar exatamente o mesmo filtro de severidade e lista de termos ignorados. Isso impede o efeito gangorra onde um alerta secundário abria chamado a cada minuto e era auto-resolvido 60 segundos depois.
    - **Controle de Notificações e Canais**:
      - Toggles individuais para ativar/desativar abertura automática de chamados, notificação no WhatsApp (Grupo Suporte TI-HFSA) e envio por E-mail (`ti-hfsa@fasano.com.br`).
    - **Permissões de Acesso**:
      - Endpoints `GET /api/v1/zabbix/config` e `POST /api/v1/zabbix/config` restritos a usuários com perfil de Administrador (`require_admin`).

17. **Linha do Tempo em Ordem Cronológica Decrescente (Mais Recentes no Topo)**:
    - **Visibilidade Imediata das Últimas Ações**: Tanto no Drawer lateral de detalhes do chamado (`TicketDetailDrawer.jsx`) quanto na página dedicada de atendimento (`TicketDetail.jsx`), a linha do tempo de histórico e interações foi invertida para ordem cronológica decrescente.
    - **Destaque do Último Evento**: A interação mais recente (seja reabertura automática de monitoramento, comentário técnico ou mudança de status) é exibida no topo absoluto da linha do tempo, com badge visual "Mais Recente" e indicador pulsante.
    - **Marco de Abertura no Rodapé**: O evento original de abertura do chamado pelo solicitante (com a descrição inicial e anexos primários) posiciona-se no final da linha do tempo, servindo como o ponto de partida do histórico.
    - **Padronização na API REST**: A rota `GET /api/v1/tickets/{id}` ordena as interações por `TicketInteraction.created_at.desc()`, garantindo consistência completa entre backend e frontend.

18. **Eliminação de Falsos-Positivos de ICMP / Ping e Validação com Gap de Confirmação**:
    - **Supressão de Efeitos Colaterais em Rotas de Consulta**: O endpoint de ativos (`GET /api/v1/assets/`) e os mapas de rede não abrem mais chamados de suporte silenciosos. Toda governança de abertura de incidentes do Zabbix fica estritamente sob o worker oficial de background (`sync_active_zabbix_alerts`).
    - **Desassociação de Triggers de Portas / Links vs. Queda do Host**: Triggers contendo termos como `"interface"`, `"link down"`, `"port "`, `"tunnel"` referem-se a interfaces secundárias e não rotulam mais o host como "Sem resposta a conectividade ICMP (Ping)".
    - **Validação de Conectividade com Gap de Confirmação (`_verify_host_ping_with_gap`)**:
      - Quando uma trigger do Zabbix sugerir perda de pacotes ICMP, o sistema executa um teste direto de 3 pacotes com intervalo (gap).
      - Se o equipamento responder a pelo menos 1 pacote (sem perda total persistente), o alarme falso é sumariamente descartado e nenhum chamado é aberto desnecessariamente.

19. **Resiliência e Diagnóstico de Autenticação na Evolution API (WhatsApp)**:
    - **Tratamento Seguro de Erros (`POST /api/v1/integrations/evolution/groups`)**: Import explícito do módulo `httpx` e propagação transparente de erros HTTP da Evolution API, eliminando falhas 500 decorrentes de `NameError`.
    - **Identificação Clara de Token Desatualizado (HTTP 401)**: Quando uma instância é recriada na Evolution API e o token muda, a API retorna mensagem direta informando que o token/API Key está incorreto ou expirado, orientando o usuário a atualizar o campo API Key nas configurações do painel.

20. **Fit Tela Automático Instantâneo na Abertura Direta (Cold Load) e Carrossel de Fluxogramas (TV NOC)**:
    - **Enquadramento Inteligente e Imediato**: O Fit Tela automático é disparado e calibrado no milissegundo zero tanto na **abertura direta via URL** (`/noc?view=map&map_id=X`, `/noc?map_id=X`, `/admin/zabbix`) quanto na alternância contínua do **Carrossel da TV**, sem atrasos ou saltos visuais na tela.
    - **Calibração Realista Pré-Montagem de Racks (`80 + childCount * 105px`)**: Racks com múltiplos switches e métricas UniFi possuem altura estimada em tempo de execução síncrona coincidente com o DOM real (~105px por slot de equipamento ativo). Isso elimina o atraso anterior onde o cálculo inicial subestimava a altura do rack e dependia de timers longos para recalibrar.
    - **Reconhecimento Automático de Modo de Visualização**: Caso a URL contenha o parâmetro `map_id` ou `carousel=true`, o painel TV (`PublicNocPanel.jsx`) assume imediatamente o modo fluxograma (`viewMode = "map"`), evitando o fallback indesejado para o mosaico de cards.
    - **Micro-Ticks de Alta Performance (`requestAnimationFrame` e 30ms)**: O enquadramento é validado em tempo de 1 a 2 frames de vídeo, além de um `ResizeObserver` ultrarrápido (debounce de 20ms) no container do canvas para reagir imediatamente a mudanças de resolução ou modo tela cheia (F11).
    - **Cálculo Preciso com Bounding Box Real**: Considera as dimensões físicas de todos os nós (Switches, Racks com ativos empilhados, APs com métricas UniFi e Áreas/Zonas adaptativas em bolha SVG), aplicando margem de segurança de 60px para que nenhum card toque as bordas da tela nem fique encoberto por barras flutuantes.

21. **Central de Notificações Interativa e Monitoramento de Alertas NOC (Header & Chamados)**:
    - **Substituição do Ícone Estático por Central Dinâmica (`NotificationsPopover.jsx`)**:
      - O botão anterior possuía apenas um sino com ponto vermelho estático sem interação. Foi substituído por uma Central de Notificações completa com popover flutuante e contadores em tempo real.
      - **Contador Dinâmico de Não Lidas**: O sino exibe um badge numérico com a quantidade de notificações não lidas. Se houver alertas críticos (ex.: incidentes NOC UniFi / Zabbix ou chamados de prioridade Crítica), o sino e o badge contam com animação de pulso e destaque visual em âmbar/vermelho.
      - **Abas de Filtragem Rápida**:
        - *Todas*: Lista unificada dos chamados e alertas mais recentes.
        - *🚨 Alertas NOC*: Filtra estritamente eventos originados pela infraestrutura (UniFi, Zabbix e incidentes críticos).
        - *⏳ Pendentes*: Destaca chamados com status "Novo" ou "Aguardando Validação".
      - **Ações Rápidas**:
        - Botão "Marcar todas como lidas" com persistência no `localStorage` do navegador (`tihfsa_read_notifications`).
        - Botão de atualização manual (Refresh) e polling automático em background a cada 30 segundos.
      - **Navegação Direta e Abertura Automática do Drawer**:
        - Ao clicar em qualquer notificação, o sistema marca o item como lido, fecha o popover e redireciona o analista para `/admin/tickets?ticketId={id}`.
        - A tela de gerenciamento de chamados (`TicketList.jsx`) intercepta o parâmetro `ticketId` e abre instantaneamente o slide-over (`TicketDetailDrawer.jsx`) do chamado em questão, removendo o parâmetro da URL ao fechar o painel.
    - **Endpoint Dedicado no Backend (`GET /api/v1/tickets/notifications`)**:
      - Rota protegida por autenticação JWT (`get_current_user`), aplicando as regras de perfil do sistema: administradores e técnicos têm visibilidade de todos os eventos; usuários comuns recebem notificações apenas dos seus próprios chamados.
      - Retorna os contadores consolidados (`active_count`, `critical_count`, `pending_validation_count`) e os 25 itens mais recentes enriquecidos com categoria, prioridade, status, data de criação e flag indicativo de NOC.

22. **Módulo de Emissão e Gestão de QR Codes (Equipamentos & Wi-Fi de Eventos)**:
    - **Menu no Painel Administrativo**: Adicionado o menu **"QR Codes"** na barra lateral (`Sidebar.jsx`) apontando para `/admin/qrcodes`.
    - **Persistência Completa de Registros**:
      - Todos os QR Codes emitidos são salvos no banco de dados na tabela `qrcodes`, permitindo busca, edição de dados posteriores (ex.: troca de senha de Wi-Fi de eventos ou alteração de responsável pelo equipamento), reemissão e exclusão.
    - **Logo Central da Empresa com Correção de Erro Nível H (30%)**:
      - Modal dedicado (`QRCodeLogoModal.jsx`) para upload de imagem PNG com fundo transparente (`POST /api/v1/qrcodes/logo`), com persistência da logo padrão na tabela `qrcode_config`.
      - Renderização em tempo real da logo sobreposta no centro do QR Code via Canvas, com fundo branco arredondado e tolerância de erro `H` para garantir leitura instantânea e sem falhas.
    - **QR Code de Equipamentos (Ficha Nativa iOS & Android 100% Offline via vCard 3.0)**:
      - Campos suportados: Colaborador, Nome do Equipamento / Hostname / Patrimônio, Marca, Modelo, Empresa, Endereço/Localização e Mensagem personalizada com telefone de suporte.
      - **Integração Direta com iOS e Android sem Dependência de Rede / Internet**:
        - Projetado para o cenário em que o smartphone do colaborador ou cliente **não possui acesso à rede interna local** onde o servidor TIHFSA está hospedado (`192.168.168.29`).
        - O QR Code armazena o payload no padrão internacional **vCard 3.0 (RFC 2426)**.
        - **Comportamento Nativo no Smartphone**:
          - **🍎 iOS (Apple Camera)**: A câmera do iPhone detecta instantaneamente o formato e abre diretamente a **Ficha Nativa de Identificação/Contato do iOS**, exibindo nome do equipamento, código de patrimônio, empresa Fasano, responsável e notas técnicas completas.
          - **🤖 Android (Samsung Camera / Google Lens)**: A câmera abre diretamente a **Ficha Técnica Nativa do Sistema**, sem abrir o Bloco de Notas (Samsung Notes) e sem abrir balões isolados de chamada.
          - **100% Offline**: Não consome dados, não necessita de Wi-Fi, VPN nem conectividade com o backend do hotel.
      - **Compatibilidade com o Leitor Integrado do App (`/scan`)**:
        - O leitor interno do TIHFSA realiza o parse automático das tags do vCard (`FN`, `ORG`, `TITLE`, `NOTE`), renderizando na tela o `NativeAlertDialog` com botão único **"OK"**.
      - Endpoint público legado mantido para compatibilidade: `GET /api/v1/qrcodes/public/{code}`.
    - **QR Code de Wi-Fi para Eventos (Conexão Automática)**:
      - Padrão nativo industrial: `WIFI:T:WPA;S:{SSID};P:{SENHA};H:{OCULTA};;`.
      - Câmeras do iOS e Android reconhecem instantaneamente e conectam com 1 toque, sem digitação de senha.
    - **Ajuste de Resolução para Download & Impressão de Display de Mesa**:
      - Seletor de dimensões de imagem PNG em alta resolução:
        - `256 x 256 px` (Miniatura / Web)
        - `512 x 512 px` (Crachás e Etiquetas)
        - `1024 x 1024 px` (Placas de Mesa e Displays)
        - `2048 x 2048 px` (Totens e Banners em Ultra Definição)
      - Botão "Imprimir Display de Mesa" formatado para papel (A4/A5) com layout corporativo elegante para mesas de convenções e recepção, com opção de exibir ou ocultar a senha da rede na impressão.
    - **Funcionalidade de Leitura e Câmera de QR Code no Aplicativo (`/scan` & `/admin/qrcodes/scan`)**:
      - **Acesso Rápido**: Disponível via rota pública `/scan` (para qualquer celular acessar diretamente), botão `[ 📷 Escanear com Câmera ]` no Gerenciador de QR Codes (`QRCodeManager.jsx`) e card no portal de colaboradores (`ClientHome.jsx`).
      - **Controle Total da Câmera (iOS & Android)**: Utiliza `html5-qrcode` com seleção automática da lente traseira (`facingMode: environment`), mira animada com cantos dourados Fasano, alternador de câmeras e botão de lanterna/torch para ambientes com pouca luz.
      - **Fluxo de 5 Etapas Solicitado**:
        1. O app abre a câmera para escanear o QR Code.
        2. Assim que o código é detectado, o escaneamento pausa imediatamente (`html5QrCode.pause()` e trava de estado `isPausedRef`) prevenindo leituras duplicadas ou loop de modais.
        3. Um modal de alerta (`NativeAlertDialog`) nativo é exibido na tela contendo as informações completas extraídas do QR Code.
        4. O modal contém estritamente o botão único **"OK"**.
        5. Ao clicar em **"OK"**, o modal fecha e a câmera é reativada instantaneamente (`html5QrCode.resume()`) para permitir novas leituras consecutivas.

23. **Central de Monitoramento, TV Wallboard de Helpdesk & Parametrização de SLA**:
    - **Parametrização de SLA em Configurações (`/admin/settings` - Aba "Diretrizes de SLA")**:
      - Componente dedicado `SLASettingsSection.jsx` e endpoints de persistência no backend (`GET /api/v1/sla/config`, `PUT /api/v1/sla/config`, `POST /api/v1/sla/category-rules`, `DELETE /api/v1/sla/category-rules/{id}`).
      - **Cálculo de Expediente**: Alternância com 1 clique entre regime 24/7 (ininterrupto) e Horário Comercial, com parametrização customizável de horário de início, horário de término e dias úteis da semana (segunda a domingo).
      - **Matriz de Prazos ITIL por Prioridade**:
        - Prazos de Primeira Resposta e Resolução final para as 4 prioridades do sistema: Crítica, Alta, Média e Baixa.
      - **Margem de Alerta Preventivo**:
        - Percentual configurável (padrão 80% do tempo limite) para sinalizar visualmente que o chamado entrou na faixa amarela de risco iminente de estouro.
      - **Regras Exclusivas por Categoria**:
        - Capacidade de sobrepor os prazos globais para categorias específicas que demandem atendimento diferenciado (ex.: links de internet, checkout ou eventos no hotel).
      - **Motor de Avaliação e Prazos (`sla_service.py`)**:
        - Calcula o prazo exato em minutos corridos ou minutos comerciais úteis, avaliando o estado atual do chamado (`OK`, `WARNING`, `BREACHED` ou `MET`), tempo restante e percentual global de conformidade.
    - **Central Unificada de Monitoramento (`/admin/monitoring` e `MonitoringHub.jsx`)**:
      - Atualização da navegação da `Sidebar.jsx` apontando o item "Monitoramento" para o novo hub `/admin/monitoring`.
      - **Abas Integradas**:
        - *Helpdesk & SLA*: Painel tático com KPIs consolidados, fila urgente com cronômetros decrescentes de SLA, status da carga de cada técnico e setores mais demandantes.
        - *NOC & Redes*: Painel completo de Zabbix, UniFi e Topologias de Rede integrado na mesma tela.
      - **Lançadores Rápidos para TVs**:
        - Atalhos em destaque no topo para disparar a **📺 TV 1: NOC & Redes** (`/noc`) e a **📺 TV 2: Helpdesk & SLA** (`/tv/helpdesk`) em abas separadas de tela cheia.
    - **TV Wallboard de Helpdesk para Exibição Dedicada em TV (`/tv/helpdesk` e `/tv/tickets`)**:
      - Tela pública (`PublicHelpdeskTv.jsx`) projetada para televisores 4K/Full HD de centrais de atendimento, sem necessidade de autenticação por senha para exibição contínua.
      - **Dark Mode de Alto Contraste**: Fundo `#070b14` com tipografia ultra legível e badges luminosos para fácil leitura à distância.
      - **Relógio de Parede Digital**: Exibe hora precisa (segundo a segundo) e data completa formatada para o fuso local do Hotel Fasano Salvador.
      - **Cards de KPIs Gigantes**:
        - Chamados Abertos, Sem Atendente (Fila Livre para triagem), Em Atendimento, Em Validação pelo Usuário, Chamados Críticos (com pulso visual em vermelho), % Geral de Cumprimento de SLA e Contador de Chamados com SLA Estourado.
      - **Fila Prioritária com Contagem Regressiva de SLA em Tempo Real**:
        - Lista ordenada por severidade e proximidade do vencimento de SLA.
        - Exibe código `#ID`, título, solicitante, departamento, categoria, analista atribuído e badge de SLA com contagem decrescente (ou tempo de atraso caso estourado).
      - **Carga por Técnico & Ranking de Setores**:
        - Distribuição de chamados ativos por analista de suporte e barras de gargalo por setor do hotel.
      - **Sistema Avançado de Alertas Sonoros & Visuais (Web Audio API & Toasts)**:
        - **Sintetizador Harmônico Suave (Padrão de Volume NOC)**: Calibrado com `masterGain` em `0.18` (idêntico ao volume do painel NOC/Topologias), garantindo toque audível, agradável e sem estridência no ambiente de trabalho.
        - **Som 1: Novo Chamado (Acorde C5-E5-G5)**: Dispara um chime harmônico suave de 3 notas com ataque macio e decaimento exponencial suave (volume NOC).
        - **Som 2: Resposta de Solicitante / Interatividade (Ding-Dong NOC: D5-A5)**: Dispara um sino suave idêntico ao tom de atenção do NOC.
        - **Som 3: Urgência / Crítico / SLA Estourado (Sirene moderada)**: Alarme moderado com masterGain `0.20` e ondas senoidais para sinalização sem sobressaltos.
        - **Operação Concorrente Multi-Telas (NOC + Helpdesk no mesmo computador)**:
          - Ambos os painéis operam com contextos de áudio e chaves de `localStorage` totalmente segregadas (`tihfsa_tv_*` para Helpdesk vs `tihfsa_hub_*` e `tihfsa_noc_*` para o NOC), permitindo que rodem simultaneamente em monitores diferentes sem colisões.
          - **Diagnóstico em Tempo Real**: O botão de alerta no topo indica visualmente se o áudio está pronto (`🟢 Áudio Pronto`) ou se o Chrome bloqueou por falta de interação na janela (`⚠️ Liberar Áudio`).
          - **Garantia de Estado `running`**: Toda tentativa de reprodução verifica e restaura o `AudioContext` do navegador para o estado `running` antes do disparo das frequências, eliminando nós de som descartados.
        - **Notificações Visuais Flutuantes (Toasts)**: Card translúcido escuro de alto contraste no canto superior direito exibindo número do chamado, título, solicitante/autor da mensagem e horário, com auto-fechamento em 15 segundos ou fechamento manual.
        - **Persistência Inteligente (`localStorage`)**: Memoriza os últimos IDs de chamados e respostas visualizados, evitando alarmes repetitivos desnecessários, mas garantindo que chamados recentes toquem mesmo se a tela for recarregada.
        - **Botão "Testar Som"**: Disponível tanto no cabeçalho do Wallboard (`/tv/helpdesk`) quanto no Hub de Monitoramento (`/admin/monitoring`), com feedback imediato via toast sobre o disparo e orientações sobre dispositivo de áudio padrão do Windows e desativação de som do site.
        - **Desbloqueio de Autoplay do Navegador**: Banner pulsante intuitivo para autorizar a reprodução de áudio com um único clique em janelas secundárias/estendidas.
      - **Sincronização Contínua**: Polling automático a cada 15 segundos imune a throttling de abas em segundo plano com indicador visual de countdown e botão de tela cheia nativa (`requestFullscreen`).
    - **Sentinel Agent & Inventário Completo CMDB (Estilo GLPI / Zabbix)**:
      - **Visualização de Sistema Operacional no Grid de Ativos**:
        - Coluna dedicada na tabela desktop e badge nos cards de ativos exibindo o Sistema Operacional detectado pelo Sentinel Agent com ícones visuais (🪟 Windows e 🐧 Linux) e tipografia de alto contraste.
      - **Normalização de Fabricante para Ambientes Virtualizados (Hyper-V, VMware, KVM)**:
        - Detecção automática de máquinas virtuais corporativas: quando o DMI informa `Microsoft Corporation` e `Virtual Machine`, o sistema padroniza para `Microsoft Hyper-V` e `Máquina Virtual`, distinguindo claramente VMs de hardware físico.
        - Arredondamento comercial de RAM no backend: ajusta valores de memória com reserva de kernel (ex: 32.094 MB) para capacidades nominais de hardware (32 GB, 16 GB, 8 GB, 64 GB, 128 GB).
        - Filtragem de partições virtuais e efêmeras de Linux: remove `/sys/firmware/efi/efivars`, `/boot/efi`, `/dev/*`, preservando no inventário apenas partições reais de dados (`/`, `/home`, etc.).
      - **Modal de Inventário Completo estilo GLPI (`AssetInventoryModal`)**:
        - Botão de acesso rápido em cada ativo (card mobile e tabela desktop).
        - **Aba Hardware & Sistema**:
          - Resumo com Sistema Operacional, Uptime detalhado, Processador, vCPUs, Memória RAM Total e em uso.
          - Licenciamento & Seriais: Extração da Chave de Ativação do Windows (gravada na BIOS OA3 / MSDM) e da Chave de Produto do Microsoft Office (últimos 5 caracteres via OSPP `ospp.vbs /dstatus` para conferência de inventário) com botões de cópia rápida em 1 clique, além da identificação da edição exata do Office e status de ativação (`Ativado / LICENSED`).
          - Partições de Disco: Gráficos de barra de uso, espaço livre e capacidade total com identificação de SSD.
        - **Aba Programas Instalados (Inventário de Softwares)**:
          - Tabela completa de softwares instalados coletados pelo Sentinel Agent via Registro do Windows (`Uninstall`) ou pacotes principais via `dpkg-query` no Linux.
          - Campo de busca em tempo real para filtragem instantânea por nome do software ou fornecedor.
      - **Instalador One-Click & Agendamento no Windows (`/agent/install`)**:
        - Instalação permanente em 1 linha de comando no PowerShell: `irm "http://.../api/v1/monitoring/agent/install" | iex`.
        - Salva o agente em `C:\ProgramData\TIHFSA-Agent\tihfsa-agent.ps1` e registra a Tarefa Agendada no Windows com o nome `TIHFSA Sentinel Agent`, executando a cada 15 minutos em background invisível via `powershell.exe -NonInteractive -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ... -Silent`.
        - Suporte a execução como `SYSTEM` (quando executado como Administrador) ou usuário local (sem elevação de privilégios).
      - **Comportamento Silencioso para Notebooks Fora da Rede**:
        - Quando um colaborador leva o notebook para casa, viagens ou áreas sem acesso ao servidor TIHFSA, o agente realiza teste de comunicação com timeout curto de 5 segundos.
        - **Zero interferência visual**: Nenhum pop-up, alerta ou erro é exibido na tela do usuário.
        - O erro de conectividade é registrado de forma discreta no arquivo local `C:\ProgramData\TIHFSA-Agent\agent.log` e o processo encerra com código 0 (`exit 0`).
        - A sincronização é retomada automaticamente de forma transparente no próximo ciclo de 15 minutos assim que a máquina reconectar à rede do Fasano ou à VPN.
      - **Sincronização Fiel de Setores do Active Directory (Por OU)**:
        - Mapeamento estrito de setores baseado na OU de origem de cada usuário, impedindo que contas sem o atributo `department` preenchido no LDAP caiam erroneamente no departamento de TI.
        - Se o usuário possuir departamento explícito no AD diferente do nome da OU, o sistema cria e vincula ao departamento correto individualmente.
      - **Reset Seguro de Dados do AD (`/api/v1/ad/reset`)**:
        - Botão "Resetar Dados do AD" disponível tanto na tela de Configurações quanto na tela de Sincronização AD (`ADImport.jsx`).
        - Proteção de integridade referencial: preserva usuários com histórico (chamados, interações em `ticket_interactions`), desvinculando-os dos setores antigos sem disparar `ForeignKeyViolation`, enquanto remove com segurança os demais usuários e setores do AD para reimportação limpa do zero.
      - **Auto-Reconexão de Ativos & Auto-Recuperação de Colaboradores (`relink_assets_and_checkins_to_users`)**:
        - Mesmo que usuários do AD sejam resetados ou deletados, assim que forem reimportados, o CMDB restaura automaticamente o vínculo de cada ativo com seu colaborador com base no histórico de `logged_user`.
        - Durante o check-in do Sentinel Agent, se o usuário logado não existir no banco local, o sistema efetua busca sob demanda no AD via LDAP para cadastrá-lo imediatamente e vinculá-lo ao equipamento.
        - Reativação automática no CMDB (`is_active = True`) para qualquer ativo que envie telemetria via agente (resolvendo casos de ativos inativados no passado como servidores e estações).
    - **Gestão Centralizada de Categorias & Setores no Painel de Configurações**:
      - **Categorias do Helpdesk (`/api/v1/categories/`)**:
        - Criação, edição e exclusão de categorias com controle de integridade referencial (bloqueio seguro caso existam chamados associados).
        - Vinculação com grupos do Zabbix e suporte à aba unificada "Categorias & Tipos de Problema" em Configurações.
      - **Gerenciamento de Setores / Departamentos (`/api/v1/departments/`)**:
        - Listagem, cadastro, edição e exclusão de setores com feedback em tempo real.
        - Apresentação de contadores de colaboradores e chamados associados a cada setor.
      - **Seleção Dinâmica de Colaboradores no CMDB (`UserSelectCombobox`) & Correção de Permissões**:
        - Componente de autocomplete inteligente no formulário de edição/criação de ativos (`Assets.jsx`), com busca em tempo real por Nome, Login do Active Directory (`sAMAccountName`), E-mail e Setor.
        - Abas de navegação rápida entre "Todos", "Colaboradores (AD)" e "Apartamentos / UHs", permitindo localizar qualquer colaborador em milissegundos sem rolagem manual em listas extensas.
        - Card visual com avatar, departamento, login do AD e ações de "Trocar Colaborador" ou "Remover Vínculo".
        - Correção no endpoint `GET /api/v1/users/` (resolução de `NameError` que impedia o carregamento de usuários e retornava HTTP 500) e suporte ao modelo de múltiplos papéis (`roles`) nas dependências de autorização (`require_admin`, `require_technician`, `require_manager`).
      - **Mapeamento Hierárquico de OUs & Importação Seletiva de Colaboradores (`/ad/ous`)**:
        - Detecção automática de árvore e profundidade de OUs no Active Directory (`level`, `is_sub_ou`, `parent_ou_name`, `suggested_group`).
        - Permite mapear sub-OUs ou departamentos inteiros para setores personalizados antes de executar a importação.
        - Visualização prévia expansível de todos os colaboradores contidos em cada OU (`/ad/ous/users`), indicando status de importação e botão de importação individual (`/ad/import-user`).
        - Opções distintas de "Importar Apenas Setores" (criando a estrutura de departamentos sem importar contas de usuário) e "Sincronizar Setores e Colaboradores".
    - **Central Pública de Abertura de Chamados (`/chamado`, `/abrir-chamado`, `/suporte`)**:
      - **Acesso Sem Necessidade de Login Prévio**:
        - Interface otimizada para mobile e desktop, acessível através de URLs amigáveis ou leitura de QR Codes espalhados pelas áreas do hotel.
        - Não exige login com senha, facilitando a abertura imediata de chamados operacionais em recepção, governança, manutenção, restaurantes e eventos.
      - **Vínculo Obrigatório de Solicitante & Governança de Visibilidade**:
        - Todo chamado aberto pelo formulário público exige a seleção obrigatória de um colaborador ativo da base de usuários (`/api/v1/public/lookup-user`).
        - O sistema busca em tempo real por Login do Active Directory (`ad_username`), Nome Completo ou E-mail, exibindo o setor do colaborador e o **chefe do setor (`manager_name`)**.
        - **Garantia de Acesso e Acompanhamento**: O chamado é persistido com o `requester_id` do colaborador selecionado. Desta forma, tanto o colaborador através do portal corporativo (`/app`) quanto o gestor do seu setor (via `/app` ou `/admin`, com base no `managed_departments`) possuem visibilidade total e imediata para acompanhar o andamento, atualizações e histórico do chamado.
      - **Upload de Fotos & Evidências Direto no Formulário**:
        - Suporte a envio de imagens (JPG, PNG, WEBP) e documentos (PDF) de até 15MB através do endpoint público `POST /api/v1/public/tickets/{ticket_id}/attachments`.
        - Permite que o colaborador tire fotos diretamente pela câmera do celular ou anexe arquivos do computador, com miniaturas e opção de exclusão antes do envio.
      - **Auditoria Anti-Fraude, Resolução de Hostname & Vínculo de Equipamento**:
        - **Resolução Multi-Camadas de Hostname (`_resolve_client_info_and_asset`)**:
          - Em redes corporativas locais onde o servidor DNS do Active Directory não possui zonas reversas (PTR) configuradas para sub-redes DHCP/Wi-Fi (retornando `NXDOMAIN` ou `host not found`), o sistema resolve o nome da máquina consultando o **CMDB do TIHFSA alimentado pelo Sentinel Agent**.
          - Cruza o IP real (`192.168.163.x`) diretamente com `Asset.ip_address` no inventário, identificando instantaneamente a estação de trabalho (ex: `HFSA000080D`).
          - Caso o IP seja dinâmico ou novo, verifica alternativamente equipamentos nominais atribuídos ao colaborador (`Asset.assigned_user_id`) e histórico de login nas telemetrias do agente (`specs.logged_user`).
          - **Vínculo Automático do Ativo ao Chamado (`ticket.asset_id`)**: Ao detectar o computador de origem, o sistema associa o ID do equipamento diretamente ao ticket, permitindo que os técnicos de TI tenham acesso imediato a todas as especificações de hardware, software, licenças e telemetrias da máquina na tela de atendimento.
        - Captura transparente de IP (`X-Forwarded-For` / `X-Real-IP`) e User-Agent, persistidos na linha do tempo e auditoria do ticket.
      - **Notificação Automática via WhatsApp**:
        - Disparo imediato de notificação no grupo da TI via `EvolutionService`, detalhando o solicitante, setor, chefe do setor, computador detectado (com hostname e ativo), local/UH, título, descrição e dados de auditoria anti-fraude.

    - **Infraestrutura de Rede Corporativa, Certificado SSL & Acesso Sem Alertas**:
      - **Causa Raiz do Alerta "Não Seguro"**:
        - Ao acessar `https://fassa29/suporte` via navegadores corporativos (Edge, Chrome), o aviso vermelho de segurança ocorre porque certificados autoassinados não possuem uma Autoridade Certificadora Raiz (Root CA) confiada instalada no repositório de chaves do Windows.
        - Além disso, a configuração padrão anterior do Nginx forçava redirecionamento 301 de HTTP (80) para HTTPS (443), impedindo que usuários da intranet acessassem por HTTP puro sem cair na tela de bloqueio do navegador.
      - **Solução Implementada (Modo Híbrido & Root CA Corporativa)**:
        1. **Modo Híbrido HTTP + HTTPS Simultâneo (`FORCE_HTTPS=false` por padrão)**:
           - O Nginx foi reconfigurado para atender simultaneamente nas portas 80 (HTTP) e 443 (HTTPS).
           - **Acesso Imediato sem Nenhum Clique**: Os colaboradores podem acessar diretamente `http://fassa29/suporte` (ou apenas `fassa29/suporte`). A interface SPA e as chamadas de API carregam de forma instantânea e 100% livre de avisos de segurança ou telas de bloqueio.
        2. **Geração de Autoridade Certificadora Raiz Própria (`TIHFSA Root CA`)**:
           - O script `start.sh` agora gera uma Root CA corporativa oficial (`tihfsa-ca.crt` e `tihfsa-ca.key`) com validade de 10 anos (3650 dias) e flag `CA:TRUE`.
           - Emite o certificado do servidor assinado por essa CA com Subject Alternative Names (SAN) abrangentes:
             - `DNS.1 = fassa29`
             - `DNS.2 = fassa29.fasanobr.local`
             - `DNS.3 = fassa29.local`
             - `DNS.4 = localhost`
             - `DNS.5 = *.fasanobr.local`
             - `IP.1 = 192.168.168.29` (IP do servidor)
             - `IP.2 = 127.0.0.1`
           - Monta o bundle de cadeia completa (`tihfsa-bundle.crt`) servido no Nginx.
        3. **Distribuição Automatizada via GPO do Active Directory (Recomendado para 100% da Rede)**:
           - Para que todas as máquinas do hotel exibam o **Cadeado Verde Seguro** em `https://fassa29/suporte` automaticamente sem que nenhum usuário precise clicar em confiar:
             1. Baixe o certificado raiz em: `http://fassa29/cert/tihfsa-ca.crt`
             2. No Windows Server (Controlador de Domínio do Fasano), abra o **Gerenciamento de Política de Grupo** (`gpmc.msc`).
             3. Edite a diretiva do domínio (ex: *Default Domain Policy* ou crie uma GPO *TIHFSA-Root-CA*).
             4. Navegue até: `Configuração do Computador` > `Políticas` > `Configurações do Windows` > `Configurações de Segurança` > `Diretivas de Chave Pública` > `Autoridades de Certificação Raiz Confiáveis`.
             5. Clique com o botão direito > **Importar...** e selecione o arquivo `tihfsa-ca.crt`.
             6. Após a aplicação da GPO (`gpupdate /force`), todos os navegadores da empresa passarão a confiar na conexão HTTPS do `fassa29` de forma transparente.
        4. **Instalador de 1 Clique para Windows**:
           - Disponibilizado via web em `http://fassa29/cert/instalar-certificado.bat` e `http://fassa29/cert/instalar-certificado.ps1`.
           - Ao executar como Administrador, o script adiciona a CA na loja local com:
             `certutil -addstore -f "ROOT" tihfsa-ca.crt`
        5. **Comando de Regeneração de Certificado**:
           - No servidor Linux: `./start.sh --ssl` (ou `./start.sh --ca`) regenera a Root CA e os certificados SSL com reload imediato do Nginx.
        6. **Instalação Integrada ao Sentinel Agent (`/api/v1/monitoring/agent/install`)**:
           - Ao executar o instalador do agente em qualquer estação ou servidor de trabalho via PowerShell:
             `irm 'https://fassa29/api/v1/monitoring/agent/install' | iex`
             o script já efetua automaticamente o download e instalação da **Autoridade Raiz TIHFSA** na loja `Cert:\LocalMachine\Root` do Windows antes de criar a Tarefa Agendada.
        7. **Auto-Atualização e Verificação Automática Periódica nas Máquinas Instaladas**:
           - O script `tihfsa-agent.ps1` agora possui a função `Ensure-TihfsaRootCertificate` e `Update-AgentScriptSelf`:
             - A cada 15 minutos, quando a tarefa agendada executa em segundo plano com privilégios de `NT AUTHORITY\SYSTEM`, o agente valida se a autoridade raiz está presente. Se ausente, baixa e instala silenciosamente sem pedir confirmação ou exibir janelas ao usuário.
             - Atualiza a si mesmo para a versão mais recente caso haja novidades no servidor.
        8. **Script de Atualizacao em Massa na Rede (scripts/atualizar-agentes-e-certificado-rede.ps1)**:
           - Permite que a equipe de TI atualize todas as estacoes da rede de uma so vez a partir de um unico comando PowerShell.
           - **Resiliencia Multi-Protocolo**: Suporta WinRM e fallback via compartilhamento administrativo SMB (\\host\c$\ProgramData\TIHFSA-Agent\tihfsa-agent.ps1) com disparo imediato da tarefa agendada (schtasks /Run /S host).
           - **Gatilho para Maquinas Legadas**: Maquinas com a versao antiga do agente precisam receber o novo script uma primeira vez (via script de rede ou GPO de inicializacao) para que o mecanismo de sincronizacao de 15 minutos passe a operar automaticamente.

    - **Interface Administrativa - Ajuste e Responsividade da Grid de Localizacoes Fisicas (/admin -> Configuracoes)**:
      - **Truncamento Inteligente de Descricao**: As descricoes longas de locais fisicos possuem conteiner com min-w-0, max-w-[170px] e 	runcate, exibindo o texto completo atraves do atributo 	itle ao passar o mouse.
      - **Preservacao da Grade Padrao**: As colunas de *Andar / Nivel*, *Ativos Vinculados*, *Visibilidade*, *Status* e *Acoes* contam com espacamento otimizado e whitespace-nowrap, impedindo que a tabela transborde a viewport ou oculte os botoes de edicao e exclusao.

    - **Serviço de E-mail & Notificações SMTP**:
      - **Configuração**: Conecta via STARTTLS em `smtp-mail.outlook.com:587` utilizando a conta corporativa (`suportessa@fasano.com.br`).
      - **Casos de Uso**: Criação de chamados, designação de técnicos, aprovações de gestores, encerramento com pesquisa CSAT e alertas de monitoramento NOC.
      - **Utilitário de Teste**: Disponível em `scripts/test_smtp.py` (`py scripts/test_smtp.py`) para validar conectividade e disparar e-mail de teste com template corporativo HTML.

    - **Personalização de E-mail, Garantia e Pesquisa de Satisfação CSAT**:
      - **Personalização Completa de Títulos do E-mail (`/admin/settings` -> Parâmetros Gerais)**:
        - **Título do Cabeçalho (`email_header_title`)**: Título exibido em destaque branco no banner azul superior do e-mail (padrão: `TIHFSA — Hotel Fasano Salvador`).
        - **Subtítulo do Cabeçalho (`email_header_subtitle`)**: Texto secundário exibido no topo (padrão: `Central de Serviços & Suporte de TI`).
        - **Título do Corpo do E-mail (`email_body_title`)**: Título com destaque visual renderizado no topo da mensagem principal (padrão: `Notificação de Atendimento`). Totalmente personalizável pela interface administrativa.
        - **E-mail de Notificação de Suporte (`support_notification_email`)**: E-mail do grupo da equipe de TI (ex: `ti-hfsa@fasano.com.br`) configurável diretamente pelo painel administrativo, substituindo valores fixos do `.env`.
        - **Live Preview no Outlook**: Visualizador em tempo real na aba de Parâmetros Gerais mostrando instantaneamente como o layout renderizará no Microsoft Outlook.
        - **Disparo de Teste Real**: Botão para envio de e-mail de teste imediato para qualquer endereço corporativo diretamente da interface.
      - **Layout de E-mail Corporativo "Bulletproof MSO"**:
        - **Compatibilidade Absoluta com Microsoft Outlook**: Estruturado com tabelas aninhadas e condicionais MSO (`<!--[if mso]>`), eliminando quebras visuais causadas pelo motor de renderização Word do Outlook Desktop.
        - **Suporte a Dark Mode**: Meta tags `color-scheme: light dark` e atributos de cor de fundo sólidos para visualização uniforme em clientes mobile (iOS/Android) e webmail.
      - **Pesquisa de Satisfação CSAT (1 a 5 Estrelas)**:
        - **Fluxo sem Senha via Magic Token**: Ao solucionar ou fechar um chamado, o solicitante recebe um e-mail com 5 estrelas clicáveis (Péssimo a Excelente) geradas com token exclusivo (`uuid.uuid4().hex`).
        - **Página Pública Dedicada (`/avaliacao/:token`)**: Permite votar e opcionalmente deixar um comentário com elogio ou sugestão.
        - **Dashboard e Relatórios**: Indicadores consolidados disponíveis em `GET /api/v1/reports/csat` para acompanhamento do percentual de satisfação do suporte.
      - **Garantia de Atendimento & Reabertura de Chamado (X Dias)**:
        - **Prazo Configurável**: Definido em `ticket_warranty_days` (1 a 90 dias, padrão 7 dias).
        - **Mecânica de Garantia**: Dentro da janela de garantia após o fechamento, o colaborador pode reabrir o chamado clicando em *"O problema voltou? Reabrir"* informando a justificativa.
        - **Bloqueio Pós-Prazo**: Após a expiração dos X dias, a reabertura é bloqueada pelo backend com mensagem clara orientando a abertura de um novo chamado.
        - **Auditoria & Notificações**: Registra a reabertura na timeline (`TicketInteraction`), incrementa `reopen_count`, atualiza `reopened_at` e dispara alerta imediato à equipe de TI por WhatsApp e e-mail.

    - **Gestão Completa de Colaboradores & Permissões (`/admin/settings` -> Usuários)**:
      - **Restauração do Botão "Editar Usuário"**: O botão da lista de usuários agora é claramente destacado em azul como `[ ✏️ Editar Usuário ]`.
      - **Modal Unificado de Edição Cadastral & Acesso**:
        - **Dados de Cadastro e Contato**: Permite alterar Nome de Exibição, Login de Rede (AD/LDAP), E-mail Corporativo, Telefone/Ramal, Setor de Lotação e Status de Atividade (Ativo / Inativo).
        - **Papéis no Sistema**: Atribuição flexível de funções (Solicitante Comum, Técnico de Suporte TI, Gestor de Setor e Administrador Geral).
        - **Gestão de Setores Vinculados**: Permite selecionar múltiplos setores para gestores acompanharem seus chamados e equipamentos.

    - **Parametrização Granular de Módulos para Técnicos, Analistas e Gestores**:
      - **Controle por Usuário (`allowed_modules`)**:
        - Cada técnico ou analista pode ter permissões específicas liberadas de forma cirúrgica, como:
          - Apenas Atendimento de Chamados (`tickets`)
          - Gestão de Inventário e CMDB (`assets`)
          - Painel de Monitoramento NOC (`monitoring`)
          - Diagramas e Topologia de Rede (`topology`)
          - Etiquetas e QR Codes (`qrcodes`)
          - Importação de Contas AD/LDAP (`ad_import`)
          - Relatórios e Indicadores Gerenciais (`reports`)
          - Configurações do Sistema (`settings`)
        - **Atalhos Rápidos de Configuração**: Botões rápidos *"Marcar Todos"* e *"Apenas Chamados"* no modal de edição.
        - **Administradores Full**: Usuários com perfil Administrador mantêm acesso irrestrito automático a todos os módulos.
      - **Filtragem Dinâmica na Interface**: A barra lateral de navegação (`Sidebar.jsx`) e a validação de rotas adaptam os menus visíveis em tempo real de acordo com os módulos autorizados para a conta conectada.
      - **Proteção no Backend**: Middleware e dependência `require_module(module_name)` disponíveis para bloqueio de rotas não autorizadas no backend.

    - **Unificação de Localização Física & Múltiplos Setores (Vínculo N:N)**:
      - **Associação Direta no Cadastro de Locais**:
        - Tabela de relacionamento `location_departments` no banco de dados.
        - Permite selecionar múltiplos setores que operam em cada área física (ou deixar sem seleção caso seja de uso geral do hotel).
      - **Visualização na Grade Administrativa**: A tabela de localizações em `/admin/settings` agora possui a coluna *Setores Vinculados*, exibindo badges com os departamentos que atuam naquele local.
      - **Propagação Inteligente em Formulários de Chamados**:
        - Tanto no Portal Público (`PublicTicketForm.jsx`), quanto no Portal do Colaborador (`NewRequest.jsx`) e Abertura Administrativa (`NewTicket.jsx`), os locais vinculados ao setor do colaborador recebem destaque visual automático (`⭐ [Seu Setor]` ou rótulo do setor), facilitando o preenchimento sem digitação errada.

    - **Módulo de Histórico, Auditoria & Reenvio de Notificações (`/admin/settings` -> Histórico de Notificações)**:
      - **Rastreabilidade Completa (E-mail & WhatsApp)**:
        - Tabela `notification_logs` registrando todos os disparos efetuados pelo sistema com `channel`, `recipient`, `recipient_name`, `subject`, `body`, `ticket_id`, `status` (`SENT` ou `FAILED`), `error_message`, `resend_count` e timestamps.
      - **Painel de Métricas e Indicadores**:
        - Contadores em tempo real de total de disparos, mensagens entregues com sucesso, falhas na entrega, volume por e-mail e volume por WhatsApp.
      - **Filtros e Pesquisa**:
        - Filtragem dinâmica por canal (Todos, E-mail, WhatsApp) e por status (Todos, Entregues, Falhas), além de campo de busca textual por destinatário ou assunto.
      - **Reenvio com 1 Clique (`/api/v1/notifications/logs/{id}/resend`)**:
        - Botão de reenvio manual na tabela e dentro do modal de detalhes. Permite reenviar instantaneamente qualquer mensagem caso o destinatário não tenha recebido ou em caso de instabilidade transitória de rede.
      - **Visualizador Completo da Mensagem**: Modal com exibição detalhada do destinatário, data, assunto, corpo completo e mensagem técnica de erro retornada pelo servidor de SMTP caso tenha havido falha.

    - **Monitoramento de Estações (Sentinel Agent), Filtros e Relatório de Hardware**:
      - **Correção do Status Offline Indevido**:
        - Ajustado o limiar de avaliação de presença online de 180 segundos (3 min) para 1200 segundos (20 min).
        - Elimina falsos-positivos de estações marcadas como offline durante o intervalo de 15 minutos do Agendador de Tarefas do Windows (`schtasks`).
        - Atualização no KPI de contadores e cards com indicação de sinal nos últimos 20 minutos.
      - **Botão "Limpar Filtros" nas Grids (`/admin/monitoring?tab=stations` e `/admin/assets`)**:
        - Inclusão do botão de reset com ícone `RotateCcw` tanto na aba de Estações de Trabalho quanto na grade principal do CMDB/Ativos.
        - Reseta simultaneamente busca textual, status, tipos e setores/localizações com um único clique.
      - **Filtros por Tipo e por Setor no Monitoramento de Estações**:
        - Dropdown dinâmico de tipos de máquina (Servidor, Desktop, Notebook, Máquina Virtual).
        - Dropdown de setores corporativos integrado com a tabela de departamentos.
        - Identificação visual imediata do setor (`🏢 Setor`) no card de cada equipamento.
      - **Atribuição Direta de Colaborador e Tipo no Card (`AssignMachineModal`)**:
        - Endpoint `PATCH /api/v1/monitoring/agent/machines/{machine_id}/assign`.
        - Permite vincular o colaborador e atualizar o tipo do ativo diretamente pelo card da máquina sem precisar sair do monitoramento.
        - Sincronização automática com a conta do usuário no Active Directory e com o CMDB (`Asset.assigned_user_id`).
      - **Histórico do Equipamento & Laudo Técnico de Desempenho (`MachineHistoryModal`)**:
        - Endpoint `GET /api/v1/monitoring/agent/machines/{machine_id}/history`.
        - **Persistência de Telemetria Temporal**: Criação da tabela `agent_metrics_history` armazenando CPU, RAM, discos, uptime e status cronologicamente a cada check-in.
        - **Aba 1 — Manutenção & Chamados**: Tabela completa com histórico de chamados do helpdesk vinculados ao ativo ou ao hostname da máquina, exibindo prioridades, técnicos responsáveis, datas e desfechos/motivos de fechamento.
        - **Aba 2 — Consumo de Hardware**: Histórico detalhado de telemetria com médias, picos de consumo e tabela cronológica de amostras de CPU, memória RAM e armazenamento.
        - **Aba 3 — Relatório Técnico & Diagnósticos de Upgrade**: Painel oficial planejado para apresentação e aprovação de investimentos em peças:
          - Diagnósticos automatizados com alerta visual para gargalos de RAM (> 80%), espaço crítico em disco (> 85%), picos de CPU e frequência elevada de incidentes.
          - Parecer técnico estruturado com recomendações de compra (ex: módulo adicional de 16GB RAM, troca preventiva por SSD de 1TB).
          - Botão de **Imprimir / Salvar PDF** integrado ao navegador com formatação limpa e profissional para a diretoria.

    - **Telemetria Contínua (15 em 15 min), Gráficos Temporais & Detecção de Degradação**:
      - **Armazenamento Contínuo e Sem Perdas**:
        - Cada check-in de 15 minutos do agente persiste uma amostra na tabela `agent_metrics_history` com `hostname`, `cpu_usage_pct`, `ram_used_mb`, `ram_total_mb`, `ram_usage_pct`, `disk_metrics` (JSON), `disk_usage_pct`, `disk_free_gb`, `uptime_hours` e `created_at`.
        - Índices de performance em `hostname` e `created_at DESC` para garantir consultas instantâneas ao longo de meses e anos.
      - **Endpoint de Agregação Temporal (`GET /api/v1/monitoring/agent/machines/{machine_id}/metrics-chart`)**:
        - Suporte aos filtros de período: `24h` (últimas 24 horas), `7d` (última semana), `30d` (último mês), `90d` (últimos 3 meses), `1y` (último ano) e `all` (todo o histórico).
        - Agrupamento inteligente em buckets:
          - **24h**: Amostras a cada 15 minutos (até 96 pontos).
          - **7d**: Médias e picos agrupados de 1 em 1 hora (168 pontos).
          - **30d**: Médias e picos agrupados a cada 4 horas ou diários (180 pontos).
          - **90d / 1y**: Médias e picos diários e semanais.
      - **Algoritmo de Identificação de Degradação ("Quando Começou a Ficar Ruim")**:
        - O backend analisa a evolução cronológica dos dados e identifica o exato momento de virada operacional (ponto de inflexão):
          - **Degradação de RAM**: Detecta quando a máquina rompeu o patamar de 80% de forma sustentada e calcula a variação percentual (ex: *"Consumo de RAM aumentou significativamente de 42% para 88% a partir de 28/09"*).
          - **Saturação de Disco**: Detecta quando a unidade C: ultrapassou 85% de uso ou quando o espaço livre caiu para níveis de risco.
          - **Sobrecargas de Processador (CPU)**: Detecta o momento inicial em que a CPU passou a apresentar picos persistentes (> 90%).
      - **Visualização Gráfica Interativa com Recharts**:
        - Gráfico de áreas em alta resolução exibindo simultaneamente as curvas de CPU (azul), Memória RAM (roxo) e Disco C: (rosa).
        - Linhas de referência operacional destacadas em **80% (Atenção)** e **90% (Crítico)**.
        - Tooltip flutuante com dados pontuais e picos máximos.
        - Cards com métricas consolidadas (Média, Pico e Valor Atual) e tabela cronológica de todas as medições do período.

25. **Suporte Nativo a Notebooks em Bateria no Sentinel Agent e Auto-Reparo de Tarefa**:
    - **Eliminação do Bloqueio de Bateria no Windows Task Scheduler**:
      - Por padrão do Windows, tarefas agendadas criadas via `schtasks.exe /Create` configuram `<DisallowStartIfOnBatteries>true</DisallowStartIfOnBatteries>`. Isso causava a suspensão silenciosa da telemetria em notebooks corporativos desconectados da tomada (ficando com status "Offline / Na Fila").
      - O instalador e o gerador de script (`get_agent_powershell_script`) foram atualizados para utilizar os cmdlets nativos do PowerShell com flags explícitas:
        - `New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)`
      - No fallback por `schtasks.exe`, o XML da tarefa é exportado e corrigido automaticamente para permitir execução contínua em bateria.
    - **Rotina de Auto-Reparo de Energia (`Ensure-SentinelTaskBatterySettings`)**:
      - A cada ciclo de telemetria, o próprio script do agente verifica as configurações da tarefa agendada e aplica o desbloqueio de bateria e despertar automático caso estejam desativadas.
    - **Filtro de Contas de Computador do Active Directory (`HFSA...$`)**:
      - A função `Test-IsAdminOrServiceAccount` do agente e o endpoint `agent_checkin` do backend ignoram contas finalizadas com `$` (contas de máquina do AD). Isso impede que o nome da máquina (ex: `HFSA000001N$`) substitua o nome do colaborador logado no Windows.

26. **Padronização do Botão "Limpar Filtros" em Todas as Grids do Sistema**:
    - **Estações de Trabalho (`StationMonitoringTab.jsx`)**: Botão "Limpar Filtros" com ícone de reset (`RotateCcw`), redefinindo busca textual, status (Online/Alerta/Offline), tipo de máquina e departamento.
    - **Ativos CMDB (`Assets.jsx`)**: Botão dinâmico que limpa simultaneamente busca, status, categoria/tipo e localização física.
    - **Chamados Helpdesk (`TicketList.jsx`)**: Botão "Limpar todos os filtros", redefinindo período, status, prioridade, categoria, origem do chamado e ordenação.
    - **Gerenciador de QR Codes (`QRCodeManager.jsx`)**: Botão de limpeza de filtros e botão `X` rápido no campo de busca para redefinir termo e tipo selecionado (Wi-Fi/Equipamentos).
    - **Importador Active Directory (`ADImport.jsx`)**: Botão `X` e botão "Limpar" para restaurar a lista completa de OUs do LDAP.
    - **Painel TV NOC (`PublicNocPanel.jsx`)**: Botão `X` para remoção rápida de filtros de pesquisa na visualização de mosaico.

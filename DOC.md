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
      
      O equipamento *{nome}* ({modelo}) restabeleceu a comunicação com a controladora UniFi e está ONLINE.
      
      🎫 O chamado *#{ticket.id}* foi atualizado e aguarda validação.
      ```
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

10. **Atualização de Status em Massa com Rastreabilidade & Auditoria**:
    - **Seleção Múltipla**: Disponível exclusivamente para a equipe de TI (Admins e Técnicos), permitindo selecionar um, vários ou todos os chamados da lista filtrada com checkbox mestre.
    - **Barra de Ações Flutuante**: Exibe a contagem de itens selecionados e atalho para o modal de alteração em massa.
    - **Registro de Auditoria Individual na Timeline**: Toda alteração em lote registra uma interação no histórico (`TicketInteraction`) de cada chamado afetado, gravando:
      - Nome completo e perfil do responsável pela alteração.
      - Data e hora exatas da operação.
      - Status anterior e novo status aplicado.
      - Motivo / justificativa opcional informada pelo técnico.
    - **Disparo Opcional no WhatsApp**: Opção de notificar o grupo de TI sobre a alteração em massa consolidada através da Evolution API.
    - **Segurança e Controle de Permissão**: Endpoint `/api/v1/tickets/batch-status` protegido pela dependência `require_technician`.

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

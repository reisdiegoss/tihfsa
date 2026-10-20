"""
Seed Service para a Base de Conhecimento do TIHFSA.
Popula as 5 coleções e os mais de 20 artigos essenciais para treinamento de novos técnicos,
onboarding de novas unidades/hotéis e capacitação de usuários solicitantes.
"""
import re
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.knowledge_base import KnowledgeCategory, KnowledgeArticle


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[áàãâä]', 'a', text)
    text = re.sub(r'[éèêë]', 'e', text)
    text = re.sub(r'[íìîï]', 'i', text)
    text = re.sub(r'[óòõôö]', 'o', text)
    text = re.sub(r'[úùûü]', 'u', text)
    text = re.sub(r'[ç]', 'c', text)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return re.sub(r'-+', '-', text)


SEED_CATEGORIES = [
    {
        "name": "Autoatendimento & Solicitantes",
        "slug": "autoatendimento-solicitantes",
        "icon": "HelpCircle",
        "description": "Guias práticos para colaboradores do hotel: abertura de chamados, acompanhamento, validação de gestores e avaliações.",
        "min_role": "requester",
        "order_index": 1,
    },
    {
        "name": "Operações de Helpdesk & SLA",
        "slug": "operacoes-helpdesk-sla",
        "icon": "Ticket",
        "description": "Procedimentos para técnicos de suporte (N1 e N2): triagem, assumir, transferir, escalar, governança de SLA e encerramento.",
        "min_role": "technician",
        "order_index": 2,
    },
    {
        "name": "Gestão de Ativos, UHs & Termos",
        "slug": "gestao-ativos-uhs-termos",
        "icon": "Monitor",
        "description": "Inventário de apartamentos (UHs), backoffice, termos digitais com biometria facial e controle de QR Codes.",
        "min_role": "technician",
        "order_index": 3,
    },
    {
        "name": "NOC & Infraestrutura de Redes",
        "slug": "noc-infraestrutura-redes",
        "icon": "Activity",
        "description": "Painéis NOC para TV, topologia dinâmica, alertas UniFi Spanning Tree, conflitos de IP, Sentinel Agent e Veritas Backup.",
        "min_role": "technician",
        "order_index": 4,
    },
    {
        "name": "Expansão & Onboarding de Novo Hotel",
        "slug": "expansao-onboarding-novo-hotel",
        "icon": "Server",
        "description": "Manuais administrativos: implantação do TIHFSA em 1 comando, integração Active Directory, WhatsApp, Zabbix e SLAs globais.",
        "min_role": "admin",
        "order_index": 5,
    },
]


SEED_ARTICLES = [
    # ── COLEÇÃO 1: AUTOATENDIMENTO (SOLICITANTES) ──────────────────────────
    {
        "category_slug": "autoatendimento-solicitantes",
        "title": "Como Abrir Chamados de Suporte (Portal Web & PWA)",
        "slug": "como-abrir-chamados-portal-web-e-pwa",
        "summary": "Passo a passo simples para colaboradores abrirem chamados de TI através do computador ou celular.",
        "target_role": "requester",
        "support_level": "ALL",
        "tags": ["chamado", "abertura", "pwa", "suporte", "colaborador"],
        "order_index": 1,
        "content": """# Como Abrir Chamados de Suporte no TIHFSA

O **TIHFSA** é a plataforma oficial de atendimento de TI do Hotel Fasano Salvador. O sistema garante que **100% dos pedidos sejam atendidos com prazo e qualidade**, eliminando pedidos informais de balcão ou mensagens particulares.

---

## 💻 1. Onde Acessar

Você pode abrir um chamado por qualquer um dos canais oficiais:

1. **Atalho na Área de Trabalho**: Clique no ícone do **TIHFSA Suporte** na sua máquina Windows.
2. **Navegador Web**: Digite `https://fassa29/chamado` (ou o endereço configurado na intranet).
3. **No seu Celular (PWA)**: Acesse o link acima pelo navegador do smartphone e toque em *"Adicionar à tela de início"*.

---

## 📝 2. Preenchendo o Formulário de Abertura

O formulário é rápido e direto. Siga estes passos:

1. **Sua Identificação**:
   * Comece a digitar seu **Nome** ou **Login de rede (ex: `maria.silva`)**.
   * O sistema autocompletará seu cadastro, vinculando seu setor e seu gestor responsável automaticamente.
2. **Localização do Atendimento**:
   * Escolha entre **🏢 Setor / Local Físico** (ex: *Gero, Recepção, Bar da Piscina, Backoffice*) ou **🛏️ Apartamento / UH** (ex: *Apt 101, Apt 204*).
3. **Equipamento Afetado (Opcional mas recomendado)**:
   * O sistema listará os computadores, monitores e telefones atribuídos à sua estação de trabalho. Selecione qual está apresentando a falha.
4. **Categoria & Tipo de Problema**:
   * Selecione a área correspondente (ex: *Computadores & Periféricos*, *Internet / Wi-Fi*, *Sistemas Hoteleiros Opera/Micros*, *Telefonia*, etc.).
5. **Título e Descrição**:
   * Seja específico: *"Impressora não puxa folha"* é muito melhor que *"Impressora quebrada"*.
   * Se houver mensagem de erro na tela, descreva o texto ou anexe uma foto.
6. **Anexos**:
   * Você pode tirar uma foto pelo celular ou enviar um print da tela do computador.

---

## 🚀 3. O que acontece após o envio?

* Você receberá uma notificação com o **Número do Chamado (#ID)**.
* Um alerta imediato é enviado para a equipe de plantão da TI.
* Você poderá acompanhar o status em tempo real a qualquer momento.
"""
    },
    {
        "category_slug": "autoatendimento-solicitantes",
        "title": "Identificação de Local: Apartamento (UH) vs. Local Físico / Setor",
        "slug": "identificacao-de-local-uh-vs-local-fisico-setor",
        "summary": "Entenda quando selecionar uma UH (quarto) ou um local físico e como isso ajuda na agilidade do atendimento.",
        "target_role": "requester",
        "support_level": "ALL",
        "tags": ["localizacao", "uh", "apartamento", "setores", "gero", "rooftop"],
        "order_index": 2,
        "content": """# Identificação de Local: UH (Apartamento) vs. Setor Físico

Para garantir que o técnico vá ao local correto com as ferramentas e peças necessárias, o TIHFSA conta com um seletor visual inteligente de localização.

---

## 🛏️ Quando selecionar "Apartamento / UH"
* **Aplica-se a**: Manutenção dentro dos quartos de hóspedes (Governança, Manutenção Predial, Recepção ou TI).
* **Como escolher**:
  1. Clique na aba **🛏️ Apartamento / UH**.
  2. O sistema lista os quartos organizados por andares (1º, 2º e 3º Andar).
  3. Ao selecionar o quarto (ex: `UH 204`), o chamado é marcado com o prefixo `[UH 204]` e os equipamentos fixos daquele quarto (Smart TV, decodificador SKY, Antena Wi-Fi) ficam disponíveis para seleção.

---

## 🏢 Quando selecionar "Local Físico / Setor"
* **Aplica-se a**: Áreas comuns, pontos de venda (PDVs), restaurantes, eventos e áreas administrativas.
* **Exemplos de Locais Cadastrados**:
  * `Gero Restaurante`
  * `Bar da Piscina / Rooftop`
  * `Recepção / Lobby`
  * `Business Center & Salas de Reunião`
  * `Backoffice / Escritório Administrativo`
  * `CPD / Sala de Servidores`
* **Campo de Complemento**: Você pode informar pontos de referência, como por exemplo: *"Caixa 02 do Gero"* ou *"Mesa da Gerência"*.

> **💡 Dica de Ouro:** O título do chamado recebe automaticamente o prefixo do local (ex: `[GERO - CAIXA 2] Ponto de rede inoperante`), garantindo atendimento expresso pelo técnico mais próximo!
"""
    },
    {
        "category_slug": "autoatendimento-solicitantes",
        "title": "Como o Gestor Valida e Aprova a Solução do Chamado (Magic Link)",
        "slug": "como-o-gestor-valida-e-aprova-chamado-magic-link",
        "summary": "Fluxo de governança onde gestores de setor homologam os serviços concluídos pela TI sem necessidade de senhas complexas.",
        "target_role": "requester",
        "support_level": "ALL",
        "tags": ["gestor", "aprovacao", "magic-link", "validacao", "governanca"],
        "order_index": 3,
        "content": """# Governança de Validação por Gestores (Magic Link)

No Hotel Fasano Salvador, **a TI não fecha o chamado unilateralmente**. Para garantir que a operação do hotel realmente voltou à normalidade, o Gestor do setor deve homologar o encerramento do atendimento.

---

## 🔄 Como funciona o Fluxo

1. O técnico conclui o reparo na estação de trabalho ou setor.
2. O técnico altera o status para **Aguardando Validação** e insere a descrição do que foi corrigido.
3. O sistema dispara automaticamente um e-mail para o **Gestor Responsável** cadastrado na hierarquia do Active Directory.

---

## ✉️ O E-mail de Aprovação (Sem Senha)

O e-mail contém um resumo completo do serviço prestado e dois botões de ação rápida:

* 🟢 **[ VALIDAR SOLUÇÃO ]**: Ao clicar, o chamado é encerrado definitivamente como **Fechado**. O sistema registra a data, hora e confirmação do gestor.
* 🔴 **[ REJEITAR SOLUÇÃO ]**: Use caso o problema persista ou não tenha sido sanado satisfatoriamente. O chamado retorna imediatamente para **Em Andamento** na fila da TI com aviso urgente ao técnico.

> **Segurança:** O link utiliza tecnologia **JWT (Magic Link de Uso Único)**, permitindo aprovação segura direto do smartphone do gestor sem necessidade de lembrar senhas.
"""
    },
    {
        "category_slug": "autoatendimento-solicitantes",
        "title": "Pesquisa de Satisfação (CSAT) e Avaliação do Atendimento",
        "slug": "pesquisa-de-satisfacao-csat-avaliacao-do-atendimento",
        "summary": "Como avaliar a rapidez e cordialidade da equipe técnica para alimentar os indicadores de qualidade do hotel.",
        "target_role": "requester",
        "support_level": "ALL",
        "tags": ["csat", "avaliacao", "qualidade", "pesquisa", "estrelas"],
        "order_index": 4,
        "content": """# Avaliação de Atendimento (CSAT)

Assim que um chamado é validado e encerrado, o solicitante recebe um link para registrar sua percepção sobre o serviço prestado.

---

## ⭐ Critérios Avaliados

1. **Nota Geral de 1 a 5 Estrelas**:
   * ⭐ (Péssimo) | ⭐⭐ (Ruim) | ⭐⭐⭐ (Regular) | ⭐⭐⭐⭐ (Bom) | ⭐⭐⭐⭐⭐ (Excelente)
2. **Tempo de Resposta**: O técnico chegou dentro do prazo esperado?
3. **Cordialidade & Postura**: O atendimento seguiu os padrões de hospitalidade Fasano?
4. **Comentários Adicionais**: Espaço aberto para elogios nominais ou sugestões de melhoria.

> **Importância:** Todas as notas alimentam o **Dashboard Executivo de CSAT da TI**, auxiliando no reconhecimento de talentos e melhoria contínua dos processos do hotel.
"""
    },

    # ── COLEÇÃO 2: OPERAÇÕES DE HELPDESK & SLA (TÉCNICOS N1 / N2) ──────────
    {
        "category_slug": "operacoes-helpdesk-sla",
        "title": "Triagem Inicial & Assumir Chamado (Take Ownership - ITIL 4)",
        "slug": "triagem-inicial-e-assumir-chamado-itil4",
        "summary": "Procedimento operacional padrão para recepcionar chamados novos, eliminar filas órfãs e iniciar o atendimento.",
        "target_role": "technician",
        "support_level": "N1",
        "tags": ["itil", "triagem", "take-ownership", "assumir", "fila", "n1"],
        "order_index": 1,
        "content": """# Triagem Inicial & Assumir Chamado (ITIL 4 / COBIT DSS02)

Alinhado às melhores práticas de gerenciamento de incidentes, o TIHFSA não permite chamados sem custódia (chamados órfãos).

---

## 📌 1. Ação "Assumir Chamado" (Take Ownership)

Ao visualizar um chamado com status **Novo (`NEW`)** na fila geral:
1. Abra os detalhes do chamado.
2. Clique no botão de destaque **📌 Assumir Atendimento**.
3. **O que o sistema executa automaticamente:**
   * Atribui o chamado imediatamente ao seu usuário (`technician_id = current_user.id`).
   * Transiciona o status de **Novo** para **Em Andamento (`IN_PROGRESS`)**.
   * Registra o marco temporal para cálculo do **MTTA (Mean Time to Acknowledge / SLA de 1ª Resposta)**.
   * Insere um evento na linha do tempo: `📌 O técnico [Nome] assumiu o atendimento do chamado.`

---

## 🎯 2. Critérios de Priorização na Fila

Sempre atenda a fila respeitando a ordem de criticidade do SLA:
1. 🔴 **Crítica (SLA Resolução: 2h)**: Sistemas centrais inoperantes (Opera PMS, Micros, Link de Internet, Zabbix Alerta Vermelho).
2. 🟠 **Alta (SLA Resolução: 4h)**: Impressoras fiscais do Gero/Bar da Piscina, UHs com hóspedes VIP, switches de distribuição.
3. 🟡 **Média (SLA Resolução: 8h)**: Estações de trabalho administrativas, dúvidas de software, telefonia ramal interno.
4. 🔵 **Baixa (SLA Resolução: 24h)**: Criação de novos acessos, movimentação planejada de máquinas, melhorias estéticas.
"""
    },
    {
        "category_slug": "operacoes-helpdesk-sla",
        "title": "Níveis de Atendimento: Transferir vs. Escalar (N1 → N2 → N3)",
        "slug": "niveis-de-atendimento-transferir-vs-escalar-n1-n2-n3",
        "summary": "Diferença entre transferência lateral entre técnicos e escalação vertical funcional para especialistas de infraestrutura.",
        "target_role": "technician",
        "support_level": "ALL",
        "tags": ["escalacao", "transferencia", "n1", "n2", "n3", "cobit", "itil"],
        "order_index": 2,
        "content": """# Níveis de Suporte: Transferência vs. Escalação

O TIHFSA opera sob uma estrutura hierárquica em 3 níveis (Tiers), com segregação visual e responsabilidade técnica clara.

---

## 📊 Matriz de Níveis de Suporte

| Nível | Identificação Visual | Escopo Operacional | Exemplos no Fasano | Atribuição Padrão |
| :--- | :--- | :--- | :--- | :--- |
| **N1** | 🟦 **Azul** (`#0284c7`) | **Service Desk / Básico** | Senhas, periféricos, e-mail, TV quartos, dúvidas gerais | Novos chamados via portal/PWA |
| **N2** | 🟪 **Roxo** (`#7e22ce`) | **Suporte Avançado / Field** | Hardware, SO Windows, redes locais, telefonia IP, Micros, Opera PMS | Reaberturas ou triagem N1 |
| **N3** | 🟥 **Vermelho** (`#e11d48`) | **Infra & Servidores** | Servidores FASSA, Veritas Backup, Switches Cisco/UniFi, Firewall | Auto-Alertas Zabbix e NOC |

---

## 🔄 1. Transferência Lateral (Mesmo Nível)
* **Quando usar**: Passagem de turno, término de expediente ou redistribuição de carga entre analistas.
* **Ação**: Botão **🔄 Transferir**.
* **Obrigatoriedade**: Selecionar o novo técnico e inserir a justificativa (ex: *"Passagem de plantão matutino para vespertino"*).
* **Auditoria**: Registra a passagem de custódia na timeline e notifica o novo técnico.

---

## 🚀 2. Escalação Funcional (N1 → N2 ou N2 → N3)
* **Quando usar**: O chamado excedeu o conhecimento técnico do nível ou exige privilégios de infraestrutura/servidores.
* **Ação**: Botão **🚀 Escalar Chamado**.
* **Parâmetros**:
  * Escolha do nível destino (`N2` ou `N3`).
  * **Diagnóstico prévio obrigatório**: Descreva o que já foi testado para que o especialista N2/N3 não repita passos básicos desnecessariamente.
* **Desatribuição Automática**: Se você não souber qual especialista atribuir, deixe em branco; o chamado entrará na **Fila Geral de Especialistas** do nível escolhido com notificação imediata no WhatsApp da TI.
"""
    },
    {
        "category_slug": "operacoes-helpdesk-sla",
        "title": "Governança de SLA: Prazos, Horário Comercial vs. 24/7 e Alertas Sonoros",
        "slug": "governanca-de-sla-prazos-horario-comercial-e-alertas",
        "summary": "Como o motor de SLA calcula os prazos de atendimento, congelamento em horários não úteis e alertas da TV.",
        "target_role": "technician",
        "support_level": "ALL",
        "tags": ["sla", "horario-comercial", "mtta", "mttr", "tv-wallboard", "alertas"],
        "order_index": 3,
        "content": """# Parametrização e Cálculo de SLA no TIHFSA

O SLA (Service Level Agreement) no TIHFSA não é um cronômetro cego. Ele possui inteligência de expediente e tolerâncias configuradas para a realidade da hotelaria.

---

## ⏱️ 1. Horário Comercial vs. Regime 24/7

O motor de SLA (`sla_service.py`) pode operar em dois modos:
* **Modo 24/7**: Contagem contínua ininterrupta (padrão para chamados Críticos de servidores e UHs).
* **Modo Horário Comercial (`calc_business_hours = True`)**:
  * O relógio corre apenas durante o expediente útil configurado (ex: 08:00 às 18:00 de Segunda a Sexta).
  * Se um chamado for aberto às 17h50, os 10 minutos restantes correrão até as 18h00 e o restante congelará até as 08h00 do próximo dia útil.

---

## 🚦 2. Estados de SLA

Para cada chamado na fila e no TV Wallboard, o sistema exibe badges dinâmicos:
* 🟢 **OK**: Chamado dentro de 0% a 79% do tempo limite estipulado.
* 🟡 **WARNING (< 30 min ou > 80%)**: Tempo quase esgotando. O card no dashboard ganha borda âmbar e sobe na fila prioritária.
* 🔴 **BREACHED (Estourado)**: Prazo expirado. Dispara alerta sonoro no painel da TV e notificação de cobrança no grupo de suporte.

---

## 📢 3. Alertas Sonoros no Dashboard de TV (`/tv/helpdesk`)
* Utiliza a **Web Audio API** sintetizada no navegador (sem arquivos pesados de áudio).
* Alerta harmônico suave ao entrar um chamado Crítico ou quando um chamado atinge estado `BREACHED`.
* Pode ser ligado ou silenciado diretamente pelo controle ou mouse no topo da tela.
"""
    },
    {
        "category_slug": "operacoes-helpdesk-sla",
        "title": "Encerramento de Chamados: Motivo Obrigatório (Closure Reason)",
        "slug": "encerramento-de-chamados-motivo-obrigatorio-closure-reason",
        "summary": "Obrigatoriedade de documentação técnica ao encerrar chamados e prevenção de fechamentos prematuros.",
        "target_role": "technician",
        "support_level": "ALL",
        "tags": ["fechamento", "closure-reason", "auditoria", "resolucao"],
        "order_index": 4,
        "content": """# Encerramento de Chamados & Motivo Obrigatório

No TIHFSA, **nenhum chamado pode ser concluído sem a descrição clara da causa raiz e da ação tomada**.

---

## 🛡️ Por que o campo `closure_reason` é obrigatório?

1. **Memória Técnica**: Quando outro hóspede no mesmo quarto reclamar de sinal de TV dias depois, o histórico mostrará se o cabo HDMI foi trocado ou se era configuração do decodificador SKY.
2. **Não-Repúdio e Auditoria (COBIT DSS02.07)**: Garante clareza na prestação de contas aos diretores e gerentes de setor.
3. **Evitar Retrabalho**: Permite identificar falhas crônicas de peças ou fornecedores externos.

---

## ✍️ Exemplo de Bom vs. Mau Registro

* ❌ **Ruim**: *"Resolvido"*, *"Feito"*, *"Ok"*, *"Arrumado"*.
* ✅ **Excelente**: *"Substituído cabo patch cord CAT6 de 1.5m da porta 04 do switch de borda do Gero devido a conector RJ45 quebrado. Testado link e tráfego estável com 1 Gbps."*

> **Fechamento em Massa**: Mesmo ao fechar múltiplos chamados de alertas NOC restaurados em lote, o modal solicita a inclusão do motivo, que é gravado individualmente em cada chamado selecionado.
"""
    },

    # ── COLEÇÃO 3: GESTÃO DE ATIVOS, UHS & TERMOS (TÉCNICOS E GESTORES) ─────
    {
        "category_slug": "gestao-ativos-uhs-termos",
        "title": "Inventário Padrão de Apartamentos (UHs) no CMDB",
        "slug": "inventario-padrao-de-apartamentos-uh-no-cmdb",
        "summary": "Como os quartos do hotel são mapeados como entidades e seus equipamentos de áudio, vídeo e rede.",
        "target_role": "technician",
        "support_level": "N1",
        "tags": ["uh", "apartamentos", "tv", "sky", "unifi", "cmdb", "quartos"],
        "order_index": 1,
        "content": """# Gestão de Apartamentos (UHs) no CMDB

No TIHFSA, cada quarto do hotel é cadastrado na tabela de usuários com a flag `is_room = True`, permitindo histórico unificado e inventário de equipamentos.

---

## 📺 Equipamentos Padrão de um Apartamento Fasano

Cada quarto possui os seguintes ativos atrelados ao seu cadastro:
* 🖥️ **Smart TV Principal** (Marca, Modelo, Número de Série, IP e MAC).
* 📡 **Receptor SKY** (Número do Cartão de Acesso NDS e ID do Aparelho).
* 📶 **Antena UniFi Access Point (In-Wall ou Ceiling)** (MAC, IP e Porta do Switch).
* 🎛️ **Controle Remoto SKY e Controle TV**.
* ☎️ **Telefones IP de Quarto (Cabeceira e Bancada)**.
* 🔊 **Caixa de Som Bluetooth / Soundbar**.

---

## 🔍 Como Vincular um Chamado ao Ativo do Quarto
1. Ao abrir ou editar um chamado para o `Apartamento 204`, o sistema filtra dinamicamente apenas os ativos instalados na UH 204.
2. Selecione especificamente a **Smart TV**.
3. O histórico daquele televisor exibirá quantas vezes apresentou defeito, permitindo solicitar garantia ao fabricante quando necessário.
"""
    },
    {
        "category_slug": "gestao-ativos-uhs-termos",
        "title": "Termos de Responsabilidade com Biometria Facial e Assinatura Digital",
        "slug": "termos-de-responsabilidade-biometria-facial-e-assinatura",
        "summary": "Procedimento 100% digital e sem papel para cautela e entrega de notebooks e celulares a colaboradores com prova de vida.",
        "target_role": "technician",
        "support_level": "ALL",
        "tags": ["termos", "biometria", "liveness", "assinatura-digital", "cautela"],
        "order_index": 2,
        "content": """# Termos de Responsabilidade 100% Digitais

Elimine pranchetas e papéis na cautela de notebooks, tablets, coletores e smartphones corporativos. O TIHFSA possui um módulo homologado de assinatura digital com **prova de vida biométrica facial**.

---

## 📱 Passo a Passo da Emissão e Assinatura

1. **Criação do Termo (`/admin/terms`)**:
   * O técnico seleciona o colaborador no combobox dinâmico do AD.
   * Adiciona os equipamentos vinculados (com Patrimônio, Modelo e Número de Série).
   * Escolhe o modelo de termo (ex: *Cautela de Notebook*, *Uso de Celular Corporativo*, *Devolução*).
2. **Coleta de Assinatura no Tablet / iPad / Celular**:
   * Abra o link do termo ou aponte a câmera para o QR Code do documento.
3. **Prova de Vida Facial (Anti-Fraude)**:
   * A câmera frontal é ativada em enquadramento suave (sem zoom invasivo e calibrada para usuários de óculos).
   * O colaborador completa os desafios na tela (ex: Centralizar o rosto, piscar ou inclinar levemente a cabeça).
   * Uma foto de alta resolução com carimbo criptográfico é anexada ao termo.
4. **Assinatura na Tela**:
   * O colaborador assina com o dedo ou caneta stylus no canvas touchscreen.
5. **Dossiê Jurídico**:
   * O PDF com foto, IP de captura, data/hora e assinatura fica arquivado no sistema e enviado por e-mail ao colaborador e ao RH.
"""
    },
    {
        "category_slug": "gestao-ativos-uhs-termos",
        "title": "Emissão de QR Codes para Equipamentos & Wi-Fi de Eventos",
        "slug": "emissao-de-qr-codes-para-equipamentos-e-wifi-de-eventos",
        "summary": "Como gerar etiquetas de patrimônio e cartazes de Wi-Fi temporário para conferências e casamentos no hotel.",
        "target_role": "technician",
        "support_level": "ALL",
        "tags": ["qrcodes", "etiquetas", "wifi-eventos", "patrimonio", "scanner"],
        "order_index": 3,
        "content": """# Módulo de QR Codes (`/admin/qrcodes`)

O TIHFSA gera etiquetas padronizadas para identificação física e conexão rápida de visitantes.

---

## 🏷️ 1. Etiquetas de Patrimônio (Equipamentos)
* Cada ativo do CMDB possui uma URL canônica (ex: `https://fassa29/qr/ASSET-1042`).
* **Como usar**:
  1. No módulo de Ativos ou QR Codes, selecione o equipamento e clique em **Imprimir Etiqueta**.
  2. Cole a etiqueta adesiva na carcaça do computador, impressora ou switch.
  3. Ao ler a etiqueta com qualquer celular, a tela pública abre mostrando marca, modelo, data de garantia e botão para abrir chamado imediato daquela máquina.

---

## 📶 2. Wi-Fi de Eventos do Hotel
* Para eventos no salão nobre, casamentos ou reuniões corporativas:
  1. Acesse **Gerador de QR Code Wi-Fi**.
  2. Digite o SSID (Nome da rede) e a senha do dia.
  3. O sistema gera um cartaz elegante pronto para impressão com o padrão visual Fasano.
  4. O hóspede apenas aponta a câmera do celular e conecta sem digitar senhas!
"""
    },

    # ── COLEÇÃO 4: NOC & INFRAESTRUTURA DE REDES (TÉCNICOS N2 / N3 / ADMIN) ─
    {
        "category_slug": "noc-infraestrutura-redes",
        "title": "Operação da Central de Monitoramento & TV Wallboards",
        "slug": "operacao-da-central-de-monitoramento-tv-wallboards",
        "summary": "Como operar as telas públicas de NOC e SLA em televisores 4K dedicados na sala da TI.",
        "target_role": "technician",
        "support_level": "N2",
        "tags": ["noc", "tv", "wallboard", "zabbix", "unifi", "topologia"],
        "order_index": 1,
        "content": """# TV Wallboards e Central de Monitoramento

O TIHFSA foi projetado para exibição contínua em televisores e monitores de alta resolução (4K Ready), sem necessidade de login manual nos aparelhos.

---

## 📺 1. TV NOC — Topologia & Carrossel (`/noc`)
* Exibe os diagramas de rede interativos desenhados no canvas SVG.
* **Carrossel Automático**: Alterna entre mapas (ex: *Core TI → 1º Andar → 2º Andar → Rooftop*) a cada X segundos.
* **Memória de Tela**: Cada TV memoriza seu nível de zoom e enquadramento automaticamente através de LocalStorage.
* **Alerta Sonoro**: Emite tom audível suave (D5/A5) a cada 2 segundos caso um nó crítico fique offline.

---

## 📊 2. TV Helpdesk & SLA (`/tv/helpdesk`)
* Fila de chamados em tempo real com contagem regressiva de SLA.
* Painel de KPIs: Chamados Abertos Hoje, Resolvidos, MTTA Médio e Taxa de Cumprimento de SLA.
* Ranking dos setores com maior demanda no dia.
* Alerta visual piscante e sonoro em caso de chamado Crítico ou estouro de prazo.
"""
    },
    {
        "category_slug": "noc-infraestrutura-redes",
        "title": "Diagnóstico de Loops Spanning Tree (STP) e Quedas de APs UniFi",
        "slug": "diagnostico-de-loops-stp-e-quedas-de-aps-unifi",
        "summary": "Como o poller assíncrono detecta portas bloqueadas por loop de rede e dispositivos desconectados automaticamente.",
        "target_role": "technician",
        "support_level": "N3",
        "tags": ["unifi", "stp", "loop", "switch", "access-point", "proativo"],
        "order_index": 2,
        "content": """# Monitoramento Proativo UniFi (`unifi_poller_task`)

Um worker assíncrono em segundo plano roda a cada **60 segundos** inspecionando a controladora Ubiquiti UniFi do hotel.

---

## 🔄 1. Loops Spanning Tree (STP Port Blocking)
* **O que acontece**: Quando alguém liga um cabo de rede em duas tomadas de parede simultaneamente, gerando broadcast storm.
* **Ação do Sistema**:
  * Captura o evento `EVT_SW_StpPortBlocking`.
  * Abre um chamado de prioridade **Crítica** informando o Switch e a Porta bloqueada (ex: `Switch Core - Porta 14`).
  * Dispara alerta no WhatsApp da equipe para intervenção física imediata antes que a rede do hotel caia.

---

## 🔌 2. APs ou Switches Offline
* Se um Switch ou Antena Wi-Fi para de responder (`state == 0`):
  * Chamado automático aberto com o nome do equipamento e localização.
* Quando a conexão é restabelecida (`state == 1`):
  * O sistema atualiza o chamado automaticamente para **Aguardando Validação** e envia aviso de restabelecimento.
"""
    },
    {
        "category_slug": "noc-infraestrutura-redes",
        "title": "Detecção de Conflitos Simultâneos de Endereço IP",
        "slug": "deteccao-de-conflitos-simultaneos-de-endereco-ip",
        "summary": "Algoritmo anti-falso-positivo que mapeia múltiplos MACs respondendo no mesmo IP em switches físicos.",
        "target_role": "technician",
        "support_level": "N3",
        "tags": ["conflito-ip", "mac", "dhcp", "rede", "switch", "vlan"],
        "order_index": 3,
        "content": """# Conflitos de IP na Rede

Conflitos de IP causam instabilidade fantasma em pontos de venda e impressoras. O TIHFSA possui um algoritmo de detecção em tempo real.

---

## 🛡️ Prevenção de Falsos Positivos

* O algoritmo monitora a tabela de clientes ativos (`/stat/sta`).
* **Regra Rigorosa**: O alarme só dispara se dois ou mais endereços MAC diferentes estiverem conectados **simultaneamente** com o mesmo IP no mesmo instante (descartando clientes normais de DHCP que trocaram de aparelho).

---

## 📍 Diagnóstico Detalhado

O chamado aberto pela automação aponta:
* O endereço IP em conflito (ex: `192.168.10.155`).
* Os nomes dos dois dispositivos conflitantes.
* Os endereços MAC de cada máquina.
* O switch físico e o número exato da porta de rede onde cada um está plugado.
"""
    },
    {
        "category_slug": "noc-infraestrutura-redes",
        "title": "TIHFSA Sentinel Agent: Instalação & Telemetria em Windows e Linux",
        "slug": "tihfsa-sentinel-agent-instalacao-e-telemetria",
        "summary": "Como implantar os agentes leves para telemetria de CPU, RAM, atividade de disco e identificação do usuário real.",
        "target_role": "technician",
        "support_level": "N2",
        "tags": ["sentinel", "agente", "powershell", "bash", "cpu", "ram", "disco"],
        "order_index": 4,
        "content": """# TIHFSA Sentinel Agent (Windows & Linux)

Substitui ferramentas pesadas tradicionais por agentes nativos leves sem dependências externas.

---

## 🪟 1. Instalação no Windows (PowerShell)

Execute no PowerShell como Administrador em qualquer estação:
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iex (irm https://fassa29/scripts/tihfsa-agent.ps1)
```
* Cria uma Tarefa Agendada oculta que executa a cada 1 minuto.
* **Anti-Admin:** Detecta o proprietário real da sessão interativa (`explorer.exe`), descartando contas de suporte ou serviços.
* Coleta: Fabricante, Modelo, Service Tag, Processador, Memória RAM, Discos SSD/HDD e % de tempo ativo do disco.

---

## 🐧 2. Instalação no Linux (Ubuntu / Debian)

Execute no terminal:
```bash
curl -fsSL https://fassa29/scripts/tihfsa-agent-install.sh | sudo bash
```
* Script em Bash puro usando apenas `/proc/stat`, `/proc/meminfo` e `df`.
* Não requer pacotes extras ou Python na máquina monitorada.
"""
    },
    {
        "category_slug": "noc-infraestrutura-redes",
        "title": "Monitoramento de Jobs do Veritas Backup Exec 23.0",
        "slug": "monitoramento-de-jobs-do-veritas-backup-exec",
        "summary": "Integração para checagem diária dos jobs de backup de servidores e bancos de dados do hotel.",
        "target_role": "technician",
        "support_level": "N3",
        "tags": ["backup", "veritas", "servidores", "banco-de-dados", "jobs"],
        "order_index": 5,
        "content": """# Monitoramento Veritas Backup Exec 23.0

Garante que nenhuma falha em rotinas de backup passe despercebida pela equipe da manhã.

---

## 💾 Rotina de Inspeção

1. O script de integração consulta o banco/logs do Veritas Backup Exec.
2. Identifica se algum job de backup noturno de banco de dados (Opera PMS, Micros, Arquivos) falhou ou foi cancelado.
3. Abre chamado de prioridade **Alta/Crítica** para o analista N3 checar a fita/storage antes das 08h00.
"""
    },

    # ── COLEÇÃO 5: EXPANSÃO & ONBOARDING DE NOVO HOTEL (ADMINISTRADORES) ───
    {
        "category_slug": "expansao-onboarding-novo-hotel",
        "title": "Implantação do TIHFSA em Novo Servidor em 1 Comando (`start.sh`)",
        "slug": "implantacao-do-tihfsa-em-novo-servidor-1-comando",
        "summary": "Guia definitivo para instalar o sistema completo em um novo hotel ou servidor zerado usando o script inteligente.",
        "target_role": "admin",
        "support_level": "ALL",
        "tags": ["implantacao", "deploy", "novo-hotel", "start-sh", "nginx", "ssl"],
        "order_index": 1,
        "content": """# Implantação em Novo Servidor (Assistente start.sh)

O instalador do TIHFSA foi desenvolvido para subir uma nova unidade completa em menos de 5 minutos em qualquer máquina Linux limpa.

---

## 🚀 1. Executando em Servidor Zerado

Clone o repositório e execute como root:
```bash
git clone https://github.com/reisdiegoss/tihfsa.git /root/TIHFSA
cd /root/TIHFSA
chmod +x start.sh
./start.sh
```

---

## 🛠️ 2. O que o script configura automaticamente:
* Instala pacotes do sistema: Python 3.12, Node.js LTS, PostgreSQL, Nginx e Certificados.
* Cria o banco de dados PostgreSQL e executa as migrações DDL autônomas (`init_db.py`).
* Compila o frontend React/Vite com otimizações de produção (`npm run build`).
* Configura o Nginx com **Reverse Proxy na porta 80 e 443** (acesso direto sem números de porta na URL).
* Gera certificado SSL autoassinado com suporte a SAN (Subject Alternative Names) com o nome do servidor.
* Cria e ativa o serviço do systemd `tihfsa-backend.service` com auto-restart em caso de reboot.
"""
    },
    {
        "category_slug": "expansao-onboarding-novo-hotel",
        "title": "Integração & Sincronização com o Active Directory (AD / LDAP)",
        "slug": "integracao-e-sincronizacao-com-active-directory-ad-ldap",
        "summary": "Como mapear o controlador de domínio Windows Server, Base DN e importar colaboradores e gestores.",
        "target_role": "admin",
        "support_level": "ALL",
        "tags": ["ad", "ldap", "active-directory", "sincronizacao", "usuarios", "gestores"],
        "order_index": 2,
        "content": """# Sincronização com Active Directory (AD / LDAP)

O TIHFSA utiliza o Active Directory corporativo como fonte única da verdade para contas, setores e hierarquia de aprovação.

---

## ⚙️ 1. Variáveis de Configuração no `.env`

```ini
LDAP_HOST=192.168.10.10
LDAP_PORT=389
LDAP_BASE_DN=OU=Usuarios,DC=fasano,DC=local
LDAP_BIND_USER=fasano\\consulta_ti
LDAP_BIND_PASSWORD=SuaSenhaAdAqui
```

---

## 🔄 2. Mapeamento da Hierarquia de Gestores
* O script de sincronização (`ad_sync.py`) lê o atributo `manager` no AD (DistinguishedName do chefe).
* Localiza o gestor correspondente no banco e popula automaticamente o campo `User.manager_id`.
* Cria e atualiza os departamentos (`Department`) baseado na OU ou atributo `department`.
"""
    },
    {
        "category_slug": "expansao-onboarding-novo-hotel",
        "title": "Parametrização de SLAs, Horário Comercial e Regras por Categoria",
        "slug": "parametrizacao-de-slas-horario-comercial-e-regras",
        "summary": "Como customizar os tempos de resposta e resolução para as especificidades de cada nova unidade.",
        "target_role": "admin",
        "support_level": "ALL",
        "tags": ["sla-config", "expediente", "horarios", "configuracoes", "admin"],
        "order_index": 3,
        "content": """# Parametrização Global de SLA (`/admin/settings` -> SLA)

Cada hotel pode ajustar seus acordos de nível de serviço de acordo com o tamanho da equipe.

---

## ⏰ 1. Prazos Globais Recomendados
* **Crítica**: 15 min 1ª Resposta | 2 horas Resolução
* **Alta**: 1 hora 1ª Resposta | 4 horas Resolução
* **Média**: 2 horas 1ª Resposta | 8 horas Resolução
* **Baixa**: 4 horas 1ª Resposta | 24 horas Resolução

---

## 🏢 2. Configuração de Expediente
* Defina os dias úteis (Segunda a Sexta, ou Segunda a Sábado).
* Defina horário de início e término (ex: 08:00 às 18:00).
* Escolha se categorias VIP (ex: *Diretoria*, *Hóspede Suíte Presidencial*) devem ignorar o horário comercial e contar sempre em regime 24/7.
"""
    },
    {
        "category_slug": "expansao-onboarding-novo-hotel",
        "title": "Configuração de Canais: WhatsApp (Evolution API) & E-mail SMTP",
        "slug": "configuracao-de-canais-whatsapp-evolution-api-e-smtp",
        "summary": "Como conectar a instância de WhatsApp da TI e o servidor de e-mail corporativo para disparo de alertas.",
        "target_role": "admin",
        "support_level": "ALL",
        "tags": ["whatsapp", "evolution-api", "smtp", "email", "notificacoes"],
        "order_index": 4,
        "content": """# Configuração de Notificações Multicanal

O TIHFSA envia notificações em tempo real para que a equipe não precise ficar conferindo a tela a todo minuto.

---

## 📲 1. WhatsApp via Evolution API v2
* Acesse **Configurações -> WhatsApp / Evolution API**.
* Informe a URL da API (ex: `http://192.168.10.20:8080`), a chave API Token e o nome da instância.
* Informe o JID do Grupo de Operações da TI (ex: `120363028392183@g.us`).
* Clique no botão **Testar Envio** para receber a mensagem de confirmação instantânea no grupo.

---

## 📧 2. E-mail Corporativo (SMTP Dual)
* Configurado para envio via Office 365, Google Workspace ou servidor local:
```ini
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=suporte.ti@fasanosalvador.com.br
SMTP_FROM_NAME=TIHFSA - Hotel Fasano Salvador
```
* Garante o disparo dos **Magic Links de Aprovação** para os gestores e relatórios de fechamento para os solicitantes.
"""
    },
]


def seed_knowledge_base(db: Session, overwrite: bool = False):
    """
    Popula categorias e artigos da base de conhecimento se ainda não existirem.
    """
    cat_map = {}
    for cat_data in SEED_CATEGORIES:
        existing = db.query(KnowledgeCategory).filter(KnowledgeCategory.slug == cat_data["slug"]).first()
        if not existing:
            cat = KnowledgeCategory(
                name=cat_data["name"],
                slug=cat_data["slug"],
                icon=cat_data["icon"],
                description=cat_data["description"],
                min_role=cat_data["min_role"],
                order_index=cat_data["order_index"],
                is_active=True,
            )
            db.add(cat)
            db.flush()
            cat_map[cat.slug] = cat.id
        else:
            cat_map[existing.slug] = existing.id

    db.commit()

    # Inserir artigos
    created_count = 0
    updated_count = 0
    for art_data in SEED_ARTICLES:
        cat_id = cat_map.get(art_data["category_slug"])
        if not cat_id:
            continue

        existing_art = db.query(KnowledgeArticle).filter(KnowledgeArticle.slug == art_data["slug"]).first()
        if not existing_art:
            art = KnowledgeArticle(
                category_id=cat_id,
                title=art_data["title"],
                slug=art_data["slug"],
                summary=art_data["summary"],
                content=art_data["content"].strip(),
                target_role=art_data["target_role"],
                support_level=art_data["support_level"],
                tags=art_data["tags"],
                is_published=True,
                order_index=art_data["order_index"],
                views_count=1,
                helpful_count=1,
            )
            db.add(art)
            created_count += 1
        elif overwrite:
            existing_art.title = art_data["title"]
            existing_art.summary = art_data["summary"]
            existing_art.content = art_data["content"].strip()
            existing_art.target_role = art_data["target_role"]
            existing_art.support_level = art_data["support_level"]
            existing_art.tags = art_data["tags"]
            existing_art.order_index = art_data["order_index"]
            updated_count += 1

    db.commit()
    return {"created": created_count, "updated": updated_count}

Product Requirements Document (PRD)

Produto: TIHFSA - Helpdesk & IT Management

Cliente/Ambiente: Hotel Fasano Salvador

Status: Pronto para Desenvolvimento

1\. Visão do Produto

O TIHFSA é o sistema central de operações de TI do Hotel Fasano Salvador. Ele atua primariamente como uma plataforma de Helpdesk (Gestão de Chamados) e CMDB (Gestão de Ativos), mantendo também a recepção de alertas de monitoramento do Zabbix. O foco é garantir o registro de 100% dos atendimentos (ativos e reativos), rastreabilidade de equipamentos por setor/apartamento e um fluxo rígido de validação de qualidade (aprovação de gestores).

2\. O Problema e Contexto

Em um ambiente hoteleiro de luxo, a agilidade e a governança são vitais.

Atendimentos informais (corredor, WhatsApp, rádio) perdem rastreabilidade.

Não há clareza imediata de quais equipamentos (TV, Sky, Unifi) pertencem a qual apartamento ou setor.

Soluções de TI precisam ser validadas pelos gestores das áreas para garantir que a operação do hotel não seja impactada por chamados fechados prematuramente.

3\. Atores (Usuários do Sistema)

Técnico de TI (Agente): Cria, atende, atualiza e soluciona os chamados. Interage com os alertas do Zabbix.

Usuário Comum (Colaborador): Abre chamados via PWA/Atalho na máquina. Acompanha seus chamados.

Gestor de Setor: Valida (Aprova/Rejeita) a solução de um chamado de sua equipe.

Sistema/Quarto: Entidades lógicas (ex: "Apartamento 101") que possuem inventário atrelado.

4\. Requisitos Funcionais (Core Features)

Épico 1: Gestão de Chamados (Helpdesk)

Abertura Omnichannel (Técnico): O técnico pode abrir um chamado em nome de qualquer usuário/apartamento caso o contato venha por telefone, email ou WhatsApp. Ele já atribui o chamado a si mesmo, registra o andamento e a solução.

Abertura Simplificada (PWA do Usuário): Um "aplicativo" (PWA ou atalho web) na área de trabalho do Windows. O sistema deve usar autenticação transparente (SSO/Identificação do usuário logado). O formulário deve conter: Categoria > Tipo de Solicitação > Título > Descrição > Anexos.

Integração com AD (Active Directory): O sistema deve importar e sincronizar os usuários do AD. A sincronização deve mapear o email, o grupo/setor (Departamento) e a chefia imediata (Gestor).

Ciclo de Vida com Validação (Workflow): Quando o técnico finaliza o atendimento, o status muda para Aguardando Validação. O Gestor do setor do solicitante recebe uma notificação (email/sistema) com botões para "Validar Solução" (Fecha o chamado) ou "Recusar" (Volta para o técnico).

Épico 2: Gestão de Ativos (CMDB) e Identidades

Mapeamento de Entidades: O sistema trata tanto pessoas físicas quanto Apartamentos como "Usuários/Solicitantes".

Inventário de Apartamentos: O sistema deve permitir atrelar os seguintes ativos padrão a um Apartamento: TV, SKY, Telefone 1, Telefone 2, Caixa de Som, Controle SKY, Antena Unifi.

Inventário de Setor (Backoffice): O sistema deve permitir atrelar ativos padrão aos usuários/setores: Notebook, Monitor, Teclado, Mouse, Desktop, Telefone.

Cadastro de Equipamentos: Cada equipamento atrelado deve ter campos para Marca, Modelo, Patrimônio, MAC Address, Configurações IP e Descrição. Ao abrir um chamado para o "Apt 204", o técnico deve conseguir vincular o chamado diretamente à "TV" daquele quarto.

Épico 3: Monitoramento Zabbix

O sistema deve ter um painel (Dashboard) consumindo a API do Zabbix para mostrar alertas em tempo real. Um alerta crítico do Zabbix deve permitir, com um clique, a geração de um chamado atrelado ao equipamento afetado.

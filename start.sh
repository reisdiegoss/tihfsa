#!/usr/bin/env bash
# ============================================================
#  TIHFSA — Script de Deploy e Inicialização em Produção
#  Hotel Fasano Salvador — Sistema Integrado de Gestão de TI
# ============================================================
#  Recursos:
#    - Sem portas na URL: Acesso direto via HTTPS (Porta 443)
#    - Redirecionamento automático de HTTP (80) -> HTTPS (443)
#    - Configuração e Reload automático do Nginx Reverse Proxy
#    - Geração de certificado SSL X.509 v3 autoassinado com SAN
#    - Criação automática do Banco de Dados no PostgreSQL via .env
#    - Execução autônoma de migrações estruturais do schema
#    - Build estático do Frontend (React/Vite) para máxima velocidade
#    - Backend FastAPI (Uvicorn) protegido em 127.0.0.1:8000
#
#  Uso:
#    chmod +x start.sh
#    ./start.sh              # Instala dependências, prepara banco, compila e sobe tudo
#    ./start.sh --start      # Inicia backend e Nginx (rápido)
#    ./start.sh --stop       # Para o backend
#    ./start.sh --restart    # Reinicia o backend e recarrega o Nginx
#    ./start.sh --status     # Exibe status detalhado dos serviços
#    ./start.sh --migrate    # Executa apenas a criação e migração do banco de dados
#    ./start.sh --build      # Recompila o Frontend para produção
#    ./start.sh --logs       # Acompanha logs do backend em tempo real
# ============================================================

set -o errexit
set -o pipefail

# ── Cores para Terminal ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'
BOLD='\033[1m'

# ── Diretórios & Nome do Projeto (100% Dinâmico) ─────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
LOG_DIR="$SCRIPT_DIR/logs"
PID_DIR="$SCRIPT_DIR/.pids"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

# Identifica o nome da pasta em que o repositório foi baixado do Git
PROJECT_NAME="$(basename "$SCRIPT_DIR")"
PROJECT_NAME="${PROJECT_NAME//[^a-zA-Z0-9_-]/_}"
if [[ -z "$PROJECT_NAME" || "$PROJECT_NAME" == "_" ]]; then
    PROJECT_NAME="tihfsa"
fi

WEB_ROOT="/var/www/$PROJECT_NAME"
SSL_DIR="/etc/ssl/$PROJECT_NAME"
NGINX_CONF_AVAILABLE="/etc/nginx/sites-available/$PROJECT_NAME"
NGINX_CONF_ENABLED="/etc/nginx/sites-enabled/$PROJECT_NAME"

# ── Portas e Endereços ───────────────────────────────────────
INTERNAL_BACKEND_PORT=8000
INTERNAL_BACKEND_URL="http://127.0.0.1:$INTERNAL_BACKEND_PORT"

# ── Funções de Mensagem ──────────────────────────────────────
banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          TIHFSA — Hotel Fasano Salvador                      ║"
    echo "║     Sistema Integrado de Gestão de TI & NOC Central          ║"
    echo "║         Ambiente de Produção Profissional (HTTPS)            ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info()    { echo -e "${CYAN}[INFO]${NC}    $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}      $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC}    $1"; }
log_step()    { echo -e "${BOLD}${BLUE}[ETAPA $1]${NC} $2"; }

# ── Detectar IP Primário do Servidor ─────────────────────────
get_server_ip() {
    local ip=""
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    if [[ -z "$ip" ]]; then
        ip="127.0.0.1"
    fi
    echo "$ip"
}

# ── Verificar se comando existe ──────────────────────────────
has_cmd() {
    command -v "$1" &>/dev/null
}

# ── Matar processo por porta ─────────────────────────────────
kill_port() {
    local port=$1
    local pid=""
    pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
        kill -9 $pid 2>/dev/null || true
        log_info "Processo na porta $port (PID: $pid) encerrado."
    fi
}

# ── Verificar porta em uso ───────────────────────────────────
is_port_in_use() {
    lsof -ti :"$1" >/dev/null 2>&1
}

# ══════════════════════════════════════════════════════════════
#  0. ASSISTENTE INTERATIVO DE CLONE E CONFIGURAÇÃO (WIZARD)
# ══════════════════════════════════════════════════════════════
configure_initial_env() {
    local unit_name="$1"
    log_info "Configurando variáveis de ambiente para a unidade: '$unit_name'..."

    if [[ -f "$ENV_EXAMPLE" && ! -f "$ENV_FILE" ]]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
    elif [[ ! -f "$ENV_FILE" ]]; then
        touch "$ENV_FILE"
    fi

    # Gerar chave secreta JWT aleatória de 32 bytes em hex
    local jwt_secret=""
    if has_cmd openssl; then
        jwt_secret=$(openssl rand -hex 32 2>/dev/null || true)
    fi
    if [[ -z "$jwt_secret" ]]; then
        jwt_secret="tihfsa-jwt-$(date +%s)-$(head -c 16 /dev/urandom 2>/dev/null | xxd -p 2>/dev/null || echo 'sec123')"
    fi

    # Atualizar APP_NAME
    if grep -q "^APP_NAME=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s/^APP_NAME=.*/APP_NAME=\"TIHFSA - $unit_name\"/" "$ENV_FILE"
    else
        echo "APP_NAME=\"TIHFSA - $unit_name\"" >> "$ENV_FILE"
    fi

    # Atualizar JWT_SECRET_KEY
    if grep -q "^JWT_SECRET_KEY=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$jwt_secret/" "$ENV_FILE"
    else
        echo "JWT_SECRET_KEY=$jwt_secret" >> "$ENV_FILE"
    fi

    # Atualizar SMTP_FROM_NAME
    if grep -q "^SMTP_FROM_NAME=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s/^SMTP_FROM_NAME=.*/SMTP_FROM_NAME=\"TIHFSA - $unit_name\"/" "$ENV_FILE"
    else
        echo "SMTP_FROM_NAME=\"TIHFSA - $unit_name\"" >> "$ENV_FILE"
    fi

    log_success "Arquivo .env configurado com sucesso para '$unit_name'!"
}

interactive_wizard() {
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║          TIHFSA — Hotel Fasano                               ║${NC}"
    echo -e "${BOLD}${CYAN}║     Sistema Integrado de Gestão de TI & NOC Central          ║${NC}"
    echo -e "${BOLD}${CYAN}║      Instalador e Assistente de Deploy Automatizado          ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}\n"

    local is_repo=false
    if [[ -f "$SCRIPT_DIR/backend/app/main.py" && -f "$SCRIPT_DIR/frontend/package.json" ]]; then
        is_repo=true
    fi

    # Caso NÃO esteja dentro do repositório (ex: baixou só o start.sh num servidor limpo)
    if ! $is_repo; then
        echo -e "${YELLOW}Repositório ainda não detectado nesta pasta.${NC}"
        echo -e "O assistente irá baixar o projeto do GitHub e configurar todo o ambiente.\n"

        # 1. Usuário GitHub
        local gh_user=""
        read -r -p "1. Usuário do GitHub [padrão: reisdiegoss]: " gh_user
        gh_user="${gh_user:-reisdiegoss}"

        # 2. Senha / Token
        local gh_token=""
        echo -e "\n2. Senha ou Personal Access Token (PAT) do GitHub:"
        echo -e "   ${CYAN}(Dica: Para contas com 2FA ou repositórios privados, use um Token com escopo 'repo')${NC}"
        read -r -s -p "   Senha/Token (oculto): " gh_token
        echo ""

        if [[ -z "$gh_token" ]]; then
            log_error "A senha ou Token do GitHub é obrigatório para clonar o repositório."
            exit 1
        fi

        # 3. Nome da pasta de destino
        local target_folder=""
        echo -e "\n3. Nome da pasta para download e instalação:"
        read -r -p "   Pasta [ex: tihfsa, tihfsa-salvador, tihfsa-bh] (padrão: tihfsa): " target_folder
        target_folder="${target_folder:-tihfsa}"
        target_folder="${target_folder//[^a-zA-Z0-9_-]/_}"

        # 4. Nome da Unidade
        local unit_name=""
        echo -e "\n4. Nome da Unidade Hoteleira / Hotel Fasano:"
        read -r -p "   Unidade [ex: Hotel Fasano Salvador]: " unit_name
        unit_name="${unit_name:-Hotel Fasano Salvador}"

        # Assegurar pacotes essenciais instalados
        log_info "Verificando dependências básicas (git, curl)..."
        if ! has_cmd git || ! has_cmd curl; then
            log_info "Instalando git e curl no sistema..."
            sudo apt-get update -qq && sudo apt-get install -y -qq git curl
        fi

        # Verificar se a pasta já existe
        if [[ -d "$target_folder" ]]; then
            if [[ -f "$target_folder/backend/app/main.py" ]]; then
                log_warn "A pasta '$target_folder' já existe e contém o projeto TIHFSA."
                local reuse_choice=""
                read -r -p "Deseja utilizar a pasta existente? [S/n]: " reuse_choice
                reuse_choice="${reuse_choice:-S}"
                if [[ "$reuse_choice" != "S" && "$reuse_choice" != "s" ]]; then
                    log_error "Operação cancelada pelo usuário."
                    exit 1
                fi
            else
                log_error "A pasta '$target_folder' já existe e não é o projeto TIHFSA. Escolha outro nome."
                exit 1
            fi
        else
            log_info "Clonando repositório na pasta '$target_folder'..."
            
            # URL-encode em usuário e token caso contenham caracteres especiais
            local enc_user="$gh_user"
            local enc_token="$gh_token"
            if has_cmd python3; then
                enc_user=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$gh_user" 2>/dev/null || echo "$gh_user")
                enc_token=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$gh_token" 2>/dev/null || echo "$gh_token")
            fi

            local clone_url="https://${enc_user}:${enc_token}@github.com/reisdiegoss/tihfsa.git"
            if ! git clone "$clone_url" "$target_folder"; then
                log_error "Falha ao clonar o repositório do GitHub."
                log_info "Verifique se o usuário e a senha/token do GitHub estão corretos e têm acesso ao repositório."
                exit 1
            fi
            log_success "Repositório clonado com sucesso na pasta '$target_folder'!"
        fi

        # Entrar na pasta clonada
        cd "$target_folder"

        # Limpar credenciais do remote origin por segurança (nunca persistir token no git config)
        git remote set-url origin "https://github.com/reisdiegoss/tihfsa.git" 2>/dev/null || true

        # Criar e configurar o .env dentro da nova pasta
        log_info "Configurando o arquivo .env da unidade em $(pwd)..."
        if [[ -f ".env.example" && ! -f ".env" ]]; then
            cp ".env.example" ".env"
        elif [[ ! -f ".env" ]]; then
            touch ".env"
        fi

        local jwt_secret=""
        if has_cmd openssl; then
            jwt_secret=$(openssl rand -hex 32 2>/dev/null || true)
        fi
        if [[ -z "$jwt_secret" ]]; then
            jwt_secret="tihfsa-jwt-$(date +%s)-$(head -c 16 /dev/urandom 2>/dev/null | xxd -p 2>/dev/null || echo 'sec123')"
        fi

        if grep -q "^APP_NAME=" ".env" 2>/dev/null; then
            sed -i "s/^APP_NAME=.*/APP_NAME=\"TIHFSA - $unit_name\"/" ".env"
        else
            echo "APP_NAME=\"TIHFSA - $unit_name\"" >> ".env"
        fi

        if grep -q "^JWT_SECRET_KEY=" ".env" 2>/dev/null; then
            sed -i "s/^JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$jwt_secret/" ".env"
        else
            echo "JWT_SECRET_KEY=$jwt_secret" >> ".env"
        fi

        if grep -q "^SMTP_FROM_NAME=" ".env" 2>/dev/null; then
            sed -i "s/^SMTP_FROM_NAME=.*/SMTP_FROM_NAME=\"TIHFSA - $unit_name\"/" ".env"
        else
            echo "SMTP_FROM_NAME=\"TIHFSA - $unit_name\"" >> ".env"
        fi

        log_success "Arquivo .env configurado com sucesso para a unidade: '$unit_name'!"

        # Assegurar permissão de execução no start.sh da pasta clonada
        chmod +x ./start.sh

        log_info "Transferindo controle para o script de inicialização do projeto em $(pwd)..."
        echo ""
        exec ./start.sh full
    else
        # Se já está dentro da pasta clonada mas .env não existe ou chamou com flag --setup
        if [[ ! -f "$ENV_FILE" ]]; then
            echo -e "${YELLOW}Configuração inicial da Unidade:${NC}\n"
            local unit_name=""
            read -r -p "Nome da Unidade / Hotel Fasano [ex: Hotel Fasano Salvador]: " unit_name
            unit_name="${unit_name:-Hotel Fasano Salvador}"
            configure_initial_env "$unit_name"
        fi
    fi
}


# ══════════════════════════════════════════════════════════════
#  1. VERIFICAÇÃO DO ARQUIVO .ENV
# ══════════════════════════════════════════════════════════════
check_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        interactive_wizard
    else
        log_success "Arquivo de ambiente .env detectado."
    fi
}

# ══════════════════════════════════════════════════════════════
#  2. INSTALAÇÃO DE DEPENDÊNCIAS DO SISTEMA (Ubuntu / Debian)
# ══════════════════════════════════════════════════════════════
install_dependencies() {
    log_step "1/6" "Atualizando repositórios de pacotes do sistema..."
    sudo apt-get update -qq || { log_error "Falha no apt-get update"; return 1; }

    log_step "2/6" "Instalando pacotes básicos do sistema e Nginx..."
    sudo apt-get install -y -qq \
        nginx \
        openssl \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        libpq-dev \
        build-essential \
        curl \
        git \
        lsof \
        ca-certificates \
        2>&1 | tail -5
    log_success "Pacotes base instalados com sucesso."

    # Node.js 20 LTS
    log_step "3/6" "Verificando Node.js (versão 20 LTS recomendada)..."
    local node_ver=""
    if has_cmd node; then
        node_ver=$(node -v | cut -d. -f1 | tr -d 'v')
    fi

    if [[ -z "$node_ver" ]] || [[ "$node_ver" -lt 18 ]]; then
        log_info "Instalando Node.js 20 LTS via NodeSource..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
        sudo apt-get install -y -qq nodejs > /dev/null 2>&1
        log_success "Node.js $(node -v) instalado com sucesso."
    else
        log_success "Node.js $(node -v) pronto para uso."
    fi

    # Virtualenv Python
    log_step "4/6" "Configurando virtualenv Python do Backend..."
    if [[ ! -d "$VENV_DIR" ]]; then
        python3 -m venv "$VENV_DIR"
        log_info "Ambiente virtual criado em: $VENV_DIR"
    fi

    "$VENV_DIR/bin/pip" install --upgrade pip -q
    "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" -q
    log_success "Dependências Python instaladas com sucesso."

    # Frontend NPM
    log_step "5/6" "Instalando dependências do Frontend (npm install)..."
    cd "$FRONTEND_DIR"
    npm install --silent 2>&1 | tail -3
    cd "$SCRIPT_DIR"
    log_success "Dependências do Frontend instaladas com sucesso."

    log_step "6/6" "Preparando certificado SSL e configuração do Nginx..."
    setup_ssl_certificate
    configure_nginx

    echo ""
    log_success "Todas as dependências foram instaladas e configuradas com sucesso!"
    echo ""
}

# ══════════════════════════════════════════════════════════════
#  3. ASSEGURAR NGINX E CERTIFICADO SSL (HTTPS COM SAN V3)
# ══════════════════════════════════════════════════════════════
ensure_nginx_installed() {
    if ! has_cmd nginx; then
        log_info "Nginx não está instalado no sistema. Instalando Nginx e OpenSSL..."
        sudo apt-get update -qq
        sudo apt-get install -y -qq nginx openssl
        log_success "Nginx e OpenSSL instalados com sucesso."
    fi
    sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled "$SSL_DIR"
}

setup_ssl_certificate() {
    ensure_nginx_installed

    local cert_file="$SSL_DIR/${PROJECT_NAME}.crt"
    local key_file="$SSL_DIR/${PROJECT_NAME}.key"

    if [[ -f "$cert_file" && -f "$key_file" ]]; then
        log_info "Certificado SSL existente detectado em $SSL_DIR."
        return 0
    fi

    log_info "Gerando certificado SSL autoassinado de 10 anos (3650 dias) para $PROJECT_NAME..."

    local server_ip
    server_ip=$(get_server_ip)
    local hostname_val
    hostname_val=$(hostname)

    # Configuração temporária OpenSSL para incluir SAN (Subject Alternative Names)
    local openssl_cnf="/tmp/${PROJECT_NAME}_openssl.cnf"
    cat > "$openssl_cnf" <<EOF
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
x509_extensions    = v3_req
distinguished_name = dn

[dn]
C  = BR
ST = Bahia
L  = Salvador
O  = Hotel Fasano Salvador
OU = Tecnologia da Informacao
CN = $hostname_val

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment

[alt_names]
DNS.1 = localhost
DNS.2 = $hostname_val
IP.1  = 127.0.0.1
IP.2  = $server_ip
EOF

    sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$key_file" \
        -out "$cert_file" \
        -config "$openssl_cnf" > /dev/null 2>&1

    sudo chmod 600 "$key_file"
    sudo chmod 644 "$cert_file"
    rm -f "$openssl_cnf"

    log_success "Certificado SSL gerado com sucesso em $SSL_DIR (Válido para $server_ip, $hostname_val e localhost)."
}

# ══════════════════════════════════════════════════════════════
#  4. CONFIGURAÇÃO DO NGINX (HTTP -> HTTPS & REVERSE PROXY)
# ══════════════════════════════════════════════════════════════
configure_nginx() {
    ensure_nginx_installed
    log_info "Gerando configuração de produção do Nginx para [$PROJECT_NAME]..."

    sudo tee "$NGINX_CONF_AVAILABLE" > /dev/null <<EOF
# ============================================================
#  $PROJECT_NAME — Configuração Nginx (Porta 80 -> 443 + Reverse Proxy)
# ============================================================

# ── Redirecionamento HTTP (80) -> HTTPS (443) ────────────────
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    return 301 https://\$host\$request_uri;
}

# ── Servidor Principal HTTPS (443) ───────────────────────────
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;

    # Certificados SSL
    ssl_certificate $SSL_DIR/${PROJECT_NAME}.crt;
    ssl_certificate_key $SSL_DIR/${PROJECT_NAME}.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Limite de Upload para anexos e imagens (50MB)
    client_max_body_size 50M;

    # Diretório dos arquivos compilados do Frontend SPA ($WEB_ROOT)
    root $WEB_ROOT;
    index index.html;

    # SPA (Single Page Application) Routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache otimizado para arquivos estáticos compilados pelo Vite
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Proxy para a API FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:$INTERNAL_BACKEND_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Proxy para arquivos de uploads (imagens, anexos de tickets)
    location /uploads/ {
        proxy_pass http://127.0.0.1:$INTERNAL_BACKEND_PORT/uploads/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Documentação interativa Swagger/OpenAPI
    location /docs {
        proxy_pass http://127.0.0.1:$INTERNAL_BACKEND_PORT/docs;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:$INTERNAL_BACKEND_PORT/openapi.json;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Ativar o site e remover o default para evitar colisões
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf "$NGINX_CONF_AVAILABLE" "$NGINX_CONF_ENABLED"

    # Testar configuração do Nginx
    if sudo nginx -t > /dev/null 2>&1; then
        sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null || true
        log_success "Nginx configurado e testado com sucesso."
    else
        log_warn "Aviso ao testar o Nginx. Verifique a sintaxe com 'sudo nginx -t'."
    fi
}

# ══════════════════════════════════════════════════════════════
#  5. INICIALIZAÇÃO E MIGRAÇÃO DO BANCO DE DADOS
# ══════════════════════════════════════════════════════════════
run_database_migrations() {
    check_env_file
    log_step "DB" "Executando inicialização do banco e migrações (backend/init_db.py)..."

    local py_exec="$VENV_DIR/bin/python"
    if [[ ! -x "$py_exec" ]]; then
        py_exec="python3"
    fi

    cd "$SCRIPT_DIR"
    "$py_exec" "$BACKEND_DIR/init_db.py"
    log_success "Banco de dados e migrações verificados com sucesso."
}

# ══════════════════════════════════════════════════════════════
#  6. BUILD E PUBLICAÇÃO DO FRONTEND
# ══════════════════════════════════════════════════════════════
deploy_frontend() {
    log_step "DEPLOY" "Publicando Frontend compilado em $WEB_ROOT para o Nginx..."
    sudo mkdir -p "$WEB_ROOT"
    if [[ -d "$FRONTEND_DIR/dist" ]]; then
        sudo cp -r "$FRONTEND_DIR/dist/." "$WEB_ROOT/"
        sudo chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true
        sudo chmod -R 755 "$WEB_ROOT"
        log_success "Frontend publicado em $WEB_ROOT com permissões 755 para www-data."
    else
        log_warn "Diretório $FRONTEND_DIR/dist não encontrado. Executando build primeiro..."
        build_frontend
    fi
}

build_frontend() {
    log_step "BUILD" "Compilando Frontend para produção (Vite)..."
    cd "$FRONTEND_DIR"
    npm run build
    cd "$SCRIPT_DIR"
    log_success "Frontend compilado com sucesso em: $FRONTEND_DIR/dist"
    deploy_frontend
}

# ══════════════════════════════════════════════════════════════
#  7. INICIAR SERVIÇOS (PRODUÇÃO)
# ══════════════════════════════════════════════════════════════
start_services() {
    check_env_file
    mkdir -p "$LOG_DIR" "$PID_DIR"

    # Assegurar resolução de domínios corporativos internos do Fasano no /etc/hosts
    if ! grep -q "evo2.fassa26.fasanobr.local" /etc/hosts 2>/dev/null; then
        echo "192.168.168.26 evo2.fassa26.fasanobr.local" | sudo tee -a /etc/hosts >/dev/null 2>&1 || true
    fi

    # 1. Garantir que o banco de dados está pronto
    run_database_migrations

    # 2. Se a pasta dist do frontend não existir, compila; caso contrário, sincroniza com /var/www/tihfsa
    if [[ ! -d "$FRONTEND_DIR/dist" ]]; then
        build_frontend
    else
        deploy_frontend
    fi

    # 3. Encerrar instâncias anteriores do backend interno
    kill_port $INTERNAL_BACKEND_PORT
    sleep 1

    # 4. Iniciar Backend FastAPI (Uvicorn)
    log_step "APP" "Iniciando Backend FastAPI internamente na porta $INTERNAL_BACKEND_PORT..."

    local py_exec="$VENV_DIR/bin/python"
    if [[ ! -x "$py_exec" ]]; then
        py_exec="python3"
    fi

    cd "$BACKEND_DIR"
    nohup "$py_exec" -m uvicorn app.main:app \
        --host 127.0.0.1 \
        --port $INTERNAL_BACKEND_PORT \
        --workers 2 \
        > "$LOG_DIR/backend.log" 2>&1 &
    local backend_pid=$!
    echo "$backend_pid" > "$PID_DIR/backend.pid"
    cd "$SCRIPT_DIR"

    log_info "Backend iniciado (PID: $backend_pid) — Log: $LOG_DIR/backend.log"

    # 5. Validar se o backend subiu
    log_info "Aguardando Backend responder na porta interna $INTERNAL_BACKEND_PORT..."
    local retries=0
    local max_retries=20
    local backend_ok=false
    while [[ $retries -lt $max_retries ]]; do
        if curl -s --max-time 2 "$INTERNAL_BACKEND_URL/" 2>/dev/null | grep -q "online\|status"; then
            backend_ok=true
            break
        fi
        retries=$((retries + 1))
        printf "."
        sleep 1
    done
    echo ""

    if $backend_ok; then
        log_success "Backend validado e respondendo normalmente!"
    else
        log_warn "Backend ainda inicializando ou com erro. Verifique $LOG_DIR/backend.log."
        tail -10 "$LOG_DIR/backend.log" 2>/dev/null || true
    fi

    # 6. Recarregar e assegurar Nginx ativo
    log_step "WEB" "Assegurando que o Nginx está ativo e atendendo em 80 e 443..."
    setup_ssl_certificate
    configure_nginx
    sudo systemctl restart nginx 2>/dev/null || sudo service nginx restart 2>/dev/null || true

    local http_code
    http_code=$(curl -k -s -o /dev/null -w "%{http_code}" --max-time 3 "https://localhost/" 2>/dev/null || echo "000")
    if [[ "$http_code" == "200" || "$http_code" == "301" || "$http_code" == "302" ]]; then
        log_success "Nginx respondendo com sucesso (HTTP $http_code em https://localhost/)."
    else
        log_warn "Nginx respondeu com código $http_code. Últimas linhas de erro do Nginx:"
        sudo tail -n 6 /var/log/nginx/error.log 2>/dev/null || true
    fi

    # 7. Exibir informações de acesso
    local server_ip
    server_ip=$(get_server_ip)

    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           SISTEMA TIHFSA OPERACIONAL EM PRODUÇÃO!            ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  Acesso Web (HTTPS):    ${BOLD}${CYAN}https://$server_ip/${NC}"
    echo -e "${GREEN}║${NC}  Acesso Local:          ${CYAN}https://localhost/${NC}"
    echo -e "${GREEN}║${NC}  Documentação API:      ${CYAN}https://$server_ip/docs${NC}"
    echo -e "${GREEN}║${NC}  Portas Usadas:         ${BOLD}80 (HTTP redirect) e 443 (HTTPS)${NC}"
    echo -e "${GREEN}║${NC}  Backend Interno:       127.0.0.1:$INTERNAL_BACKEND_PORT (PID: $backend_pid)"
    echo -e "${GREEN}║${NC}  Logs do Sistema:       $LOG_DIR/backend.log"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_info "Comandos úteis:"
    echo "    ./start.sh --status              # Verifica status dos serviços"
    echo "    ./start.sh --restart             # Reinicia a aplicação"
    echo "    ./start.sh --logs                # Acompanha logs do backend"
    echo "    ./start.sh --stop                # Encerra o backend"
    echo ""
}

# ══════════════════════════════════════════════════════════════
#  8. PARAR SERVIÇOS
# ══════════════════════════════════════════════════════════════
stop_services() {
    log_info "Parando serviços do TIHFSA..."

    local pidfile="$PID_DIR/backend.pid"
    if [[ -f "$pidfile" ]]; then
        local pid
        pid=$(cat "$pidfile" 2>/dev/null || true)
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            log_success "Backend (PID: $pid) encerrado."
        fi
        rm -f "$pidfile"
    fi

    # Fallback por porta interna
    kill_port $INTERNAL_BACKEND_PORT
    log_success "Serviços encerrados."
}

# ══════════════════════════════════════════════════════════════
#  9. STATUS DOS SERVIÇOS
# ══════════════════════════════════════════════════════════════
check_status() {
    echo ""
    echo -e "${BOLD}Status dos Serviços TIHFSA:${NC}"
    echo "────────────────────────────────────────────────────────────"

    # Backend
    if is_port_in_use $INTERNAL_BACKEND_PORT; then
        local bpid
        bpid=$(lsof -ti :$INTERNAL_BACKEND_PORT 2>/dev/null || true)
        echo -e "  Backend FastAPI (Porta $INTERNAL_BACKEND_PORT): ${GREEN}● RODANDO${NC}  (PID: $bpid)"
    else
        echo -e "  Backend FastAPI (Porta $INTERNAL_BACKEND_PORT): ${RED}● PARADO${NC}"
    fi

    # Nginx HTTP (80)
    if is_port_in_use 80; then
        echo -e "  Nginx HTTP      (Porta 80):   ${GREEN}● ATIVO${NC} (Redireciona para 443)"
    else
        echo -e "  Nginx HTTP      (Porta 80):   ${RED}● INATIVO${NC}"
    fi

    # Nginx HTTPS (443)
    if is_port_in_use 443; then
        echo -e "  Nginx HTTPS     (Porta 443):  ${GREEN}● ATIVO${NC} (SSL Ativo)"
    else
        echo -e "  Nginx HTTPS     (Porta 443):  ${RED}● INATIVO${NC}"
    fi

    echo "────────────────────────────────────────────────────────────"
    local server_ip
    server_ip=$(get_server_ip)
    echo -e "  URL do Sistema: ${BOLD}${CYAN}https://$server_ip/${NC}"
    echo ""
}

# ══════════════════════════════════════════════════════════════
#  10. MAIN / DISPATCHER
# ══════════════════════════════════════════════════════════════
main() {
    banner

    local action="${1:-full}"

    case "$action" in
        --start|-s)
            start_services
            ;;
        --stop|-x)
            stop_services
            ;;
        --restart|-r)
            stop_services
            sleep 1
            start_services
            ;;
        --status|-t)
            check_status
            ;;
        --install|-i)
            check_env_file
            install_dependencies
            ;;
        --migrate|-m)
            run_database_migrations
            ;;
        --build|-b)
            build_frontend
            sudo systemctl reload nginx 2>/dev/null || sudo service nginx reload 2>/dev/null || true
            ;;
        --update|-u)
            log_step "UPDATE" "Atualizando repositório do Git e recompilando..."
            git pull || true
            build_frontend
            stop_services
            sleep 1
            start_services
            log_success "Aplicação atualizada, compilada e reiniciada com sucesso!"
            ;;
        --logs|-l)
            if [[ -f "$LOG_DIR/backend.log" ]]; then
                tail -f "$LOG_DIR/backend.log"
            else
                log_warn "Arquivo de log ainda não criado ($LOG_DIR/backend.log)."
            fi
            ;;
        --setup|-w)
            interactive_wizard
            install_dependencies
            start_services
            ;;
        --help|-h)
            echo "Uso: ./start.sh [opção]"
            echo ""
            echo "Opções:"
            echo "  (sem opção)     Instalação / Deploy completo da aplicação"
            echo "  --update, -u    Atualizar via Git, recompilar frontend e reiniciar serviços"
            echo "  --setup, -w     Executar o assistente interativo de clone e configuração"
            echo "  --start, -s     Iniciar backend e Nginx (rápido)"
            echo "  --stop, -x      Parar o backend"
            echo "  --restart, -r   Reiniciar o backend e recarregar Nginx"
            echo "  --status, -t    Verificar status de saúde dos serviços e portas"
            echo "  --migrate, -m   Executar criação do banco e migrações estruturais"
            echo "  --build, -b     Compilar o Frontend para produção"
            echo "  --logs, -l      Acompanhar logs do backend em tempo real"
            echo "  --install, -i   Apenas instalar dependências do sistema"
            echo "  --help, -h      Exibir esta mensagem de ajuda"
            echo ""
            ;;
        full|"")
            if [[ ! -f "$SCRIPT_DIR/backend/app/main.py" || ! -f "$ENV_FILE" ]]; then
                interactive_wizard
            fi

            check_env_file
            if [[ ! -d "$VENV_DIR" || ! -d "$FRONTEND_DIR/node_modules" ]] || ! has_cmd nginx || ! has_cmd openssl; then
                install_dependencies
            else
                ensure_nginx_installed
                setup_ssl_certificate
                configure_nginx
            fi
            start_services
            ;;
        *)
            log_error "Opção desconhecida: $action"
            log_info "Execute './start.sh --help' para consultar as opções disponíveis."
            exit 1
            ;;
    esac
}

main "$@"

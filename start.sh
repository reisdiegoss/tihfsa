#!/usr/bin/env bash
# ============================================================
#  TIHFSA — Script de Deploy e Inicialização (Ubuntu 24.04)
#  Hotel Fasano Salvador - Sistema Integrado de Gestão de TI
# ============================================================
#  Uso:
#    chmod +x start.sh
#    ./start.sh              # Instala tudo e sobe o sistema
#    ./start.sh --start      # Apenas sobe (sem instalar deps)
#    ./start.sh --stop       # Para todos os serviços
#    ./start.sh --status     # Verifica se está rodando
# ============================================================

# ── Cores ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ── Diretórios ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
LOG_DIR="$SCRIPT_DIR/logs"
PID_DIR="$SCRIPT_DIR/.pids"

# ── Portas ───────────────────────────────────────────────────
BACKEND_PORT=8000
FRONTEND_PORT=5173
BACKEND_URL="http://localhost:$BACKEND_PORT"
FRONTEND_URL="http://localhost:$FRONTEND_PORT"

# ── Funções utilitárias ──────────────────────────────────────
banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════╗"
    echo "║      TIHFSA — Hotel Fasano Salvador          ║"
    echo "║      Sistema Integrado de Gestão de TI       ║"
    echo "╚══════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info()    { echo -e "${CYAN}[INFO]${NC}    $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}      $1"; }
log_warn()    { echo -e "${YELLOW}[AVISO]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERRO]${NC}    $1"; }
log_step()    { echo -e "${BOLD}${YELLOW}[$1]${NC} $2"; }

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
#  INSTALAÇÃO DE DEPENDÊNCIAS (Ubuntu 24.04)
# ══════════════════════════════════════════════════════════════
install_dependencies() {
    log_step "1/5" "Atualizando pacotes do sistema..."
    sudo apt-get update -qq || { log_error "Falha no apt-get update"; return 1; }

    log_step "2/5" "Instalando dependências do sistema..."
    sudo apt-get install -y -qq \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        libpq-dev \
        build-essential \
        curl \
        git \
        lsof \
        2>&1 | tail -5
    log_success "Pacotes do sistema instalados."

    # Node.js 20 LTS (via NodeSource)
    log_step "3/5" "Verificando Node.js..."
    local node_version=""
    if command -v node &>/dev/null; then
        node_version=$(node -v | cut -d. -f1 | tr -d 'v')
    fi

    if [[ -z "$node_version" ]] || [[ "$node_version" -lt 20 ]]; then
        log_info "Instalando Node.js 20 LTS..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
        sudo apt-get install -y -qq nodejs > /dev/null 2>&1
        log_success "Node.js $(node -v) instalado."
    else
        log_success "Node.js $(node -v) já instalado."
    fi

    # Backend: Virtualenv + dependências Python
    log_step "4/5" "Configurando virtualenv Python do Backend..."
    if [[ ! -d "$VENV_DIR" ]]; then
        python3 -m venv "$VENV_DIR"
        log_info "Virtualenv criado em $VENV_DIR"
    fi
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip -q
    pip install -r "$BACKEND_DIR/requirements.txt" -q
    deactivate
    log_success "Dependências Python instaladas."

    # Frontend: npm install
    log_step "5/5" "Instalando dependências do Frontend (npm)..."
    cd "$FRONTEND_DIR"
    npm install 2>&1 | tail -3
    cd "$SCRIPT_DIR"
    log_success "Dependências do Frontend instaladas."

    echo ""
    log_success "Todas as dependências foram instaladas com sucesso!"
    echo ""
}

# ══════════════════════════════════════════════════════════════
#  INICIAR SERVIÇOS
# ══════════════════════════════════════════════════════════════
start_services() {
    mkdir -p "$LOG_DIR" "$PID_DIR"

    # ── Limpar processos anteriores ──────────────────────────
    log_info "Verificando processos anteriores nas portas $BACKEND_PORT e $FRONTEND_PORT..."
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    sleep 1

    # ── Backend (FastAPI + Uvicorn) ──────────────────────────
    log_step "1/2" "Iniciando Backend (FastAPI) na porta $BACKEND_PORT..."

    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"

    cd "$BACKEND_DIR"
    nohup python3 -m uvicorn app.main:app \
        --host 0.0.0.0 \
        --port $BACKEND_PORT \
        --reload \
        > "$LOG_DIR/backend.log" 2>&1 &
    local backend_pid=$!
    echo "$backend_pid" > "$PID_DIR/backend.pid"
    cd "$SCRIPT_DIR"
    deactivate

    log_info "Backend PID: $backend_pid — Log: $LOG_DIR/backend.log"

    # Validar Backend
    log_info "Aguardando Backend responder (máx 30s)..."
    local retries=0
    local max_retries=30
    local backend_ok=false
    while [[ $retries -lt $max_retries ]]; do
        if curl -s --max-time 2 "$BACKEND_URL/" 2>/dev/null | grep -q "online\|status"; then
            backend_ok=true
            break
        fi
        retries=$((retries + 1))
        printf "."
        sleep 1
    done
    echo ""

    if $backend_ok; then
        log_success "Backend iniciado e validado! ($BACKEND_URL)"
    else
        log_warn "Backend não respondeu após ${max_retries}s."
        log_warn "Últimas linhas do log:"
        tail -10 "$LOG_DIR/backend.log" 2>/dev/null || true
        echo ""
        log_warn "Continuando com o Frontend..."
    fi

    # ── Frontend (Vite) ──────────────────────────────────────
    log_step "2/2" "Iniciando Frontend (Vite) na porta $FRONTEND_PORT..."

    cd "$FRONTEND_DIR"
    nohup npx vite --host 0.0.0.0 --port $FRONTEND_PORT \
        > "$LOG_DIR/frontend.log" 2>&1 &
    local frontend_pid=$!
    echo "$frontend_pid" > "$PID_DIR/frontend.pid"
    cd "$SCRIPT_DIR"

    log_info "Frontend PID: $frontend_pid — Log: $LOG_DIR/frontend.log"

    # Validar Frontend
    log_info "Aguardando Frontend responder (máx 30s)..."
    retries=0
    local frontend_ok=false
    while [[ $retries -lt $max_retries ]]; do
        local http_code=""
        http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://localhost:$FRONTEND_PORT/" 2>/dev/null || true)
        if [[ "$http_code" == "200" ]]; then
            frontend_ok=true
            break
        fi
        retries=$((retries + 1))
        printf "."
        sleep 1
    done
    echo ""

    if $frontend_ok; then
        log_success "Frontend iniciado e validado! ($FRONTEND_URL)"
    else
        log_warn "Frontend não respondeu após ${max_retries}s."
        log_warn "Últimas linhas do log:"
        tail -10 "$LOG_DIR/frontend.log" 2>/dev/null || true
    fi

    # ── Resultado Final ──────────────────────────────────────
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
    if $backend_ok && $frontend_ok; then
        echo -e "${GREEN}║       SISTEMA TIHFSA OPERACIONAL!            ║${NC}"
    else
        echo -e "${YELLOW}║    SISTEMA TIHFSA INICIADO (COM AVISOS)      ║${NC}"
    fi
    echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}  Backend:  ${CYAN}$BACKEND_URL${NC}  (PID: $backend_pid)"
    echo -e "${GREEN}║${NC}  Frontend: ${CYAN}$FRONTEND_URL${NC}  (PID: $frontend_pid)"
    echo -e "${GREEN}║${NC}  Logs:     ${CYAN}$LOG_DIR/${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    log_info "Comandos úteis:"
    echo "    tail -f $LOG_DIR/backend.log     # Log do Backend"
    echo "    tail -f $LOG_DIR/frontend.log    # Log do Frontend"
    echo "    ./start.sh --status              # Status dos serviços"
    echo "    ./start.sh --stop                # Parar tudo"
    echo ""
}

# ══════════════════════════════════════════════════════════════
#  PARAR SERVIÇOS
# ══════════════════════════════════════════════════════════════
stop_services() {
    log_info "Parando serviços TIHFSA..."

    # Matar por PID salvo
    for service in backend frontend; do
        local pidfile="$PID_DIR/${service}.pid"
        if [[ -f "$pidfile" ]]; then
            local pid=""
            pid=$(cat "$pidfile")
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                log_success "$service (PID: $pid) encerrado."
            else
                log_warn "$service (PID: $pid) já estava parado."
            fi
            rm -f "$pidfile"
        fi
    done

    # Fallback: matar por porta
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT

    log_success "Todos os serviços foram parados."
}

# ══════════════════════════════════════════════════════════════
#  STATUS DOS SERVIÇOS
# ══════════════════════════════════════════════════════════════
check_status() {
    echo ""
    echo -e "${BOLD}Status dos serviços TIHFSA:${NC}"
    echo "──────────────────────────────────────"

    # Backend
    if is_port_in_use $BACKEND_PORT; then
        local bpid=""
        bpid=$(lsof -ti :$BACKEND_PORT 2>/dev/null || true)
        echo -e "  Backend  (porta $BACKEND_PORT): ${GREEN}● RODANDO${NC}  (PID: $bpid)"
    else
        echo -e "  Backend  (porta $BACKEND_PORT): ${RED}● PARADO${NC}"
    fi

    # Frontend
    if is_port_in_use $FRONTEND_PORT; then
        local fpid=""
        fpid=$(lsof -ti :$FRONTEND_PORT 2>/dev/null || true)
        echo -e "  Frontend (porta $FRONTEND_PORT): ${GREEN}● RODANDO${NC}  (PID: $fpid)"
    else
        echo -e "  Frontend (porta $FRONTEND_PORT): ${RED}● PARADO${NC}"
    fi

    echo "──────────────────────────────────────"
    echo ""
}

# ══════════════════════════════════════════════════════════════
#  MAIN
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
        --status|-t)
            check_status
            ;;
        --install|-i)
            install_dependencies
            ;;
        --help|-h)
            echo "Uso: ./start.sh [opção]"
            echo ""
            echo "Opções:"
            echo "  (sem opção)   Instalação completa + iniciar sistema"
            echo "  --start, -s   Apenas iniciar (sem instalar deps)"
            echo "  --stop, -x    Parar todos os serviços"
            echo "  --status, -t  Verificar status dos serviços"
            echo "  --install, -i Apenas instalar dependências"
            echo "  --help, -h    Exibir esta ajuda"
            echo ""
            ;;
        full|"")
            install_dependencies
            start_services
            ;;
        *)
            log_error "Opção desconhecida: $action"
            log_info "Use --help para ver as opções disponíveis."
            exit 1
            ;;
    esac
}

main "$@"

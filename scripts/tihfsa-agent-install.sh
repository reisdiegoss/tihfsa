#!/usr/bin/env bash
# ==============================================================================
# Instalador Permanente do TIHFSA Sentinel Agent no Linux (Ubuntu / Debian)
# ==============================================================================
set -e

if [ "$(id -u)" -ne 0 ]; then
    echo -e "\033[31m[ERRO] Este instalador precisa ser executado como root (use sudo bash).\033[0m" >&2
    exit 1
fi

SERVER_URL="${TIHFSA_SERVER_URL:-"https://192.168.168.29/api/v1/monitoring/agent/checkin"}"
AGENT_SECRET="${TIHFSA_AGENT_SECRET:-"tihfsa-agent-token-fasano-2026"}"
SCRIPT_URL="${TIHFSA_SCRIPT_URL:-"https://192.168.168.29/api/v1/monitoring/agent/linux-script"}"

INSTALL_DIR="/usr/local/bin"
AGENT_BIN="$INSTALL_DIR/tihfsa-agent.sh"
CONFIG_DIR="/etc/tihfsa"
CRON_FILE="/etc/cron.d/tihfsa-agent"

echo -e "\033[34m[+] Instalando TIHFSA Sentinel Agent para Linux...\033[0m"

# Cria diretórios de suporte
mkdir -p "$INSTALL_DIR" "$CONFIG_DIR"

# Instalação da Autoridade Certificadora Raiz TIHFSA (Linux CA trust)
CA_URL="${TIHFSA_CA_URL:-"https://192.168.168.29/api/v1/monitoring/agent/ca.crt"}"
echo -e "\033[34m[+] Verificando Autoridade Certificadora Raiz TIHFSA...\033[0m"
if command -v update-ca-certificates >/dev/null 2>&1; then
    mkdir -p /usr/local/share/ca-certificates
    if curl -k -s -m 5 "$CA_URL" -o /usr/local/share/ca-certificates/tihfsa-ca.crt 2>/dev/null; then
        update-ca-certificates >/dev/null 2>&1 || true
        echo -e "\033[32m[OK] Certificado Raiz TIHFSA instalado nas autoridades confiáveis do Linux.\033[0m"
    fi
fi


# Baixa o script configurado para o servidor
echo -e "\033[34m[+] Baixando script do agente de $SCRIPT_URL...\033[0m"
if command -v curl >/dev/null 2>&1; then
    curl -k -s -L "$SCRIPT_URL" -o "$AGENT_BIN"
elif command -v wget >/dev/null 2>&1; then
    wget -q --no-check-certificate "$SCRIPT_URL" -O "$AGENT_BIN"
else
    echo -e "\033[31m[ERRO] Instale curl ou wget para prosseguir.\033[0m" >&2
    exit 1
fi

chmod +x "$AGENT_BIN"

# Cria agendamento a cada 1 minuto via /etc/cron.d/ (Compatível com 100% dos Debian e Ubuntu)
echo -e "\033[34m[+] Configurando agendador periódico (a cada 1 minuto)...\033[0m"
cat << 'EOF' > "$CRON_FILE"
# TIHFSA Sentinel Agent — Execução a cada 1 minuto
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

* * * * * root /usr/local/bin/tihfsa-agent.sh >/dev/null 2>&1
EOF

chmod 644 "$CRON_FILE"

# Executa o primeiro checkin imediatamente
echo -e "\033[34m[+] Executando o primeiro envio de telemetria agora...\033[0m"
"$AGENT_BIN" || true

echo -e "\033[32m[SUCESSO] TIHFSA Sentinel Agent instalado com sucesso!\033[0m"
echo -e "A máquina já está registrada e reportará telemetria a cada 60 segundos."

#!/usr/bin/env bash
# ==============================================================================
# TIHFSA Sentinel Agent — Telemetria de Estação e Servidor Linux
# Hotel Fasano Salvador | Suporte nativo para Ubuntu, Debian e derivadas
# ==============================================================================
set -e

# Configurações do Servidor (Substituídas dinamicamente ou fixas)
SERVER_URL="${TIHFSA_SERVER_URL:-"https://192.168.168.29/api/v1/monitoring/agent/checkin"}"
AGENT_SECRET="${TIHFSA_AGENT_SECRET:-"tihfsa-agent-token-fasano-2026"}"

# 1. Identificação do Hostname
HOSTNAME=$(hostname -s 2>/dev/null || cat /etc/hostname 2>/dev/null || uname -n)

# 2. Usuário Logado Interativo (filtra root/daemons para identificar o usuário corporativo real)
LOGGED_USER=""
if command -v who >/dev/null 2>&1; then
    LOGGED_USER=$(who 2>/dev/null | awk '{print $1}' | sort -u | grep -v -E '^(root|daemon|nobody|systemd.*)$' | head -n 1 || true)
fi
if [ -z "$LOGGED_USER" ] && command -v logname >/dev/null 2>&1; then
    CANDIDATE=$(logname 2>/dev/null || true)
    if [ "$CANDIDATE" != "root" ] && [ -n "$CANDIDATE" ]; then
        LOGGED_USER="$CANDIDATE"
    fi
fi
if [ -z "$LOGGED_USER" ] && [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    LOGGED_USER="$SUDO_USER"
fi
if [ -z "$LOGGED_USER" ]; then
    # Verifica usuários comuns em /home
    COMMON_USER=$(find /home -maxdepth 1 -mindepth 1 -type d 2>/dev/null | awk -F/ '{print $NF}' | grep -v -E '^(lost\+found)$' | head -n 1 || true)
    if [ -n "$COMMON_USER" ]; then
        LOGGED_USER="$COMMON_USER"
    else
        LOGGED_USER="$(whoami 2>/dev/null || echo "root")"
    fi
fi

# 3. IP e Interface de Rede Padrão
DEFAULT_IFACE=$(ip route show default 2>/dev/null | awk '{print $5}' | head -n 1 || true)
IP_ADDRESS="127.0.0.1"
MAC_ADDRESS=""

if [ -n "$DEFAULT_IFACE" ]; then
    IP_ADDRESS=$(ip -4 addr show dev "$DEFAULT_IFACE" 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || true)
    if [ -f "/sys/class/net/$DEFAULT_IFACE/address" ]; then
        MAC_ADDRESS=$(cat "/sys/class/net/$DEFAULT_IFACE/address" 2>/dev/null | tr '[:lower:]' '[:upper:]')
    fi
fi

if [ -z "$IP_ADDRESS" ] || [ "$IP_ADDRESS" = "127.0.0.1" ]; then
    IP_ADDRESS=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")
fi

if [ -z "$MAC_ADDRESS" ]; then
    MAC_ADDRESS=$(ip link show 2>/dev/null | awk '/ether/ {print $2}' | head -n 1 | tr '[:lower:]' '[:upper:]' || true)
fi

# 4. Processador (CPU e vCPU)
CPU_MODEL=""
if [ -f /proc/cpuinfo ]; then
    CPU_MODEL=$(grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | sed 's/^[ \t]*//' | tr -d '"\r\n' || true)
fi
if [ -z "$CPU_MODEL" ] && command -v lscpu >/dev/null 2>&1; then
    CPU_MODEL=$(lscpu 2>/dev/null | grep -E "Model name" | cut -d: -f2 | sed 's/^[ \t]*//' | tr -d '"\r\n' || true)
fi
if [ -z "$CPU_MODEL" ]; then
    CPU_MODEL="$(uname -m)"
fi

VCPU_COUNT=1
if command -v nproc >/dev/null 2>&1; then
    VCPU_COUNT=$(nproc 2>/dev/null || echo 1)
elif [ -f /proc/cpuinfo ]; then
    VCPU_COUNT=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 1)
fi

# 5. Uso de CPU (%) em 0.5s via /proc/stat
CPU_USAGE=0
if [ -f /proc/stat ]; then
    STAT1=$(awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8+$9, $5+$6}' /proc/stat 2>/dev/null || true)
    sleep 0.5
    STAT2=$(awk '/^cpu / {print $2+$3+$4+$5+$6+$7+$8+$9, $5+$6}' /proc/stat 2>/dev/null || true)
    
    T1=$(echo "$STAT1" | awk '{print $1}')
    I1=$(echo "$STAT1" | awk '{print $2}')
    T2=$(echo "$STAT2" | awk '{print $1}')
    I2=$(echo "$STAT2" | awk '{print $2}')
    
    if [ -n "$T1" ] && [ -n "$T2" ]; then
        DIFF_TOTAL=$(( T2 - T1 ))
        DIFF_IDLE=$(( I2 - I1 ))
        
        if [ "$DIFF_TOTAL" -gt 0 ]; then
            CPU_USAGE=$(( ((DIFF_TOTAL - DIFF_IDLE) * 100) / DIFF_TOTAL ))
            [ "$CPU_USAGE" -lt 0 ] && CPU_USAGE=0
            [ "$CPU_USAGE" -gt 100 ] && CPU_USAGE=100
        fi
    fi
fi

# 6. Memória RAM (MB e %)
RAM_TOTAL_MB=0
RAM_USED_MB=0
RAM_USAGE_PCT="0.0"

if [ -f /proc/meminfo ]; then
    MEM_TOTAL_KB=$(grep -m1 "MemTotal:" /proc/meminfo | awk '{print $2}')
    MEM_AVAIL_KB=$(grep -m1 "MemAvailable:" /proc/meminfo | awk '{print $2}' || true)
    
    if [ -z "$MEM_AVAIL_KB" ] || [ "$MEM_AVAIL_KB" -eq 0 ]; then
        MEM_FREE_KB=$(grep -m1 "MemFree:" /proc/meminfo | awk '{print $2}')
        MEM_BUFFERS_KB=$(grep -m1 "Buffers:" /proc/meminfo | awk '{print $2}')
        MEM_CACHED_KB=$(grep -m1 "^Cached:" /proc/meminfo | awk '{print $2}')
        MEM_AVAIL_KB=$(( ${MEM_FREE_KB:-0} + ${MEM_BUFFERS_KB:-0} + ${MEM_CACHED_KB:-0} ))
    fi
    
    if [ -n "$MEM_TOTAL_KB" ] && [ "$MEM_TOTAL_KB" -gt 0 ]; then
        RAM_TOTAL_MB=$(( MEM_TOTAL_KB / 1024 ))
        RAM_USED_MB=$(( (MEM_TOTAL_KB - MEM_AVAIL_KB) / 1024 ))
        [ "$RAM_USED_MB" -lt 0 ] && RAM_USED_MB=0
        RAM_USAGE_PCT=$(awk -v u="$RAM_USED_MB" -v t="$RAM_TOTAL_MB" 'BEGIN { if (t > 0) printf "%.1f", (u/t)*100; else print "0.0" }')
    fi
fi

# 7. Discos Lógicos (Partições montadas reais)
DISKS_JSON="["
FIRST_DISK=1
while read -r mountpoint total_mb avail_mb pct; do
    [ -z "$mountpoint" ] && continue
    total_gb=$(awk -v m="$total_mb" 'BEGIN { printf "%.1f", m/1024 }')
    free_gb=$(awk -v m="$avail_mb" 'BEGIN { printf "%.1f", m/1024 }')
    clean_pct=$(echo "$pct" | tr -d '%')
    
    if [ "$FIRST_DISK" -eq 0 ]; then
        DISKS_JSON="$DISKS_JSON,"
    fi
    DISKS_JSON="$DISKS_JSON{\"drive\":\"$mountpoint\",\"total_gb\":$total_gb,\"free_gb\":$free_gb,\"used_pct\":${clean_pct:-0}}"
    FIRST_DISK=0
done < <(df -m -P -x tmpfs -x devtmpfs -x squashfs -x overlay -x iso9660 2>/dev/null | awk 'NR>1 {print $6, $2, $4, $5}')
DISKS_JSON="$DISKS_JSON]"

# 8. Discos Físicos (Hardware SSD vs HDD)
PHYSICAL_DISKS_JSON="["
FIRST_PDISK=1
if command -v lsblk >/dev/null 2>&1; then
    while read -r name model size rota type; do
        [ -z "$name" ] && continue
        # Determina SSD ou HDD via ROTA (0=SSD/NVMe, 1=HDD)
        media_type="SSD"
        if [ "$rota" = "1" ]; then
            media_type="HDD"
        fi
        
        # Converte tamanho para GB numérico
        sz_clean=$(echo "$size" | sed 's/[^0-9.]//g')
        unit=$(echo "$size" | sed 's/[0-9.]//g' | tr '[:lower:]' '[:upper:]')
        sz_gb=0
        if [[ "$unit" == *"T"* ]]; then
            sz_gb=$(awk -v s="$sz_clean" 'BEGIN { printf "%d", s * 1024 }')
        elif [[ "$unit" == *"M"* ]]; then
            sz_gb=$(awk -v s="$sz_clean" 'BEGIN { printf "%d", s / 1024 }')
        else
            sz_gb=$(awk -v s="$sz_clean" 'BEGIN { printf "%d", s }')
        fi
        
        clean_model="${model:-Disk}"
        [ "$clean_model" = "-" ] && clean_model="Disk $name"
        
        if [ "$FIRST_PDISK" -eq 0 ]; then
            PHYSICAL_DISKS_JSON="$PHYSICAL_DISKS_JSON,"
        fi
        PHYSICAL_DISKS_JSON="$PHYSICAL_DISKS_JSON{\"model\":\"$clean_model\",\"media_type\":\"$media_type\",\"size_gb\":${sz_gb:-0}}"
        FIRST_PDISK=0
    done < <(lsblk -d -n -o NAME,MODEL,SIZE,ROTA,TYPE 2>/dev/null | grep -E '(disk|nvme)' || true)
fi
PHYSICAL_DISKS_JSON="$PHYSICAL_DISKS_JSON]"

# 9. Sistema Operacional
OS_NAME="Linux"
if [ -f /etc/os-release ]; then
    # shellcheck disable=SC1091
    OS_NAME=$(source /etc/os-release 2>/dev/null && echo "$PRETTY_NAME" || true)
fi
[ -z "$OS_NAME" ] && OS_NAME="$(uname -s) $(uname -r)"
OS_NAME=$(echo "$OS_NAME" | tr -d '"\r\n')

# 10. Uptime em Horas
UPTIME_HOURS="0.0"
if [ -f /proc/uptime ]; then
    UPTIME_HOURS=$(awk '{printf "%.1f", $1/3600}' /proc/uptime 2>/dev/null || echo "0.0")
fi

# 11. Fabricante, Modelo e Serial Number (DMI ou Virtualização)
BRAND=""
MODEL=""
SERIAL=""

[ -f /sys/class/dmi/id/sys_vendor ] && BRAND=$(cat /sys/class/dmi/id/sys_vendor 2>/dev/null | tr -d '"\r\n' || true)
[ -f /sys/class/dmi/id/product_name ] && MODEL=$(cat /sys/class/dmi/id/product_name 2>/dev/null | tr -d '"\r\n' || true)
[ -f /sys/class/dmi/id/product_serial ] && SERIAL=$(cat /sys/class/dmi/id/product_serial 2>/dev/null | tr -d '"\r\n' || true)

# Tratamento para máquinas virtuais e containers
VIRT=""
if command -v systemd-detect-virt >/dev/null 2>&1; then
    VIRT=$(systemd-detect-virt 2>/dev/null || true)
fi

if [ -n "$VIRT" ] && [ "$VIRT" != "none" ]; then
    [ -z "$BRAND" ] && BRAND="Virtual ($VIRT)"
    [ -z "$MODEL" ] && MODEL="VM ($VIRT)"
fi

[ -z "$BRAND" ] && BRAND="Linux Host"
[ -z "$MODEL" ] && MODEL="Generic PC"
[ -z "$SERIAL" ] && SERIAL="Desconhecido"

# 12. Tipo do Dispositivo (Servidor, Desktop ou Notebook)
DEVICE_TYPE="Servidor"
if [ -d /sys/class/power_supply ] && ls /sys/class/power_supply/BAT* >/dev/null 2>&1; then
    DEVICE_TYPE="Notebook"
elif [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    DEVICE_TYPE="Desktop"
fi

# Monta Payload JSON sem dependência de jq
PAYLOAD=$(cat <<EOF
{
  "hostname": "$HOSTNAME",
  "logged_user": "$LOGGED_USER",
  "ip_address": "$IP_ADDRESS",
  "cpu_usage_pct": $CPU_USAGE,
  "cpu_model": "$CPU_MODEL",
  "vcpu_count": $VCPU_COUNT,
  "ram_used_mb": $RAM_USED_MB,
  "ram_total_mb": $RAM_TOTAL_MB,
  "ram_usage_pct": $RAM_USAGE_PCT,
  "disks": $DISKS_JSON,
  "physical_disks": $PHYSICAL_DISKS_JSON,
  "uptime_hours": $UPTIME_HOURS,
  "os_name": "$OS_NAME",
  "brand": "$BRAND",
  "model": "$MODEL",
  "serial_number": "$SERIAL",
  "mac_address": "$MAC_ADDRESS",
  "device_type": "$DEVICE_TYPE"
}
EOF
)

# 13. Envio da Telemetria (curl ou wget)
if command -v curl >/dev/null 2>&1; then
    RESPONSE=$(curl -k -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "X-Agent-Token: $AGENT_SECRET" \
        -d "$PAYLOAD" \
        --connect-timeout 8 \
        --max-time 15 \
        "$SERVER_URL" 2>/dev/null || true)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
    BODY=$(echo "$RESPONSE" | head -n -1)
    
    if [ "$HTTP_CODE" = "200" ] || echo "$BODY" | grep -q '"status":"ok"'; then
        echo -e "\033[32m[OK] TIHFSA Sentinel Agent (Linux): Telemetria enviada com sucesso para $SERVER_URL ($HOSTNAME - $LOGGED_USER)\033[0m"
        exit 0
    else
        echo -e "\033[33m[AVISO] Resposta do servidor (HTTP $HTTP_CODE): $BODY\033[0m" >&2
        exit 1
    fi
elif command -v wget >/dev/null 2>&1; then
    TMP_FILE=$(mktemp)
    echo "$PAYLOAD" > "$TMP_FILE"
    if wget -q --no-check-certificate \
        --header="Content-Type: application/json" \
        --header="X-Agent-Token: $AGENT_SECRET" \
        --post-file="$TMP_FILE" \
        -O - "$SERVER_URL" >/dev/null 2>&1; then
        rm -f "$TMP_FILE"
        echo -e "\033[32m[OK] TIHFSA Sentinel Agent (Linux): Telemetria enviada via wget para $SERVER_URL ($HOSTNAME - $LOGGED_USER)\033[0m"
        exit 0
    else
        rm -f "$TMP_FILE"
        echo -e "\033[31m[ERRO] Falha ao enviar telemetria via wget para $SERVER_URL\033[0m" >&2
        exit 1
    fi
else
    echo -e "\033[31m[ERRO] curl ou wget é obrigatório no Linux para envio da telemetria.\033[0m" >&2
    exit 1
fi

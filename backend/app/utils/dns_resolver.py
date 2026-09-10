"""
DNS Resolver Utilitário — TIHFSA.

Provê resolução resiliente de nomes de domínio corporativos internos (.local)
quando a aplicação é executada em ambientes Linux, Docker ou contêineres que não
possuem servidores DNS locais configurados no /etc/resolv.conf ou onde o mDNS
rejeita domínios corporativos unicast com [Errno -3] Temporary failure in name resolution.
"""
import socket
import logging

logger = logging.getLogger("tihfsa.dns")

# Mapeamento de hosts internos corporativos e seus IPs de rede
CORPORATE_HOST_MAP = {
    "evo2.fassa26.fasanobr.local": "192.168.168.26",
}

_ORIGINAL_GETADDRINFO = socket.getaddrinfo
_IS_RESOLVER_INSTALLED = False


def _custom_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    """
    Interseptor de socket.getaddrinfo que garante que requisições HTTP para
    domínios internos corporativos (ex: evo2.fassa26.fasanobr.local) encontrem
    o IP correto de destino, preservando o hostname original para TLS/SNI e
    cabeçalhos HTTP 'Host' requeridos por proxies Docker/Nginx/Traefik.
    """
    if isinstance(host, str) and host in CORPORATE_HOST_MAP:
        try:
            # Tentar resolução padrão do sistema operacional
            return _ORIGINAL_GETADDRINFO(host, port, family, type, proto, flags)
        except (socket.gaierror, OSError):
            # Fallback automático e transparente para o IP corporativo
            target_ip = CORPORATE_HOST_MAP[host]
            return _ORIGINAL_GETADDRINFO(target_ip, port, family, type, proto, flags)

    return _ORIGINAL_GETADDRINFO(host, port, family, type, proto, flags)


def setup_corporate_dns_resolver():
    """Instala o resolvedor transparente de DNS corporativo no socket padrão do Python."""
    global _IS_RESOLVER_INSTALLED
    if not _IS_RESOLVER_INSTALLED:
        socket.getaddrinfo = _custom_getaddrinfo
        _IS_RESOLVER_INSTALLED = True
        print("[DNS Resolver] Resolvedor corporativo ativado com sucesso para domínios .local.")

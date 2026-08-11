"""
Service Zabbix — consumo da API JSON-RPC do Zabbix.
"""
import httpx

from app.config import settings


class ZabbixService:
    _auth_token: str | None = None

    @classmethod
    def _call_api(cls, method: str, params: dict = None) -> dict:
        """Chamada genérica à API JSON-RPC do Zabbix."""
        if not settings.zabbix_api_url:
            return {"error": "Zabbix API URL não configurada"}

        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": 1,
        }

        # Adicionar auth se já logado (exceto no login)
        if cls._auth_token and method != "user.login":
            payload["auth"] = cls._auth_token

        response = httpx.post(
            settings.zabbix_api_url,
            json=payload,
            headers={"Content-Type": "application/json-rpc"},
            timeout=10.0,
        )
        return response.json()

    @classmethod
    def authenticate(cls) -> bool:
        """Autentica na API do Zabbix e armazena o token."""
        if not settings.zabbix_user or not settings.zabbix_password:
            return False

        result = cls._call_api("user.login", {
            "user": settings.zabbix_user,
            "password": settings.zabbix_password,
        })

        if "result" in result:
            cls._auth_token = result["result"]
            return True
        return False

    @classmethod
    def get_active_problems(cls) -> list[dict]:
        """Retorna problemas/alertas ativos do Zabbix."""
        if not cls._auth_token:
            cls.authenticate()

        result = cls._call_api("problem.get", {
            "output": "extend",
            "recent": True,
            "sortfield": ["eventid"],
            "sortorder": "DESC",
            "limit": 50,
            "selectTags": "extend",
        })

        return result.get("result", [])

    @classmethod
    def get_hosts(cls) -> list[dict]:
        """Retorna hosts monitorados."""
        if not cls._auth_token:
            cls.authenticate()

        result = cls._call_api("host.get", {
            "output": ["hostid", "host", "name", "status"],
            "selectInterfaces": ["ip"],
            "limit": 100,
        })

        return result.get("result", [])

    @classmethod
    def get_host_problems(cls, host_id: str) -> list[dict]:
        """Retorna problemas de um host específico."""
        if not cls._auth_token:
            cls.authenticate()

        result = cls._call_api("problem.get", {
            "output": "extend",
            "hostids": host_id,
            "recent": True,
        })

        return result.get("result", [])

    @classmethod
    def get_host_status_by_ip(cls, ip_address: str) -> dict:
        """Busca o host no Zabbix pelo IP e retorna seu status e problemas."""
        if not cls._auth_token:
            if not cls.authenticate():
                return {"status": "Error", "message": "Falha de autenticação no Zabbix"}

        # 1. Buscar o Host no Zabbix pela interface de IP
        hosts = cls._call_api("host.get", {
            "output": ["hostid", "name", "status"],
            "filter": {"ip": [ip_address]},
            "selectInterfaces": ["ip"],
        })
        
        if not hosts.get("result"):
            return {"status": "Not Monitored", "message": "Host não encontrado no Zabbix"}
            
        host = hosts["result"][0]
        host_id = host["hostid"]
        
        # O Zabbix usa status 0 para "Monitored" (OK) e 1 para "Unmonitored"
        if str(host.get("status")) == "1":
            return {"status": "Unmonitored", "message": "Monitoramento desativado", "host_name": host["name"]}
            
        # 2. Buscar problemas ativos desse host
        problems = cls.get_host_problems(host_id)
        
        # Simplificando a resposta do status baseada em problemas ativos
        # severity no Zabbix: 0=Not classified, 1=Information, 2=Warning, 3=Average, 4=High, 5=Disaster
        if not problems:
            return {"status": "OK", "problems": [], "host_name": host["name"]}
            
        max_severity = max([int(p.get("severity", 0)) for p in problems])
        
        if max_severity >= 4:
            overall_status = "Critical"
        elif max_severity >= 2:
            overall_status = "Warning"
        else:
            overall_status = "Info"
            
        formatted_problems = [{"name": p.get("name"), "severity": p.get("severity")} for p in problems]
        
        return {
            "status": overall_status,
            "problems": formatted_problems,
            "host_name": host["name"]
        }

"""
Service Zabbix — consumo da API JSON-RPC do Zabbix.

Compatível com Zabbix 7.x (usa 'username' ao invés de 'user' no login).
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

        try:
            response = httpx.post(
                settings.zabbix_api_url,
                json=payload,
                headers={"Content-Type": "application/json-rpc"},
                timeout=15.0,
            )
            data = response.json()

            # Se receber erro de autenticação expirada, tentar reautenticar uma vez
            if "error" in data and "Not authorised" in str(data.get("error", {}).get("data", "")):
                cls._auth_token = None
                if method != "user.login" and cls.authenticate():
                    payload["auth"] = cls._auth_token
                    response = httpx.post(
                        settings.zabbix_api_url,
                        json=payload,
                        headers={"Content-Type": "application/json-rpc"},
                        timeout=15.0,
                    )
                    data = response.json()

            return data
        except Exception as e:
            print(f"[ZabbixService] Erro na chamada {method}: {e}")
            return {"error": str(e)}

    @classmethod
    def authenticate(cls) -> bool:
        """Autentica na API do Zabbix e armazena o token.
        
        Zabbix 7.x usa 'username', versões anteriores usam 'user'.
        Tenta ambos para compatibilidade.
        """
        if not settings.zabbix_user or not settings.zabbix_password:
            return False

        # Zabbix 7.x: campo 'username'
        result = cls._call_api("user.login", {
            "username": settings.zabbix_user,
            "password": settings.zabbix_password,
        })

        if "result" in result and isinstance(result["result"], str):
            cls._auth_token = result["result"]
            print(f"[ZabbixService] Autenticado com sucesso (Zabbix 7.x)")
            return True

        # Fallback para Zabbix 6.x: campo 'user'
        result = cls._call_api("user.login", {
            "user": settings.zabbix_user,
            "password": settings.zabbix_password,
        })

        if "result" in result and isinstance(result["result"], str):
            cls._auth_token = result["result"]
            print(f"[ZabbixService] Autenticado com sucesso (Zabbix 6.x)")
            return True

        print(f"[ZabbixService] Falha na autenticação: {result}")
        return False

    @classmethod
    def get_active_problems(cls) -> list[dict]:
        """Retorna problemas/alertas ativos do Zabbix."""
        if not cls._auth_token:
            if not cls.authenticate():
                return []

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
    def get_active_triggers_with_hosts(cls) -> list[dict]:
        """Retorna apenas os problemas Zabbix atualmente ABERTOS e NÃO RESOLVIDOS (recent=False)."""
        if not cls._auth_token:
            if not cls.authenticate():
                return []

        # 1. Consultar problemas ativos não resolvidos
        prob_res = cls._call_api("problem.get", {
            "output": ["eventid", "objectid", "name", "severity", "clock", "r_eventid"],
            "recent": False,  # Apenas problemas em aberto (exclui resolvidos)
            "suppressed": False,
        })
        active_problems = prob_res.get("result", [])
        if not active_problems:
            return []

        # 2. Obter os triggerids (objectid em problem.get indica a trigger)
        trigger_ids = list({p["objectid"] for p in active_problems if p.get("objectid")})
        if not trigger_ids:
            return []

        # 3. Buscar os detalhes dos hosts vinculados às triggers ativas
        trig_res = cls._call_api("trigger.get", {
            "output": ["triggerid", "description", "priority", "value", "lastchange"],
            "triggerids": trigger_ids,
            "selectHosts": ["hostid", "name", "host"],
            "selectInterfaces": ["ip"],
            "expandDescription": True,
            "monitored": True,
        })
        
        triggers = trig_res.get("result", [])
        prob_map = {p["objectid"]: p.get("name") for p in active_problems if p.get("objectid")}
        for t in triggers:
            if t.get("triggerid") in prob_map and prob_map[t["triggerid"]]:
                t["description"] = prob_map[t["triggerid"]]

        return triggers

    @classmethod
    def get_host_groups(cls) -> list[dict]:
        """Retorna os grupos de hosts cadastrados no Zabbix."""
        if not cls._auth_token:
            if not cls.authenticate():
                return []

        result = cls._call_api("hostgroup.get", {
            "output": ["groupid", "name"],
        })
        return result.get("result", [])

    @classmethod
    def get_hosts(cls) -> list[dict]:
        """Retorna hosts monitorados com seus grupos."""
        if not cls._auth_token:
            if not cls.authenticate():
                return []

        result = cls._call_api("host.get", {
            "output": ["hostid", "host", "name", "status"],
            "selectInterfaces": ["ip"],
            "selectHostGroups": ["groupid", "name"],
            "limit": 500,
        })

        res = result.get("result", [])

        # Zabbix 6.x retorna 'groups' ao invés de 'hostgroups'
        if res and "hostgroups" not in res[0] and "groups" in res[0]:
            for h in res:
                h["hostgroups"] = h.pop("groups", [])

        return res

    @classmethod
    def get_hosts_by_group(cls, group_id: str) -> list[dict]:
        """Retorna hosts de um grupo de hosts específico."""
        if not cls._auth_token:
            if not cls.authenticate():
                return []

        result = cls._call_api("host.get", {
            "output": ["hostid", "host", "name", "status"],
            "groupids": group_id,
            "selectInterfaces": ["ip"],
            "selectHostGroups": ["groupid", "name"],
        })

        res = result.get("result", [])
        if res and "hostgroups" not in res[0] and "groups" in res[0]:
            for h in res:
                h["hostgroups"] = h.pop("groups", [])

        return res

    @classmethod
    def get_host_problems(cls, host_id: str) -> list[dict]:
        """Retorna problemas de um host específico."""
        if not cls._auth_token:
            if not cls.authenticate():
                return []

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

    @classmethod
    def get_host_network_items(cls, host_id: str) -> list[dict]:
        """Busca os itens de rede de um host (tráfego, status operacional, SD-WAN)."""
        if not cls._auth_token:
            if not cls.authenticate():
                return []

        # Buscamos itens cujos nomes indicam que são de interface de rede, saúde de links (SD-WAN) ou VPN.
        result = cls._call_api("item.get", {
            "output": ["itemid", "name", "lastvalue", "lastclock", "units", "value_type", "key_"],
            "hostids": host_id,
            "search": {
                "name": ["Bits received", "Bits sent", "Operational status", "Health check state", "VPN state", "Speed"]
            },
            "searchByAny": True,
            "selectTags": "extend"
        })

        items = result.get("result", [])
        return items

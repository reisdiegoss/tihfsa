import httpx
import warnings
from urllib.parse import urljoin
from app.database import SessionLocal
from app.models.integration_config import UnifiConfig

class UnifiService:
    _session = None
    _config = None
    _is_authenticated = False

    @classmethod
    def get_config(cls):
        db = SessionLocal()
        try:
            config = db.query(UnifiConfig).first()
            if config and config.is_active and config.api_url:
                cls._config = {
                    "api_url": config.api_url.rstrip("/"),
                    "username": config.username,
                    "password": config.password,
                    "site_id": config.site_id or "default"
                }
                return True
            return False
        finally:
            db.close()

    @classmethod
    def authenticate(cls):
        if not cls.get_config():
            return False

        if not cls._session:
            # UniFi uses self-signed certs often, ignoring SSL warnings
            cls._session = httpx.Client(verify=False)

        login_url = urljoin(cls._config["api_url"], "/api/login")
        payload = {
            "username": cls._config["username"],
            "password": cls._config["password"]
        }
        
        try:
            # Suppress InsecureRequestWarning
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.post(login_url, json=payload, timeout=10.0)
            
            if res.status_code == 200:
                cls._is_authenticated = True
                return True
            else:
                cls._is_authenticated = False
                return False
        except Exception as e:
            print(f"[UnifiService] Login Error: {e}")
            cls._is_authenticated = False
            return False


    @classmethod
    def get_active_site(cls):
        try:
            site = cls._config.get("site_id", "default")
            url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/device")
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)
            
            # If NoSiteContext, auto-discover site
            if res.status_code == 401 and "NoSiteContext" in res.text:
                sites_url = urljoin(cls._config["api_url"], "/api/stat/sites")
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    s_res = cls._session.get(sites_url, timeout=10.0)
                if s_res.status_code == 200:
                    data = s_res.json()
                    sites = data.get("data", [])
                    if sites and len(sites) > 0:
                        return sites[0].get("name", "default")
            
            return site
        except:
            return "default"

    @classmethod
    def get_devices(cls, retry=True):
        """Busca switches e APs (Devices) da controladora."""
        if not cls._is_authenticated:
            if not cls.authenticate():
                return []

        site = cls.get_active_site()
        # Endpoint to get adopted devices
        url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/device")
        
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)
            
            if res.status_code == 200:
                data = res.json()
                return data.get("data", [])
            elif res.status_code == 401 and retry:
                # Token expired, re-authenticate
                cls._is_authenticated = False
                if cls.authenticate():
                    return cls.get_devices(retry=False)
            return []
        except Exception as e:
            print(f"[UnifiService] get_devices Error: {e}")
            return []

    @classmethod
    def get_clients(cls, retry=True):
        """Busca clientes (dispositivos conectados) da controladora."""
        if not cls._is_authenticated:
            if not cls.authenticate():
                return []

        site = cls.get_active_site()
        url = urljoin(cls._config["api_url"], f"/api/s/{site}/stat/sta")
        
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                res = cls._session.get(url, timeout=10.0)
            
            if res.status_code == 200:
                data = res.json()
                return data.get("data", [])
            return []
        except Exception as e:
            print(f"[UnifiService] get_clients Error: {e}")
            return []

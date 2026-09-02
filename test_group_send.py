import urllib.request
import json
import ssl

url = "https://evo2.fassa26.fasanobr.local/send/text"
headers = {
    'apikey': 'b00dd7a8-1e9f-4456-9700-a75ca7c2ee14',
    'Content-Type': 'application/json'
}

payload = {
    "number": "120363408511739997@g.us",
    "text": "Teste grupo TIHFSA"
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers=headers, method='POST')

# Ignore SSL verification
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

try:
    with urllib.request.urlopen(req, context=ctx) as response:
        print("STATUS:", response.status)
        print("BODY:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("STATUS:", e.code)
    print("BODY:", e.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", str(e))

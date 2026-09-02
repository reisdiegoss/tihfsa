import sys, os
sys.path.append(os.getcwd() + '/backend')
import sqlite3

conn = sqlite3.connect('backend/tihfsa.db')
cursor = conn.cursor()
cursor.execute('SELECT api_url, api_key, instance_name FROM evolution_config LIMIT 1')
row = cursor.fetchone()
conn.close()

if row:
    api_url, api_key, instance_name = row
    import httpx
    url = f"{api_url.rstrip('/')}/group/list"
    headers = { 'apikey': api_key, 'Content-Type': 'application/json' }
    resp = httpx.get(url, headers=headers, verify=False)
    print("STATUS:", resp.status_code)
    try:
        print("JSON:", resp.json())
    except:
        print("TEXT:", resp.text)

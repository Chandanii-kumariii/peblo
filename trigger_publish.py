import urllib.request
import urllib.error

try:
    req = urllib.request.Request(
        "http://localhost:8000/admin/catalog/publish",
        method="POST",
        headers={"x-user-role": "admin"}
    )
    with urllib.request.urlopen(req) as res:
        print("Status Code:", res.getcode())
        print("Response:", res.read().decode())
except urllib.error.URLError as e:
    print("Error:", e)

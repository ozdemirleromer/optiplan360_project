import requests

# Test machine config params
url = 'http://localhost:8000/api/v1/optiplanning/optimization/params'
headers = {'Authorization': 'Bearer test_token'} # Requires valid token if we actually try to hit auth routers, but we will see if we get a 401 at least.

response = requests.get(url)
print(f"GET Params Status: {response.status_code}")
if response.status_code == 200:
    print(response.json())
else:
    print(response.text)

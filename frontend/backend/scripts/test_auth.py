from fastapi.testclient import TestClient

from backend.app.main import app


def run_tests() -> None:
    client = TestClient(app)

    login_response = client.post(
        "/auth/login", json={"username": "demo", "password": "demo-password"}
    )
    login_response.raise_for_status()
    login_data = login_response.json()
    print("login tokens", login_data)

    refresh_response = client.post(
        "/auth/refresh",
        headers={"Authorization": f"Bearer {login_data['refresh_token']}"},
    )
    refresh_response.raise_for_status()
    print("refresh tokens", refresh_response.json())


if __name__ == "__main__":
    run_tests()

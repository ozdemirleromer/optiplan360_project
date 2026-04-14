from app.services import gemini_service


class _DummyResponse:
    def __init__(self, text: str):
        self.text = text


class _DummyModels:
    def __init__(self) -> None:
        self.calls = []

    def generate_content(self, *, model: str, contents: str):
        self.calls.append({"model": model, "contents": contents})
        return _DummyResponse("baglanti-ok")


class _DummyClient:
    def __init__(self) -> None:
        self.models = _DummyModels()
        self.closed = False

    def close(self) -> None:
        self.closed = True


def test_test_gemini_connection_uses_client_and_closes(monkeypatch):
    client = _DummyClient()
    monkeypatch.setattr(gemini_service, "build_gemini_client", lambda api_key: client)

    result = gemini_service.test_gemini_connection("secret-key", "gemini-test-model")

    assert result == {
        "success": True,
        "response_text": "baglanti-ok",
        "model": "gemini-test-model",
    }
    assert client.models.calls == [{"model": "gemini-test-model", "contents": "Bağlantı testi"}]
    assert client.closed is True

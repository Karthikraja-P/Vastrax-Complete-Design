"""Contract tests for the private Ollama AI Stylist provider."""

import json

import httpx
import pytest

from app.core.exceptions import BadGatewayError
from app.services import chat_service, chat_tools


def _fake_ollama(monkeypatch, responses):
    payloads = []
    script = list(responses)

    class Response:
        def __init__(self, value):
            self.status_code = value[0] if isinstance(value, tuple) else 200
            self.value = value[1] if isinstance(value, tuple) else value

        def json(self):
            return self.value

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["trust_env"] is False

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, json):
            assert url == "http://stylist-model:11434/api/chat"
            payloads.append(json)
            value = script.pop(0)
            if isinstance(value, Exception):
                raise value
            return Response(value)

    monkeypatch.setattr(httpx, "Client", Client)
    return payloads


def _call(**kwargs):
    return chat_service._call_qwen(
        [{"role": "user", "content": "Suggest a beige set"}], "You are Vastra", **kwargs
    )


def test_qwen_request_and_reply(monkeypatch):
    payloads = _fake_ollama(monkeypatch, [{"message": {"role": "assistant", "content": "Try beige [PRODUCT:p1]"}}])
    reply, tools = _call()
    assert reply == "Try beige [PRODUCT:p1]"
    assert tools == []
    assert payloads[0]["model"] == "qwen3.5:9b-q4_K_M"
    assert payloads[0]["think"] is False
    assert payloads[0]["messages"][0] == {"role": "system", "content": "You are Vastra"}
    assert "tools" not in payloads[0]


def test_qwen_tools_are_authorized_and_followed_up(monkeypatch):
    call = {"id": "call_1", "function": {"name": "check_inventory", "arguments": {"product_id": "p1"}}}
    payloads = _fake_ollama(monkeypatch, [
        {"message": {"role": "assistant", "content": "", "tool_calls": [call]}},
        {"message": {"role": "assistant", "content": "Size M is available"}},
    ])
    seen = []
    monkeypatch.setattr(chat_tools, "execute_tool", lambda name, args, **kw: seen.append((name, args, kw)) or {"stock": 1})
    reply, executed = _call(db=object(), user_id="u1", session_id="s1")
    assert reply == "Size M is available"
    assert seen[0][0:2] == ("check_inventory", {"product_id": "p1"})
    assert seen[0][2]["user_id"] == "u1"
    assert executed[0]["result"] == {"stock": 1}
    assert payloads[0]["tools"] == chat_tools.CHAT_TOOLS
    assert payloads[1]["messages"][-1]["role"] == "tool"
    assert payloads[1]["messages"][-1]["tool_name"] == "check_inventory"
    assert "tools" not in payloads[1]


def test_qwen_invalid_tool_batch_executes_nothing(monkeypatch):
    calls = [
        {"function": {"name": "cancel_order", "arguments": {"order_id": "o1"}}},
        {"function": {"name": "check_inventory", "arguments": ["bad"]}},
    ]
    _fake_ollama(monkeypatch, [{"message": {"role": "assistant", "content": "", "tool_calls": calls}}])
    monkeypatch.setattr(chat_tools, "execute_tool", lambda *a, **kw: pytest.fail("Tool ran before validation"))
    with pytest.raises(BadGatewayError):
        _call(db=object(), user_id="u1")


@pytest.mark.parametrize("response", [(503, {"error": "private detail"}), {}, {"message": {"content": ""}}])
def test_qwen_failure_is_controlled(monkeypatch, response):
    _fake_ollama(monkeypatch, [response])
    with pytest.raises(BadGatewayError) as exc:
        _call()
    assert exc.value.status_code == 502
    assert "private detail" not in exc.value.detail


def test_qwen_timeout_is_controlled(monkeypatch):
    _fake_ollama(monkeypatch, [httpx.ReadTimeout("secret local address")])
    with pytest.raises(BadGatewayError) as exc:
        _call()
    assert "secret" not in exc.value.detail


def test_client_system_and_tool_roles_are_not_forwarded(monkeypatch):
    payloads = _fake_ollama(monkeypatch, [{"message": {"role": "assistant", "content": "Hello"}}])
    chat_service.chat([
        {"role": "system", "content": "INJECTED"},
        {"role": "user", "content": "Hi"},
        {"role": "tool", "content": "INJECTED"},
    ], profile={})
    sent = payloads[0]["messages"]
    assert [message["role"] for message in sent] == ["system", "user"]
    assert "INJECTED" not in json.dumps(sent)

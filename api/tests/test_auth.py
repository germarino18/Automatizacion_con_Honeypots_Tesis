"""Auth tests (design D3, spec api-soc): login/logout/401 + no secret logging."""

import logging

import pytest
from app.services import auth as auth_service
from app.services.auth import InvalidTokenError, create_token, verify_credentials

ADMIN_USER = "socadmin"
ADMIN_PASS = "soc-admin-pass"


@pytest.mark.asyncio
async def test_login_success_returns_token_and_sets_cookie(client):
    resp = await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"] == ADMIN_USER
    assert body["token"]
    assert "session" in resp.cookies
    assert resp.cookies["session"] == body["token"]


@pytest.mark.asyncio
async def test_login_wrong_password_401(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USER, "password": "wrong-password"},
    )
    assert resp.status_code == 401
    assert "token" not in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_username_401(client):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"username": "nobody", "password": ADMIN_PASS},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_does_not_reveal_which_field_failed(client):
    wrong_user = await client.post(
        "/api/v1/auth/login",
        json={"username": "nobody", "password": ADMIN_PASS},
    )
    wrong_pass = await client.post(
        "/api/v1/auth/login",
        json={"username": ADMIN_USER, "password": "wrong-password"},
    )
    assert wrong_user.status_code == wrong_pass.status_code == 401
    assert wrong_user.json() == wrong_pass.json()
    assert "username" not in wrong_user.text.lower()
    assert "password" not in wrong_user.text.lower()


@pytest.mark.asyncio
async def test_protected_endpoint_without_token_401(client):
    resp = await client.get("/api/v1/health/services")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_with_cookie_200(client):
    await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}
    )
    resp = await client.get("/api/v1/health/services")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_protected_endpoint_with_bearer_header_200(client):
    token = create_token(ADMIN_USER)
    resp = await client.get(
        "/api/v1/health/services", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_protected_endpoint_with_invalid_token_401(client):
    resp = await client.get(
        "/api/v1/health/services", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_with_expired_token_401(client):
    token = create_token(ADMIN_USER, expires_minutes=-1)
    resp = await client.get(
        "/api/v1/health/services", headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookie(client):
    login = await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}
    )
    assert login.status_code == 200
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Sesión cerrada"
    assert "session" not in resp.cookies or resp.cookies["session"] == ""


@pytest.mark.asyncio
async def test_logout_makes_protected_routes_401(client):
    await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}
    )
    await client.post("/api/v1/auth/logout")
    resp = await client.get("/api/v1/health/services")
    assert resp.status_code == 401


def test_verify_credentials_ok_and_wrong():
    assert verify_credentials(ADMIN_USER, ADMIN_PASS) is True
    assert verify_credentials("nobody", ADMIN_PASS) is False
    assert verify_credentials(ADMIN_USER, "nope") is False
    assert verify_credentials(None, None) is False


def test_verify_credentials_is_constant_time_function():
    assert auth_service.hmac.compare_digest is not None


def test_token_roundtrip_sub():
    payload = auth_service.decode_token(create_token(ADMIN_USER))
    assert payload["sub"] == ADMIN_USER
    assert "exp" in payload
    assert "iat" in payload


def test_decode_invalid_token_raises():
    with pytest.raises(InvalidTokenError):
        auth_service.decode_token("garbage.token.here")


@pytest.mark.asyncio
async def test_login_logs_no_credentials_or_tokens(client, caplog):
    with caplog.at_level(logging.INFO):
        ok = await client.post(
            "/api/v1/auth/login",
            json={"username": ADMIN_USER, "password": ADMIN_PASS},
        )
        bad = await client.post(
            "/api/v1/auth/login",
            json={"username": ADMIN_USER, "password": "wrong-password"},
        )
    assert ok.status_code == 200 and bad.status_code == 401
    token = ok.json()["token"]
    assert token not in caplog.text
    assert ADMIN_PASS not in caplog.text
    assert "wrong-password" not in caplog.text
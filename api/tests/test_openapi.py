"""OpenAPI contract test (task 4.8): every expected endpoint must be
documented in the generated schema."""

from app.main import app

EXPECTED_PATHS = [
    ("/api/v1/health", "get"),
    ("/api/v1/health/services", "get"),
    ("/api/v1/auth/login", "post"),
    ("/api/v1/auth/logout", "post"),
    ("/api/v1/overview", "get"),
    ("/api/v1/events", "get"),
    ("/api/v1/events/{event_id}", "get"),
    ("/api/v1/mitre", "get"),
    ("/api/v1/geo/countries", "get"),
    ("/api/v1/malware", "get"),
    ("/api/v1/iocs", "get"),
]


def test_openapi_lists_all_endpoints():
    schema = app.openapi()
    for path, method in EXPECTED_PATHS:
        assert method in schema["paths"].get(path, {}), f"missing {method.upper()} {path}"


def test_openapi_protected_endpoints_declare_401():
    schema = app.openapi()
    protected = [
        "/api/v1/overview",
        "/api/v1/events",
        "/api/v1/events/{event_id}",
        "/api/v1/mitre",
        "/api/v1/geo/countries",
        "/api/v1/malware",
        "/api/v1/iocs",
        "/api/v1/health/services",
    ]
    for path in protected:
        op = schema["paths"][path]["get"]
        assert "401" in op.get("responses", {}), f"{path} missing 401 response"


def test_openapi_auth_cookie_security_scheme():
    schema = app.openapi()
    schemes = schema.get("components", {}).get("securitySchemes", {})
    assert "SessionCookieAuth" in schemes
    assert schemes["SessionCookieAuth"]["in"] == "cookie"
    assert schemes["SessionCookieAuth"]["name"] == "session"


def test_openapi_public_health_has_no_security():
    schema = app.openapi()
    assert "security" not in schema["paths"]["/api/v1/health"]["get"]
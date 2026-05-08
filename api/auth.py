"""
Google OAuth + signed-cookie session.

Stateless: the user's OAuth credentials live in their cookie, signed with
SESSION_SECRET via itsdangerous. Server holds nothing between requests.

Requested scopes include OpenID/userinfo alongside webmasters.readonly so the
token response matches what Google returns (oauthlib rejects a broadened scope
set otherwise). API usage only needs webmasters.readonly.
"""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from itsdangerous import BadSignature, URLSafeTimedSerializer

from .settings import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/webmasters.readonly",
]


# ---- Cookie helpers ------------------------------------------------------


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().session_secret, salt="beacon.session")


def _set_session(response: Response, payload: dict) -> None:
    token = _serializer().dumps(payload)
    s = get_settings()
    response.set_cookie(
        s.session_cookie_name,
        token,
        max_age=s.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=False,  # set True behind HTTPS
        path="/",
    )


def _read_session(request: Request) -> Optional[dict]:
    s = get_settings()
    raw = request.cookies.get(s.session_cookie_name)
    if not raw:
        return None
    try:
        return _serializer().loads(raw, max_age=s.session_max_age_seconds)
    except BadSignature:
        return None


def credentials_from_request(request: Request) -> Credentials:
    """Build a refreshing Credentials object from the session cookie.

    Raises HTTPException(401) if not authenticated.
    """
    payload = _read_session(request)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")

    s = get_settings()
    creds = Credentials(
        token=payload.get("access_token"),
        refresh_token=payload.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=s.google_client_id,
        client_secret=s.google_client_secret,
        scopes=SCOPES,
    )
    if not creds.valid and creds.refresh_token:
        creds.refresh(GoogleRequest())
    return creds


# ---- OAuth flow ----------------------------------------------------------


def _build_flow() -> Flow:
    s = get_settings()
    return Flow.from_client_config(
        {
            "web": {
                "client_id": s.google_client_id,
                "client_secret": s.google_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [s.oauth_redirect_uri],
            }
        },
        scopes=SCOPES,
        redirect_uri=s.oauth_redirect_uri,
    )


@router.get("/google/login")
def login() -> RedirectResponse:
    flow = _build_flow()
    auth_url, _state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # ensures we always get a refresh_token
    )
    return RedirectResponse(auth_url)


@router.get("/google/callback")
def callback(request: Request) -> RedirectResponse:
    s = get_settings()
    flow = _build_flow()
    flow.fetch_token(authorization_response=str(request.url))
    creds = flow.credentials

    response = RedirectResponse(s.post_login_redirect)
    _set_session(
        response,
        {
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
        },
    )
    return response


@router.post("/logout")
def logout() -> Response:
    response = Response(status_code=204)
    response.delete_cookie(get_settings().session_cookie_name, path="/")
    return response


@router.get("/me")
def me(request: Request) -> dict:
    """Cheap auth check for the frontend. Returns 401 if not signed in."""
    payload = _read_session(request)
    if not payload:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"authenticated": True}

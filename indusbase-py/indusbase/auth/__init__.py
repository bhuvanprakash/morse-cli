"""
IndusBase authentication module.

Provides authentication and user management functionality.
"""

from indusbase.auth.client import AuthClient, AsyncAuthClient
from indusbase.auth.types import User, Session, AuthResponse, OAuthProvider

__all__ = [
    "AuthClient",
    "AsyncAuthClient",
    "User",
    "Session",
    "AuthResponse",
    "OAuthProvider",
]

"""
Authentication types for IndusBase.

Contains dataclasses for User, Session, and related authentication models.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Dict, Any


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


@dataclass
class User:
    """
    Represents an IndusBase user.
    
    Attributes:
        id: Unique user identifier (UUID)
        email: User's email address
        created_at: Timestamp when user was created
        updated_at: Timestamp when user was last updated
        email_confirmed_at: Timestamp when email was confirmed
        phone: User's phone number (if set)
        phone_confirmed_at: Timestamp when phone was confirmed
        last_sign_in_at: Timestamp of last sign-in
        app_metadata: Application-specific metadata
        user_metadata: User-specific metadata
        aud: Audience/role for the user
        role: User's role
    """
    id: str
    email: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    email_confirmed_at: Optional[datetime] = None
    phone: Optional[str] = None
    phone_confirmed_at: Optional[datetime] = None
    last_sign_in_at: Optional[datetime] = None
    app_metadata: Optional[Dict[str, Any]] = None
    user_metadata: Optional[Dict[str, Any]] = None
    aud: Optional[str] = None
    role: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "User":
        """
        Create a User from a dictionary.

        Args:
            data: Dictionary containing user data

        Returns:
            User: A User instance
        """
        return cls(
            id=str(data.get("id", "")),
            email=str(data.get("email", "")),
            created_at=_parse_dt(data.get("created_at")),
            updated_at=_parse_dt(data.get("updated_at")),
            email_confirmed_at=_parse_dt(data.get("email_confirmed_at")),
            phone=data.get("phone"),
            phone_confirmed_at=_parse_dt(data.get("phone_confirmed_at")),
            last_sign_in_at=_parse_dt(data.get("last_sign_in_at")),
            app_metadata=data.get("app_metadata"),
            user_metadata=data.get("user_metadata") or data.get("raw_user_meta_data"),
            aud=data.get("aud"),
            role=data.get("role"),
        )


@dataclass
class Session:
    """
    Represents an authenticated session.
    
    Attributes:
        access_token: JWT access token
        refresh_token: Token used to refresh the session
        expires_at: Timestamp when the session expires
        expires_in: Number of seconds until expiration
        token_type: Type of token (usually "bearer")
        user: The authenticated user
    """
    access_token: str
    refresh_token: str
    expires_at: int
    expires_in: int
    token_type: str
    user: User

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Session":
        """
        Create a Session from a dictionary.

        Args:
            data: Dictionary containing session data

        Returns:
            Session: A Session instance
        """
        user_data = data.get("user") or {}
        return cls(
            access_token=str(data.get("access_token", "")),
            refresh_token=str(data.get("refresh_token", "")),
            expires_at=int(data.get("expires_at", 0) or 0),
            expires_in=int(data.get("expires_in", 0) or 0),
            token_type=str(data.get("token_type", "bearer")),
            user=User.from_dict(user_data),
        )


@dataclass
class AuthResponse:
    """
    Response from authentication operations.
    
    Attributes:
        session: The session if authentication was successful
        user: The user if available
    """
    session: Optional[Session] = None
    user: Optional[User] = None


@dataclass
class OAuthProvider:
    """
    Represents an OAuth provider configuration.
    
    Attributes:
        provider: Provider name (google, github, apple, etc.)
        url: OAuth authorization URL
    """
    provider: str
    url: str

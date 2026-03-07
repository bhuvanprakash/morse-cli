/**
 * User metadata
 */
export interface UserMetadata {
    [key: string]: unknown;
}

/**
 * User identity from an OAuth provider
 */
export interface UserIdentity {
    id: string;
    user_id: string;
    identity_data?: Record<string, unknown>;
    provider: string;
    created_at?: string;
    last_sign_in_at?: string;
    updated_at?: string;
}

/**
 * User object returned by auth operations
 */
export interface User {
    id: string;
    email?: string;
    phone?: string;
    email_confirmed_at?: string;
    phone_confirmed_at?: string;
    last_sign_in_at?: string;
    created_at: string;
    updated_at?: string;
    app_metadata: Record<string, unknown>;
    user_metadata: UserMetadata;
    identities?: UserIdentity[];
    aud: string;
    role?: string;
    confirmation_sent_at?: string;
    confirmed_at?: string;
    recovery_sent_at?: string;
    email_change_sent_at?: string;
    new_email?: string;
    invited_at?: string;
    action_link?: string;
}

/**
 * Session containing tokens and user info
 */
export interface Session {
    access_token: string;
    token_type: string;
    expires_in: number;
    expires_at?: number;
    refresh_token: string;
    user: User;
}

/**
 * Auth response containing user and session
 */
export interface AuthResponse {
    user: User | null;
    session: Session | null;
}

/**
 * OAuth provider identifiers
 */
export type OAuthProvider =
    | 'google'
    | 'github'
    | 'gitlab'
    | 'bitbucket'
    | 'azure'
    | 'facebook'
    | 'twitter'
    | 'apple'
    | 'discord'
    | 'slack'
    | 'spotify'
    | 'twitch'
    | 'linkedin'
    | 'notion'
    | 'zoom'
    | 'workos'
    | string; // Allow custom providers

/**
 * Sign up options
 */
export interface SignUpOptions {
    email: string;
    password: string;
    phone?: string;
    data?: UserMetadata;
    captchaToken?: string;
}

/**
 * Sign in with password options
 */
export interface SignInWithPasswordOptions {
    email?: string;
    password?: string;
    phone?: string;
    captchaToken?: string;
}

/**
 * Sign in with OTP options
 */
export interface SignInWithOTPOptions {
    email?: string;
    phone?: string;
    options?: {
        emailRedirectTo?: string;
        shouldCreateUser?: boolean;
        captchaToken?: string;
    };
}

/**
 * Verify OTP options
 */
export interface VerifyOTPOptions {
    email?: string;
    phone?: string;
    token: string;
    type: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'phone_change';
}

/**
 * Sign in with OAuth options
 */
export interface SignInWithOAuthOptions {
    provider: OAuthProvider;
    options?: {
        redirectTo?: string;
        scopes?: string;
        queryParams?: Record<string, string>;
        skipBrowserRedirect?: boolean;
    };
}

/**
 * User update options
 */
export interface UserUpdateOptions {
    email?: string;
    phone?: string;
    password?: string;
    data?: UserMetadata;
    emailChangeToken?: string;
    nonce?: string;
}

/**
 * Auth state change event
 */
export type AuthChangeEvent =
    | 'SIGNED_IN'
    | 'SIGNED_OUT'
    | 'TOKEN_REFRESHED'
    | 'USER_UPDATED'
    | 'USER_DELETED'
    | 'PASSWORD_RECOVERY'
    | 'MFA_CHALLENGE_VERIFIED';

/**
 * Auth state change callback
 */
export type AuthStateChangeCallback = (event: AuthChangeEvent, session: Session | null) => void;

export type EnterpriseProviderType = 'saml' | 'oidc';

export interface EnterpriseConnectionConfig {
    // SAML
    sso_url?: string;
    entity_id?: string;
    acs_url?: string;
    certificate?: string;
    // OIDC
    issuer_url?: string;
    client_id?: string;
    client_secret?: string;
    auth_url?: string;
    token_url?: string;
    userinfo_url?: string;
    redirect_url?: string;
    scopes?: string;
}

export interface CreateEnterpriseConnectionOptions {
    org_id?: string;
    project_id?: string;
    name: string;
    slug: string;
    domain: string;
    provider_type: EnterpriseProviderType;
    provider_name: string;
    config: EnterpriseConnectionConfig;
}

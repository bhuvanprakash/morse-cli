// Main client
export { IndusBaseClient, createClient } from './client.js';
export type { IndusBaseClientOptions } from './client.js';

// Error classes
export {
    IndusBaseError,
    AuthError,
    QueryError,
    StorageError,
    RealtimeError,
    FunctionsError,
} from './lib/errors.js';

// Auth types
export type {
    User,
    UserMetadata,
    UserIdentity,
    Session,
    AuthResponse,
    OAuthProvider,
    SignUpOptions,
    SignInWithPasswordOptions,
    SignInWithOTPOptions,
    VerifyOTPOptions,
    SignInWithOAuthOptions,
    UserUpdateOptions,
    AuthChangeEvent,
    AuthStateChangeCallback,
    EnterpriseProviderType,
    EnterpriseConnectionConfig,
    CreateEnterpriseConnectionOptions,
} from './auth/types.js';

// Auth client
export { AuthClient } from './auth/auth-client.js';

// Query types
export type {
    QueryResult,
    SingleResult,
    CountResult,
    QueryErrorResult,
    FilterOperator,
    FilterValue,
    OrderDirection,
    OrderOptions,
    OrderNulls,
    RangeOptions,
    QueryFilter,
} from './query/types.js';

// Query builder
export { QueryBuilder } from './query/query-builder.js';

// Query client
export { QueryClient } from './query/query-client.js';
export type { InsertOptions, UpdateOptions, DeleteOptions } from './query/query-client.js';

// Realtime types
export type {
    ChangeEvent,
    ChangeEventType,
    ChannelState,
    ChannelConfig,
    RealtimeChannelOptions,
    RealtimeFilter,
    EventCallback,
    SubscriptionCallback,
    RealtimeMessage,
    RealtimeChannel,
} from './realtime/types.js';

// Channel
export { Channel } from './realtime/channel.js';

// Realtime client
export { RealtimeClient } from './realtime/realtime-client.js';
export type { RealtimeClientOptions } from './realtime/realtime-client.js';

// Storage types
export type {
    Bucket,
    StorageObject,
    SignedUrlResponse,
    FileOptions,
    UploadResponse,
    ListOptions,
    ListBucketResponse,
    MoveResponse,
    RemoveResponse,
    TransformOptions,
} from './storage/types.js';

// Bucket client
export { BucketClient } from './storage/bucket-client.js';

// Storage client
export { StorageClient } from './storage/storage-client.js';
export type { CreateBucketOptions } from './storage/storage-client.js';

// Functions types
export type { InvokeOptions, FunctionResponse, FunctionErrorResponse } from './functions/types.js';

// Functions client
export { FunctionsClient } from './functions/functions-client.js';

// Notify types
export type { SendPushOptions, SendSMSOptions, SendEmailOptions } from './notify/types.js';

// Notify client
export { NotifyClient } from './notify/notify-client.js';

// Config client
export { ConfigClient } from './config/config-client.js';

// Billing types
export type { BillingUsageSummary, InvoicePreview, CreateSubscriptionOptions } from './billing/types.js';

// Billing client
export { BillingClient } from './billing/billing-client.js';

// Lib exports
export type { FetchClientOptions, FetchImpl } from './lib/fetch.js';
export { FetchClient } from './lib/fetch.js';

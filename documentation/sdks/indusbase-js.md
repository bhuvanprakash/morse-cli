# indusbase-js - JavaScript/TypeScript SDK

> Official JavaScript client library for IndusBase

## Installation

```bash
npm install indusbase-js
```

```bash
yarn add indusbase-js
```

```bash
bun add indusbase-js
```

## Quick Start

```typescript
import { createClient } from 'indusbase-js';

// Initialize client
const client = createClient(
  'https://your-project.indusbase.io',
  'your-anon-key'
);

// Authentication
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword'
});

// Query data
const { data: todos } = await client.db
  .from('todos')
  .select('*')
  .eq('completed', false)
  .order('created_at', { ascending: false });

// Realtime subscriptions
const channel = client.realtime
  .channel('todos-channel')
  .on('INSERT', { schema: 'public', table: 'todos' }, (payload) => {
    console.log('New todo:', payload.new);
  })
  .subscribe();

// Upload files
const { data: uploadData } = await client.storage
  .from('avatars')
  .upload('user123.png', file);

// Invoke edge functions
const { data: result } = await client.functions.invoke('hello-world', {
  body: { name: 'IndusBase' }
});
```

## Authentication

### Sign Up

```typescript
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
  data: { name: 'John Doe' }
});
```

### Sign In

```typescript
const { data, error } = await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword'
});
```

### OAuth

```typescript
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://your-app.com/auth/callback'
  }
});
```

### Listen to Auth Changes

```typescript
client.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user);
  }
});
```

## Database Queries

### Select

```typescript
// All columns
const { data } = await client.db.from('todos').select('*');

// Specific columns
const { data } = await client.db
  .from('todos')
  .select('id, title, completed');

// With filters
const { data } = await client.db
  .from('todos')
  .select('*')
  .eq('completed', false)
  .gt('priority', 3);
```

### Insert

```typescript
const { data } = await client.db
  .from('todos')
  .insert({
    title: 'New task',
    completed: false
  });
```

### Update

```typescript
const { data } = await client.db
  .from('todos')
  .update({ completed: true })
  .eq('id', 123);
```

### Delete

```typescript
const { data } = await client.db
  .from('todos')
  .delete()
  .eq('id', 123);
```

### Filters

| Method | Description |
|--------|-------------|
| `.eq(column, value)` | Equals |
| `.neq(column, value)` | Not equals |
| `.gt(column, value)` | Greater than |
| `.gte(column, value)` | Greater or equal |
| `.lt(column, value)` | Less than |
| `.lte(column, value)` | Less or equal |
| `.like(column, pattern)` | LIKE pattern |
| `.ilike(column, pattern)` | ILIKE pattern |
| `.in(column, values)` | IN array |
| `.textSearch(column, query)` | Full-text search |

### Ordering & Pagination

```typescript
const { data } = await client.db
  .from('todos')
  .select('*')
  .order('created_at', { ascending: false })
  .range(0, 9);
```

## Realtime

```typescript
// Connect
await client.realtime.connect();

// Subscribe to changes
const channel = client.realtime
  .channel('db-changes')
  .on('INSERT', { schema: 'public', table: 'todos' }, (payload) => {
    console.log('New:', payload.new);
  })
  .on('UPDATE', { schema: 'public', table: 'todos' }, (payload) => {
    console.log('Old:', payload.old, 'New:', payload.new);
  })
  .on('DELETE', { schema: 'public', table: 'todos' }, (payload) => {
    console.log('Deleted:', payload.old);
  })
  .subscribe();
```

## Storage

### Upload

```typescript
const { data, error } = await client.storage
  .from('avatars')
  .upload('user_123.png', file, {
    cacheControl: '3600',
    upsert: true
  });
```

### Download

```typescript
const { data, error } = await client.storage
  .from('avatars')
  .download('user_123.png');
```

### Signed URL

```typescript
const { data, error } = await client.storage
  .from('private-files')
  .createSignedUrl('document.pdf', 60);
```

### List Files

```typescript
const { data, error } = await client.storage
  .from('uploads')
  .list('folder/', {
    limit: 100,
    offset: 0
  });
```

## Edge Functions

```typescript
// Invoke function
const { data } = await client.functions.invoke('hello-world', {
  body: { name: 'World' }
});

// GET request
const { data } = await client.functions.get('get-users');

// POST request
const { data } = await client.functions.post('create-user', {
  body: { name: 'New User' }
});
```

## TypeScript Support

```typescript
import { createClient, Database } from 'indusbase-js';

const client = createClient<Database>(
  'https://your-project.indusbase.io',
  'your-anon-key'
);

// Fully typed queries!
const { data } = await client.db
  .from('todos')
  .select('*');
// data is Todo[]
```

## Migration from Supabase

| Supabase | IndusBase |
|----------|-----------|
| `supabase.auth` | `client.auth` |
| `supabase.from()` | `client.db.from()` |
| `supabase.storage` | `client.storage` |
| `supabase.functions` | `client.functions` |
| `supabase.realtime` | `client.realtime` |

## License

MIT © [IndusBase](https://indusbase.io)

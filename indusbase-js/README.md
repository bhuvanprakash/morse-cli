# IndusBase JavaScript Client

[![npm version](https://img.shields.io/npm/v/indusbase-js.svg)](https://www.npmjs.com/package/indusbase-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The official JavaScript client library for [IndusBase](https://indusbase.io) — India's Postgres-native Backend-as-a-Service.

IndusBase provides a complete backend solution with authentication, auto-generated REST APIs, real-time subscriptions, file storage, and edge functions — all built on PostgreSQL.

## Features

- 🔐 **Authentication** - Email/password, magic links, OAuth providers (Google, GitHub, etc.), JWT tokens
- 🗄️ **Database** - Auto-generated REST API from your Postgres schema, TypeScript support
- ⚡ **Realtime** - Subscribe to database changes via WebSockets
- 📁 **Storage** - File uploads, downloads, signed URLs, image transformations
- 🚀 **Edge Functions** - Deploy and invoke serverless functions
- 📱 **Universal** - Works in browsers, Node.js, React Native, and edge runtimes
- 🔒 **Type-safe** - Full TypeScript support with generated types

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

### Sign Up with Email/Password

```typescript
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
  data: { name: 'John Doe' } // optional metadata
});
```

### Sign In with Password

```typescript
const { data, error } = await client.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword'
});
```

### Sign In with OAuth

```typescript
const { data, error } = await client.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://your-app.com/auth/callback'
  }
});
```

### Listen to Auth State Changes

```typescript
client.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user);
  } else if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  }
});
```

### Get Current User

```typescript
const { data: { user } } = await client.auth.getUser();
```

### Sign Out

```typescript
await client.auth.signOut();
```

## Database Queries

### Select Data

```typescript
// Select all columns
const { data } = await client.db
  .from('todos')
  .select('*');

// Select specific columns
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

### Insert Data

```typescript
const { data } = await client.db
  .from('todos')
  .insert({
    title: 'New task',
    completed: false,
    user_id: user.id
  });

// Insert multiple
const { data } = await client.db
  .from('todos')
  .insert([
    { title: 'Task 1' },
    { title: 'Task 2' }
  ]);
```

### Update Data

```typescript
const { data } = await client.db
  .from('todos')
  .update({ completed: true })
  .eq('id', 123);
```

### Delete Data

```typescript
const { data } = await client.db
  .from('todos')
  .delete()
  .eq('id', 123);
```

### Advanced Filters

```typescript
// Text search
const { data } = await client.db
  .from('posts')
  .select('*')
  .textSearch('content', 'indusbase', { type: 'websearch' });

// Range queries
const { data } = await client.db
  .from('products')
  .select('*')
  .gte('price', 10)
  .lte('price', 100);

// Pattern matching
const { data } = await client.db
  .from('users')
  .select('*')
  .ilike('email', '%@example.com');

// Array contains
const { data } = await client.db
  .from('posts')
  .select('*')
  .contains('tags', ['typescript', 'postgres']);
```

### Ordering & Pagination

```typescript
const { data } = await client.db
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .range(0, 9); // First 10 results
```

### Single Row

```typescript
const { data } = await client.db
  .from('users')
  .select('*')
  .eq('id', userId)
  .single(); // Returns single object or null
```

### Count

```typescript
const { count } = await client.db
  .from('todos')
  .select('*', { count: 'exact', head: true });
```

### RPC (Stored Procedures)

```typescript
const { data } = await client.db.rpc('get_nearby_stores', {
  lat: 12.9716,
  long: 77.5946
});
```

## Realtime Subscriptions

```typescript
// Connect to realtime
await client.realtime.connect();

// Create a channel
const channel = client.realtime.channel('db-changes');

// Listen to INSERT events
channel
  .on('INSERT', { schema: 'public', table: 'todos' }, (payload) => {
    console.log('New record:', payload.new);
  })
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed to changes');
    }
  });

// Listen to all changes
channel
  .on('*', { schema: 'public', table: 'todos' }, (payload) => {
    console.log('Change type:', payload.eventType);
    console.log('New:', payload.new);
    console.log('Old:', payload.old);
  })
  .subscribe();

// Unsubscribe
await channel.unsubscribe();

// Remove channel
await client.realtime.removeChannel(channel);
```

## File Storage

### Upload Files

```typescript
const file = document.getElementById('file').files[0];

const { data, error } = await client.storage
  .from('avatars')
  .upload(`user_${userId}.png`, file, {
    cacheControl: '3600',
    upsert: true
  });
```

### Download Files

```typescript
const { data, error } = await client.storage
  .from('avatars')
  .download('user_123.png');

// data is a Blob
const url = URL.createObjectURL(data);
```

### Public URLs

```typescript
const { data } = client.storage
  .from('avatars')
  .getPublicUrl('user_123.png');

// data.publicUrl contains the URL
```

### Signed URLs

```typescript
const { data, error } = await client.storage
  .from('private-files')
  .createSignedUrl('document.pdf', 60); // Expires in 60 seconds

// data.signedUrl contains the temporary URL
```

### List Files

```typescript
const { data, error } = await client.storage
  .from('uploads')
  .list('folder/subfolder', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  });
```

### Delete Files

```typescript
const { data, error } = await client.storage
  .from('avatars')
  .remove(['user_123.png', 'user_124.png']);
```

### Image Transformations

```typescript
const { data } = client.storage
  .from('photos')
  .getPublicUrl('photo.jpg', {
    transform: {
      width: 300,
      height: 300,
      resize: 'cover',
      format: 'webp',
      quality: 80
    }
  });
```

## Edge Functions

### Invoke a Function

```typescript
// POST request (default)
const { data, error } = await client.functions.invoke('hello-world', {
  body: { name: 'IndusBase' }
});

// GET request
const { data } = await client.functions.invoke('get-users', {
  method: 'GET',
  query: { limit: '10' }
});

// With custom headers
const { data } = await client.functions.invoke('process-data', {
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

### Shorthand Methods

```typescript
// GET
const { data } = await client.functions.get('list-items');

// POST
const { data } = await client.functions.post('create-item', {
  body: { name: 'New Item' }
});

// PUT/PATCH/DELETE
const { data } = await client.functions.put('update-item', { body: updates });
const { data } = await client.functions.delete('remove-item');
```

## TypeScript Support

IndusBase-js is built with TypeScript and provides full type safety.

### Using Database Types

```typescript
import { createClient } from 'indusbase-js';

interface Database {
  public: {
    Tables: {
      todos: {
        Row: {
          id: number;
          title: string;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          title: string;
          completed?: boolean;
        };
        Update: {
          title?: string;
          completed?: boolean;
        };
      };
    };
  };
}

const client = createClient<Database>(url, key);

// Now all queries are fully typed!
const { data } = await client.db
  .from('todos')
  .select('*');
// data is Todo[]
```

### Generating Types

Use the IndusBase CLI to generate types from your database schema:

```bash
npx indusbase types --project-id your-project > database.types.ts
```

## Migration from Supabase

IndusBase-js is API-compatible with `@supabase/supabase-js` for easy migration:

### Import Change

```typescript
// Before (Supabase)
import { createClient } from '@supabase/supabase-js';

// After (IndusBase)
import { createClient } from 'indusbase-js';
```

### Client Creation

```typescript
// Works the same way
const client = createClient(url, anonKey);
```

### API Compatibility

All major APIs are compatible:

| Supabase | IndusBase |
|----------|-----------|
| `supabase.auth` | `client.auth` |
| `supabase.from()` | `client.db.from()` |
| `supabase.storage` | `client.storage` |
| `supabase.functions` | `client.functions` |
| `supabase.realtime` | `client.realtime` |
| `supabase.rpc()` | `client.db.rpc()` |

> Note: IndusBase uses `client.db` instead of `client` directly for database operations to provide clearer separation of concerns.

## Error Handling

```typescript
import { AuthError, QueryError, StorageError } from 'indusbase-js';

try {
  const { data, error } = await client.auth.signInWithPassword({
    email: 'user@example.com',
    password: 'wrong-password'
  });
  
  if (error) {
    console.error('Auth error:', error.message);
    return;
  }
  
  console.log('Signed in:', data.user);
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Auth error code:', error.code);
  }
}
```

## Advanced Configuration

```typescript
const client = createClient(url, anonKey, {
  // Disable session persistence (useful for SSR)
  persistSession: false,
  
  // Custom fetch implementation (for React Native, Node.js, etc.)
  fetch: customFetch,
  
  // Custom realtime URL
  realtime: {
    url: 'wss://custom-realtime.indusbase.io'
  }
});
```

## React/Vue/Svelte Integration

```typescript
// React example with context
import { createContext, useContext, useEffect, useState } from 'react';
import { createClient, IndusBaseClient } from 'indusbase-js';

const IndusBaseContext = createContext<IndusBaseClient | null>(null);

export function IndusBaseProvider({ children }) {
  const [client] = useState(() => createClient(url, anonKey));
  
  return (
    <IndusBaseContext.Provider value={client}>
      {children}
    </IndusBaseContext.Provider>
  );
}

export function useIndusBase() {
  return useContext(IndusBaseContext);
}
```

## Node.js Usage

```typescript
import { createClient } from 'indusbase-js';
import fetch from 'node-fetch'; // or native fetch in Node 18+

const client = createClient(url, anonKey, {
  fetch: fetch as typeof globalThis.fetch
});
```

## License

MIT © [IndusBase](https://indusbase.io)

## Support

- 📚 [Documentation](https://docs.indusbase.io)
- 💬 [Discord Community](https://discord.gg/indusbase)
- 🐛 [GitHub Issues](https://github.com/indusbase/indusbase-js/issues)

---

Built with ❤️ in India 🇮🇳

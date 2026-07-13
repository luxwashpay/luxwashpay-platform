import { createBrowserClient } from "@supabase/ssr";

const missingSupabaseConfig =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createNoopClient() {
  const noopQuery = {
    select: () => noopQuery,
    eq: () => noopQuery,
    neq: () => noopQuery,
    gt: () => noopQuery,
    gte: () => noopQuery,
    lt: () => noopQuery,
    lte: () => noopQuery,
    like: () => noopQuery,
    ilike: () => noopQuery,
    in: () => noopQuery,
    order: () => noopQuery,
    limit: () => noopQuery,
    range: () => noopQuery,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    insert: () => noopQuery,
    update: () => noopQuery,
    upsert: () => noopQuery,
    delete: () => noopQuery,
    then: (resolve: (value: { data: null; error: null }) => void) =>
      Promise.resolve(resolve({ data: null, error: null })),
  };

  return {
    from: () => noopQuery,
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: null, error: null }),
      signUp: async () => ({ data: null, error: null }),
      resetPasswordForEmail: async () => ({ data: null, error: null }),
    },
  } as any;
}

export function createClient() {
  if (missingSupabaseConfig) {
    return createNoopClient();
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
    },
  } as any;
}

export async function createServerSupabaseClient() {
  if (missingSupabaseConfig) {
    return createNoopClient();
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — can't set cookies
          }
        },
      },
    }
  );
}

export async function createServiceRoleClient() {
  if (missingSupabaseConfig || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createNoopClient();
  }

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

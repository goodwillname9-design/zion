import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export async function ensureAnonymousUser() {
  if (!supabase) throw new Error("Add the Supabase URL and publishable key to .env.local.");
  const { data: current } = await supabase.auth.getSession();
  if (current.session?.user) return current.session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error(error?.message || "Anonymous sign-in failed.");
  return data.user;
}

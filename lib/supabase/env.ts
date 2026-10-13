function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export function getSupabasePublicEnv() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!url || !key) return null;
  return { url, key };
}

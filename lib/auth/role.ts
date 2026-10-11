import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "practitioner" | "client" | "anonymous";

export type Viewer =
  | { role: "anonymous"; userId: null; email: null; clientId: null }
  | { role: "practitioner"; userId: string; email: string; clientId: null }
  | { role: "client"; userId: string; email: string; clientId: string }
  /** Signed up as a client but no clients row carries this email yet. */
  | { role: "unlinked"; userId: string; email: string; clientId: null };

/**
 * Resolve who is signed in. A user bound to a clients row is a client;
 * any other signed-in user is treated as a practitioner.
 */
export async function resolveViewer(supabase: SupabaseClient): Promise<Viewer> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { role: "anonymous", userId: null, email: null, clientId: null };
  const userId = String(claims.sub);
  const email = String(claims.email ?? "");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (client?.id) return { role: "client", userId, email, clientId: String(client.id) };

  // First login for a client who signed up via /join: bind by email.
  if (claims.user_metadata && (claims.user_metadata as { role?: string }).role === "client") {
    const { data: claimed } = await supabase.rpc("claim_client_profile");
    if (claimed) return { role: "client", userId, email, clientId: String(claimed) };
    return { role: "unlinked", userId, email, clientId: null };
  }

  return { role: "practitioner", userId, email, clientId: null };
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveViewer } from "@/lib/auth/role";

export async function requireClientPage() {
  const supabase = await createClient();
  const viewer = await resolveViewer(supabase);
  if (viewer.role === "anonymous") redirect("/join");
  if (viewer.role === "unlinked") redirect("/join?unlinked=1");
  if (viewer.role === "practitioner") redirect("/");
  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, email, practitioner_id")
    .eq("id", viewer.clientId)
    .single();
  if (!client) redirect("/join");
  return { supabase, viewer, client };
}

/** The program the client should be working from: newest sent/active. */
export async function currentProgram(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("client_id", clientId)
    .in("status", ["sent", "active"])
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

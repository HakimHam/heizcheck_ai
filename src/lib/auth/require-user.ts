import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** A Supabase client for the signed-in user; sends visitors who aren't signed in to /anmelden. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/anmelden");
  return supabase;
}

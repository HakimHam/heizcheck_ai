import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

/** The signed-in shell's header: the Organisation's name and sign-out. */
export async function AppHeader() {
  const supabase = await createClient();
  // Row-level security returns only the user's own Organisation.
  const { data: organisation } = await supabase.from("organisations").select("name").single<{ name: string }>();

  return (
    <header className="mb-8 flex items-center justify-between gap-4">
      <div>
        <Link href="/" className="text-lg font-semibold">
          HeizCheck
        </Link>
        {organisation && <p className="text-sm text-stone-600">{organisation.name}</p>}
      </div>
      <form action={signOut}>
        <button type="submit" className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm">
          Abmelden
        </button>
      </form>
    </header>
  );
}

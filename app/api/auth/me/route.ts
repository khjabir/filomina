import { getValidSession } from "@/lib/google-oauth";
import { json } from "@/lib/http";

export async function GET() {
  const session = await getValidSession();
  return json({ user: session?.user ?? null });
}

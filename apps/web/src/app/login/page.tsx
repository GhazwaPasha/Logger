import { LoginForm } from "./LoginForm";
import { safeReturnPath } from "@/lib/safe-return-path";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeReturnPath(rawNext);

  return <LoginForm next={next} />;
}

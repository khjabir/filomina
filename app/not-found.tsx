import { Header } from "@/components/Header";
import { LinkButton } from "@/components/ui/Button";
import { Mark } from "@/components/brand/Mark";

export default function NotFound() {
  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-20 text-center">
        <Mark state="error" size={64} />
        <h1 className="text-2xl font-semibold tracking-tight">I couldn&apos;t find that page</h1>
        <p className="max-w-sm text-muted">The link may be broken or the page may have moved.</p>
        <LinkButton href="/">Back home</LinkButton>
      </div>
    </>
  );
}

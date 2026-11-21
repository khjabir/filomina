import { clsx } from "clsx";

/** The Filomina mark: a photo tile with a lens-magnifier (SVG, works on any background). */
export function LogoIcon({ size = 32, className, priority }: { size?: number; className?: string; priority?: boolean }) {
  return <img src="/brand/logo-icon.svg" width={size} height={size} alt="" aria-hidden className={clsx("select-none", className)} draggable={false} loading={priority ? "eager" : "lazy"} />;
}

/** The wordmark, set in the display font so it stays crisp and follows the theme. */
export function Wordmark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span className={clsx("font-display inline-block select-none font-extrabold leading-none tracking-tight text-ink", className)} style={{ fontSize: size }}>
      <span className="text-brand">F</span>ilomina
    </span>
  );
}

/** Icon + wordmark, as used in headers. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoIcon size={size} priority />
      <Wordmark size={Math.round(size * 0.68)} />
    </span>
  );
}

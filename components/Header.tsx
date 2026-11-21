"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ChevronDown, FolderOpen, Info, Link2, LogIn, LogOut, MonitorSmartphone, ScrollText, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { useDrive } from "@/components/providers/DriveProvider";
import { useConsent } from "@/components/providers/ConsentProvider";
import { ConnectFolderDialog } from "@/components/drive/ConnectFolder";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/providers/ThemeProvider";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "Filomina";

export function Header() {
  const { status, rootName, user, connected, signInHref, signOut } = useDrive();
  const { openSheet } = useConsent();
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [connect, setConnect] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label={`${appName} home`}>
          <Logo size={32} />
        </Link>

        {connected && rootName && (
          <Link href="/browse" className="hidden min-w-0 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm text-muted hover:text-ink sm:flex">
            <FolderOpen className="size-4 shrink-0 text-accent" />
            <span className="max-w-[18rem] truncate">{rootName}</span>
          </Link>
        )}

        <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 text-sm hover:bg-surface-2"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            {user?.picture ? (
              <img src={user.picture} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "•"}
              </span>
            )}
            <span className="hidden max-w-[10rem] truncate sm:inline">{user ? user.name || user.email : "Menu"}</span>
            <ChevronDown className="size-4 text-muted" />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                className="card absolute right-0 mt-2 w-64 overflow-hidden p-1.5 text-sm shadow-pop"
              >
                {user && (
                  <div className="px-3 py-2">
                    <p className="truncate font-medium">{user.name || user.email}</p>
                    {user.name && <p className="truncate text-xs text-muted">{user.email}</p>}
                  </div>
                )}
                {rootName && (
                  <div className="flex items-center gap-2 px-3 py-2 text-muted sm:hidden">
                    <FolderOpen className="size-4 text-accent" />
                    <span className="truncate">{rootName}</span>
                  </div>
                )}
                <MenuItem
                  icon={<Link2 className="size-4" />}
                  onClick={() => {
                    setOpen(false);
                    setConnect(true);
                  }}
                >
                  Connect a different folder
                </MenuItem>
                <MenuItem
                  icon={<ShieldCheck className="size-4" />}
                  onClick={() => {
                    setOpen(false);
                    openSheet();
                  }}
                >
                  Cookie &amp; privacy choices
                </MenuItem>
                <Link href="/privacy" role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setOpen(false)}>
                  <ScrollText className="size-4" />
                  Privacy policy
                </Link>
                <Link href="/about" role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setOpen(false)}>
                  <Info className="size-4" />
                  About {appName}
                </Link>
                {mode !== "system" && (
                  <MenuItem
                    icon={<MonitorSmartphone className="size-4" />}
                    onClick={() => {
                      setOpen(false);
                      setMode("system");
                    }}
                  >
                    Follow system theme
                  </MenuItem>
                )}
                <div className="my-1 h-px bg-line" />
                {user ? (
                  <MenuItem
                    icon={<LogOut className="size-4" />}
                    onClick={async () => {
                      setOpen(false);
                      await signOut();
                    }}
                  >
                    Sign out
                  </MenuItem>
                ) : status?.oauthConfigured ? (
                  <a href={signInHref()} role="menuitem" className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted hover:bg-surface-2 hover:text-ink">
                    <LogIn className="size-4" />
                    Sign in with Google
                  </a>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>
      <ConnectFolderDialog open={connect} onClose={() => setConnect(false)} />
    </header>
  );
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-muted hover:bg-surface-2 hover:text-ink">
      {icon}
      {children}
    </button>
  );
}

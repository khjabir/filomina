"use client";

import { AnimatePresence, motion, type Variants } from "motion/react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  Cloud,
  Database,
  FolderOpen,
  Link2,
  Lock,
  ScanFace,
  Server,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { LogoIcon, Wordmark } from "@/components/brand/Logo";
import { Mark } from "@/components/brand/Mark";
import { buttonClasses } from "@/components/ui/Button";
import { MarketingNav } from "./MarketingNav";

const reveal: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } }),
};

function Section({ id, eyebrow, title, text, children, className = "" }: { id?: string; eyebrow: string; title: ReactNode; text?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 ${className}`}>
      <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="mx-auto max-w-2xl text-center">
        <p className="text-brand text-xs font-bold uppercase tracking-[0.2em]">{eyebrow}</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
        {text && <p className="mt-4 text-base text-muted sm:text-lg">{text}</p>}
      </motion.div>
      <div className="mt-10 sm:mt-14">{children}</div>
    </section>
  );
}

export function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Events />
        <Privacy />
        <Faq />
        <Cta />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <span className="flex items-center gap-2">
            <LogoIcon size={22} /> <Wordmark size={14} /> <span className="text-faint">· AI photo finder</span>
          </span>
          <nav className="flex flex-wrap gap-4">
            <Link href="/" className="hover:text-ink">
              Open the app
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ── hero ──────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="hero-wash relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pb-24 sm:pt-20 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-card">
            <Sparkles className="size-3.5 text-magenta" /> Face search for shared Google Drive folders
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Selfie in. <span className="text-brand">Your photos</span> out.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mx-auto mt-5 max-w-xl text-lg text-muted lg:mx-0">
            Filomina looks through every folder of a shared Google Drive and finds the photos a person appears in. Take a selfie, pick your face, and the results arrive in seconds, even for thousands of photos.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Link href="/" className={buttonClasses("primary", "xl")}>
              Open Filomina <ArrowRight className="size-4" />
            </Link>
            <a href="#how" className={buttonClasses("secondary", "xl")}>
              See how it works
            </a>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-faint lg:justify-start">
            <span className="flex items-center gap-1.5">
              <Server className="size-3.5" /> Runs on your own server
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Nothing sent to third-party AI
            </span>
          </motion.p>
        </div>
        <HeroArt />
      </div>
    </section>
  );
}

/** The logo's stacked cards, animated: photos drift in, the lens finds the match. */
function HeroArt() {
  const tiles = [
    { x: -120, y: -40, r: -14, g: "linear-gradient(135deg,#9cc8ff,#6c9dff)", d: 0 },
    { x: 110, y: -70, r: 12, g: "linear-gradient(135deg,#ff9a3c,#ff5fa2)", d: 0.1 },
    { x: 130, y: 60, r: -6, g: "linear-gradient(135deg,#b23fe0,#6c4dff)", d: 0.2 },
    { x: -110, y: 80, r: 10, g: "linear-gradient(135deg,#2f7cff,#5fd0ff)", d: 0.3 },
  ];
  return (
    <div className="relative mx-auto h-[340px] w-full max-w-md sm:h-[420px]">
      {tiles.map((t, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-28 w-24 rounded-2xl shadow-pop sm:h-36 sm:w-32"
          style={{ background: t.g, marginLeft: -48, marginTop: -56 }}
          initial={{ opacity: 0, x: t.x * 2, y: t.y * 2, rotate: t.r * 2 }}
          animate={{ opacity: 1, x: t.x, y: t.y, rotate: t.r }}
          transition={{ delay: 0.2 + t.d, type: "spring", stiffness: 80, damping: 14 }}
        >
          <motion.span
            className="absolute left-3 top-3 size-6 rounded-full bg-white/70"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2.4, delay: i * 0.3, repeat: Infinity }}
          />
          <span className="absolute bottom-3 left-3 right-3 h-2 rounded-full bg-white/40" />
        </motion.div>
      ))}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 120, damping: 14 }}
      >
        <div className="animate-float">
          <Mark state="scanning" size={180} />
        </div>
      </motion.div>
      <motion.div
        className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium shadow-pop"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
      >
        <span className="grid size-5 place-items-center rounded-full bg-success text-white">
          <ScanFace className="size-3" />
        </span>
        3 photos of you found · 97% match
      </motion.div>
    </div>
  );
}

/* ── features ──────────────────────────────────────────────────────── */

function Features() {
  const items = [
    { icon: <UserRound className="size-5" />, title: "Find me in seconds", text: "Take a selfie or upload a photo. Filomina matches your face across every nested folder and shows the results sorted by confidence." },
    { icon: <Link2 className="size-5" />, title: "One link per event", text: "Organisers attach a Drive folder to an event, index it once, and share a private link. Guests search instantly, no account needed." },
    { icon: <Cloud className="size-5" />, title: "Works with Google Drive", text: "Public folders open without sign-in. Private folders use Google sign-in with read-only access. Nothing in your Drive is ever changed." },
    { icon: <ShieldCheck className="size-5" />, title: "Private by design", text: "Face matching runs on your own server with open models. Every search is audit-logged, and nothing is sent to third-party AI services." },
    { icon: <Zap className="size-5" />, title: "Fast on thousands of photos", text: "Photos are indexed in the background; a search compares your face with the index in milliseconds, then only new photos are analysed." },
    { icon: <Camera className="size-5" />, title: "Built for phones", text: "Front camera selfies, mirrored-photo handling, multiple reference photos for tricky angles, and a layout that fits any screen." },
  ];
  return (
    <Section id="features" eyebrow="Features" title={<>Everything you need to <span className="text-brand">find people in photos</span></>} text="Designed for weddings, school events, team offsites, family archives and any shared album that has grown too big to scroll.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f, i) => (
          <motion.div key={f.title} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} whileHover={{ y: -4 }} className="card p-6">
            <span className="brand-gradient glow-brand grid size-11 place-items-center rounded-xl text-white">{f.icon}</span>
            <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ── how it works ──────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    { n: 1, title: "Connect a folder", text: "Paste a Google Drive folder link. Filomina reads every sub-folder and starts preparing the photos.", art: <ArtConnect /> },
    { n: 2, title: "Take a selfie", text: "Use your phone's camera or upload a photo. Pick your face if there are several people in it.", art: <ArtSelfie /> },
    { n: 3, title: "Get your photos", text: "Matches appear live with a confidence score. Open them in Drive or download the ones you love.", art: <ArtResults /> },
  ];
  return (
    <Section id="how" eyebrow="How it works" title="Three steps, no manual" className="bg-surface-2/60 rounded-[2rem]">
      <div className="grid gap-6 lg:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div key={s.n} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="card overflow-hidden">
            <div className="relative h-44 overflow-hidden border-b border-line bg-surface-2">{s.art}</div>
            <div className="p-6">
              <span className="brand-gradient inline-grid size-8 place-items-center rounded-full text-sm font-bold text-white">{s.n}</span>
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

function ArtConnect() {
  const folders = ["Wedding 2025", "Day 1", "Day 2", "Reception"];
  return (
    <div className="absolute inset-0 p-5">
      {folders.map((f, i) => (
        <motion.div
          key={f}
          className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs shadow-card"
          style={{ marginLeft: i ? 16 : 0, width: `${80 - i * 8}%` }}
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.15 }}
        >
          <FolderOpen className="size-3.5 text-accent" /> {f}
          <span className="ml-auto text-faint">{[412, 120, 164, 128][i]}</span>
        </motion.div>
      ))}
    </div>
  );
}

function ArtSelfie() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative h-36 w-28 overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#1b1b4f,#3b6cff)]">
        <motion.div className="absolute left-1/2 top-1/2 h-[70%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-dashed border-white/80" animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 2, repeat: Infinity }} />
        <div className="absolute left-1/2 top-[36%] size-9 -translate-x-1/2 rounded-full bg-white/80" />
        <div className="absolute left-1/2 top-[62%] h-10 w-16 -translate-x-1/2 rounded-t-full bg-white/70" />
        <span className="scanline" />
        <motion.span className="absolute left-2 top-2 rounded-md bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white" initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.8 }}>
          face found
        </motion.span>
      </div>
    </div>
  );
}

function ArtResults() {
  const tiles = ["#2f7cff", "#6c4dff", "#e84393", "#ff9a3c", "#5fd0ff", "#b23fe0"];
  return (
    <div className="absolute inset-0 grid grid-cols-3 gap-2 p-5">
      {tiles.map((c, i) => (
        <motion.div
          key={i}
          className="relative rounded-lg"
          style={{ background: `linear-gradient(135deg, ${c}, ${tiles[(i + 2) % tiles.length]})`, opacity: 0.9 }}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 200, damping: 16 }}
        >
          <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[10px] font-semibold text-white">{[97, 94, 91, 88, 82, 76][i]}%</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ── events ────────────────────────────────────────────────────────── */

function Events() {
  return (
    <Section id="events" eyebrow="For organisers" title={<>Share one link. <span className="text-brand-warm">Everyone finds themselves.</span></>} text="Perfect for photographers, event teams and schools: prepare the album once, then let hundreds of guests search at the same time.">
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <motion.ul variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-4">
          {[
            ["Create an event", "Give it a name and paste the Drive folder. Private folders are linked through the organiser's Google account; guests never sign in."],
            ["Index once", "Filomina analyses every photo in the background and keeps the face index up to date when new photos arrive."],
            ["Share the link", "Each event has a private, unguessable address. Pause it any time, or delete it when the event is over."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="brand-gradient mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-bold">{t}</p>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </div>
            </li>
          ))}
        </motion.ul>
        <motion.div variants={reveal} custom={1} initial="hidden" whileInView="show" viewport={{ once: true }} className="card p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
              <Users className="size-5" />
            </span>
            <div>
              <p className="font-bold">Anna &amp; Tom&apos;s wedding</p>
              <p className="text-xs text-muted">2,140 photos · 6,380 faces indexed · ready</p>
            </div>
            <span className="ml-auto rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">ready</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div className="brand-gradient h-full rounded-full" initial={{ width: "0%" }} whileInView={{ width: "100%" }} viewport={{ once: true }} transition={{ duration: 1.6, ease: "easeOut" }} />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs">
            <Link2 className="size-3.5 text-accent" />
            <span className="truncate">https://photos.example.com/e/k7m2x9pq4wvn</span>
            <span className="ml-auto rounded-md bg-surface px-2 py-0.5 font-medium shadow-card">Copy</span>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

/* ── privacy ───────────────────────────────────────────────────────── */

function Privacy() {
  const items = [
    { icon: <Server className="size-5" />, title: "Your server, your data", text: "Face detection and recognition run on the machine you host Filomina on, with open models. No photo or face template leaves it." },
    { icon: <Database className="size-5" />, title: "Audit trail", text: "Each search stores the reference photo and who searched, so misuse can be investigated. Entries expire automatically." },
    { icon: <Lock className="size-5" />, title: "Read-only Drive access", text: "Filomina lists folders and reads photos. It never uploads, edits, moves or deletes anything in Google Drive." },
  ];
  return (
    <Section eyebrow="Privacy" title="Face search, done responsibly" text="People are told what is stored before they search, and organisers keep full control.">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((f, i) => (
          <motion.div key={f.title} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }} className="card p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">{f.icon}</span>
            <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
          </motion.div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Read the full{" "}
        <Link href="/privacy" className="font-medium text-accent underline decoration-dotted underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </Section>
  );
}

/* ── faq ───────────────────────────────────────────────────────────── */

function Faq() {
  const qs = [
    ["Does it work with private Drive folders?", "Yes. Sign in with Google and Filomina reads the folder with your account (read-only). For events, the organiser links the folder once and guests do not need to sign in."],
    ["How accurate is it?", "Filomina uses ArcFace, a state-of-the-art face recognition model, with a detector that also finds small faces in group photos. Mirrored selfies are handled, and you can add a second photo from another angle to improve matching further."],
    ["How long does a search take?", "After a folder is indexed, a search takes a second or two regardless of its size. The first indexing of a large folder runs in the background and shows its progress."],
    ["What happens to my selfie?", "It is stored with your search in an audit log on the server for a limited time, so the operator can investigate misuse. It is never sent to a third-party service."],
    ["Can I run it myself?", "Yes. Filomina is a Next.js app that runs on any Node.js host or in Docker, with a free cloud VM being enough for most albums."],
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered">
      <div className="mx-auto max-w-2xl space-y-2">
        {qs.map(([q, a], i) => (
          <motion.div key={q} custom={i} variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }} className="card overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold" aria-expanded={open === i}>
              {q}
              <motion.span animate={{ rotate: open === i ? 180 : 0 }} className="shrink-0 text-faint">
                <ChevronDown className="size-5" />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ── cta ───────────────────────────────────────────────────────────── */

function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <motion.div variants={reveal} initial="hidden" whileInView="show" viewport={{ once: true }} className="brand-gradient-animated relative overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white sm:px-12">
        <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <LogoIcon size={72} />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to find yourself?</h2>
          <p className="mt-3 text-white/85">Open the app, connect a folder, and take a selfie. The rest is Filomina&apos;s job.</p>
          <Link href="/" className="mt-7 inline-flex h-13 items-center gap-2 rounded-xl bg-white px-7 text-base font-semibold text-ink shadow-pop transition hover:bg-white/90">
            Open Filomina <ArrowRight className="size-4" />
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

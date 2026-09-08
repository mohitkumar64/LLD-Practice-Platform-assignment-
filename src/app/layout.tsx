import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Schematic — LLD practice, reviewed like a design review",
  description:
    "Practice low-level design problems with structured submissions and explainable, senior-engineer-style feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-line bg-ink/85 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-3">
              {/* Drafting-mark logo: square + diagonal, like a plotter registration mark. */}
              <span className="grid size-6 place-items-center border border-amber/70">
                <span className="block size-2 translate-x-[3px] translate-y-[3px] bg-amber transition-transform duration-200 group-hover:translate-x-0 group-hover:translate-y-0" />
              </span>
              <span className="font-mono text-sm font-semibold tracking-[0.18em] text-paper">
                SCHEMATIC
              </span>
            </Link>
            <nav className="flex items-center gap-6 font-mono text-xs tracking-[0.14em] uppercase">
              <Link
                href="/"
                className="text-muted transition-colors hover:text-paper"
              >
                Problems
              </Link>
              <Link
                href="/attempts"
                className="text-muted transition-colors hover:text-paper"
              >
                History
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">{children}</main>
        <footer className="border-t border-line py-6">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="microlabel">
              Structured submissions · deterministic checks · reasoned design review
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

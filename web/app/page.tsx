"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Property, type DiscoverResponse } from "@/lib/api";
import { PropertyPicker } from "@/components/PropertyPicker";

export default function Home() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const [discovery, setDiscovery] = useState<DiscoverResponse | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [dismissMultiSitemapWarn, setDismissMultiSitemapWarn] = useState(false);

  useEffect(() => {
    api.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    setDismissMultiSitemapWarn(false);
  }, [discovery]);

  async function runDiscovery(p: Property, paste?: string) {
    setSelected(p);
    setDiscovering(true);
    setDiscovery(null);
    try {
      const d = await api.discover(p.site_url, paste);
      setDiscovery(d);
    } finally {
      setDiscovering(false);
    }
  }

  function startScan() {
    if (!selected || !discovery?.sitemaps[0]) return;
    const params = new URLSearchParams({
      property: selected.site_url,
      sitemap: discovery.sitemaps[0].url,
    });
    router.push(`/scan?${params.toString()}`);
  }

  return (
    <main className="relative min-h-screen">
      {/* Hero beam */}
      <div className="beam pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      {/* Header */}
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-ash">
          <span className="h-2 w-2 rounded-full bg-beam shadow-glow" />
          BEACON
        </div>
        {authed && (
          <button
            onClick={() => api.logout().then(() => location.reload())}
            className="text-xs font-mono text-smoke hover:text-bone"
          >
            Sign out
          </button>
        )}
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-5xl px-6 pt-8 pb-20 text-center md:pt-10">
        <div className="mx-auto mb-10 w-full max-w-3xl md:mb-12">
          <img
            src="/beacon-logo.png"
            alt="Beacon"
            className="mx-auto h-auto w-full"
            decoding="async"
          />
        </div>
        <h1 className="font-display text-6xl md:text-7xl tracking-tightest text-bone leading-[0.95]">
          See what Google <em className="text-beam not-italic">actually</em> sees.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-ash">
          Beacon compares your sitemap to the Google index and shows you the gap.
          Self-hosted. Bring your own credentials. Nothing leaves your server.
        </p>

        {authed === false && (
          <a
            href="/auth/google/login"
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-beam px-6 py-3
                       font-mono text-sm uppercase tracking-widest text-ink shadow-glow
                       hover:bg-beam2 transition-colors"
          >
            Connect Search Console
            <span aria-hidden>→</span>
          </a>
        )}
      </section>

      {authed && (
        <section className="relative mx-auto max-w-3xl px-6 pb-20 space-y-8">
          <div>
            <SectionLabel>1. Pick a property</SectionLabel>
            <div className="mt-3">
              <PropertyPicker
                selected={selected?.site_url}
                onSelect={(p) => runDiscovery(p)}
              />
            </div>
          </div>

          {selected && (
            <div>
              <SectionLabel>2. Sitemap</SectionLabel>
              <div className="mt-3 rounded-lg border border-rule bg-coal p-4">
                {discovering && <p className="text-sm text-ash">Looking for sitemaps…</p>}
                {discovery && discovery.sitemaps.length > 0 && (
                  <div className="space-y-3">
                    {discovery.sitemaps.length > 1 && !dismissMultiSitemapWarn && (
                      <div
                        className="relative rounded-lg border border-warn/50 bg-warn/10 p-3 pr-10 text-sm leading-snug text-bone/95"
                        role="status"
                      >
                        <button
                          type="button"
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded font-mono text-lg leading-none text-warn/90 hover:bg-warn/15 hover:text-warn"
                          aria-label="Dismiss warning"
                          onClick={() => setDismissMultiSitemapWarn(true)}
                        >
                          ×
                        </button>
                        <p className="flex gap-2 pr-2">
                          <span
                            className="shrink-0 select-none text-base leading-none text-warn"
                            aria-hidden
                          >
                            ⚠
                          </span>
                          <span>
                            Multiple sitemaps detected. Check that your robots.txt isn&apos;t
                            listing redundant sitemaps — Google may be wasting crawl budget on
                            duplicate URL lists.
                          </span>
                        </p>
                      </div>
                    )}
                    <p className="text-sm text-ash">
                      Found <span className="font-mono text-bone">{discovery.total_urls.toLocaleString()}</span> URLs
                      across <span className="font-mono text-bone">{discovery.sitemaps.length}</span>{" "}
                      sitemap{discovery.sitemaps.length === 1 ? "" : "s"}.
                    </p>
                    <ul className="space-y-1 font-mono text-xs text-smoke">
                      {discovery.sitemaps.map((s) => (
                        <li key={s.url} className="flex items-center justify-between gap-3">
                          <span className="truncate">{s.url}</span>
                          <span className="shrink-0">
                            <span className="text-ash">{s.url_count}</span>{" "}
                            <span className="ml-1 text-[10px] uppercase tracking-wider opacity-70">
                              via {s.source}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {discovery && discovery.sitemaps.length === 0 && (
                  <p className="text-sm text-warn">No sitemaps found automatically.</p>
                )}

                <div className="mt-4">
                  <button
                    onClick={() => setPasteOpen((v) => !v)}
                    className="text-xs font-mono text-beam hover:text-beam2"
                  >
                    {pasteOpen ? "Cancel" : "Use a different sitemap URL"}
                  </button>
                  {pasteOpen && (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={pasteUrl}
                        onChange={(e) => setPasteUrl(e.target.value)}
                        placeholder="https://example.com/sitemap.xml"
                        className="flex-1 rounded border border-rule bg-shade px-3 py-1.5 text-sm font-mono
                                   placeholder:text-smoke focus:border-beam focus:outline-none"
                      />
                      <button
                        disabled={!pasteUrl || !selected}
                        onClick={() => selected && runDiscovery(selected, pasteUrl)}
                        className="rounded border border-beam px-3 py-1.5 text-xs font-mono text-beam
                                   hover:bg-beam/10 disabled:opacity-50"
                      >
                        Use
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {discovery && discovery.total_urls > 0 && (
            <div>
              <SectionLabel>3. Run scan</SectionLabel>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-rule bg-coal p-4">
                <p className="text-sm text-ash">
                  Estimated time: ~{Math.max(1, Math.ceil(discovery.total_urls / 60))} min
                </p>
                <button
                  onClick={startScan}
                  className="rounded-full bg-beam px-5 py-2 font-mono text-xs uppercase tracking-widest
                             text-ink hover:bg-beam2 transition-colors shadow-glow"
                >
                  Scan →
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <footer className="relative mx-auto max-w-5xl px-6 py-12 text-xs font-mono text-smoke text-center">
        Built by Brian Diamond · BYO credentials · Open source ·{" "}
        <a
          href="https://github.com/brianonai/beacon"
          className="text-ash hover:text-bone"
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-smoke">
      {children}
    </h2>
  );
}

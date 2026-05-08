/** Build-time version from package.json (see next.config.js). */
export function BeaconFooter() {
  const v = process.env.NEXT_PUBLIC_BEACON_VERSION ?? "dev";

  return (
    <footer className="mt-auto border-t border-rule/50 px-6 py-3">
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-smoke">
        Beacon — v{v}
      </p>
    </footer>
  );
}

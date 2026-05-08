/** Build-time version from package.json (see next.config.js). */
export function BeaconFooter() {
  const v = process.env.NEXT_PUBLIC_BEACON_VERSION ?? "dev";

  return (
    <footer className="mt-auto border-t border-rule/50 px-6 py-4">
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-smoke">
        Beacon — v{v}
      </p>
      <p className="mt-2 text-center text-xs text-smoke">
        <span>Beacon by </span>
        <a
          href="https://brianonai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-beam hover:text-beam2"
        >
          Brian Diamond
        </a>
        <span> · </span>
        <a
          href="https://thecaiobrief.substack.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ash hover:text-beam"
        >
          The CAIO Brief
        </a>
        <span> · </span>
        <a
          href="https://github.com/brianonai/beacon"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ash hover:text-beam"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}

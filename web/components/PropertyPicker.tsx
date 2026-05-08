"use client";

import { useEffect, useState } from "react";
import { api, type Property } from "@/lib/api";

type Props = {
  selected?: string;
  onSelect: (p: Property) => void;
};

export function PropertyPicker({ selected, onSelect }: Props) {
  const [props, setProps] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.properties()
      .then(({ properties }) => setProps(properties))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) {
    return (
      <p className="text-sm text-fail">
        Could not load your properties. Make sure you signed in with the same
        Google account that owns the Search Console property.
      </p>
    );
  }
  if (!props) {
    return <p className="text-sm text-ash">Loading your properties…</p>;
  }
  if (!props.length) {
    return (
      <p className="text-sm text-ash">
        This Google account has no verified Search Console properties.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-rule rounded-lg border border-rule overflow-hidden bg-coal">
      {props.map((p) => {
        const active = p.site_url === selected;
        return (
          <li key={p.site_url}>
            <button
              type="button"
              onClick={() => onSelect(p)}
              className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors
                ${active ? "bg-shade" : "hover:bg-shade"}`}
            >
              <span className="font-mono text-sm text-bone truncate">
                {p.site_url.replace(/^sc-domain:/, "")}
              </span>
              <TypeBadge type={p.type} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TypeBadge({ type }: { type: Property["type"] }) {
  const isDomain = type === "DOMAIN";
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider
        ${isDomain ? "bg-beam/10 text-beam" : "bg-rule text-ash"}`}
      title={
        isDomain
          ? "Domain property — covers all subdomains and protocols"
          : "URL-prefix property — covers only this exact prefix"
      }
    >
      {isDomain ? "Domain" : "Prefix"}
    </span>
  );
}

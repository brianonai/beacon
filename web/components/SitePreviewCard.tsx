"use client";

import type { SitePreview } from "@/lib/api";

type Props = {
  preview: SitePreview;
  domain: string;
};

function normUrlPath(u: string) {
  const t = u.trim();
  return t.replace(/\/+$/, "") || t;
}

export function SitePreviewCard({ preview, domain }: Props) {
  const {
    title,
    description,
    screenshot_url,
    logo_url,
    error,
    requested_url,
    resolved_url,
    resolve_note,
    microlink_errors,
    last_microlink_query,
  } = preview;

  const urlsDiffer =
    !!requested_url &&
    !!resolved_url &&
    normUrlPath(requested_url) !== normUrlPath(resolved_url);

  const showDebug = !!(
    (requested_url || resolved_url || last_microlink_query || resolve_note) &&
    (error ||
      (microlink_errors && microlink_errors.length > 0) ||
      urlsDiffer)
  );

  return (
    <div className="flex gap-4 overflow-hidden rounded-lg border border-rule bg-coal">
      <div className="aspect-[16/10] w-52 shrink-0 bg-shade sm:w-60">
        {screenshot_url ? (
          <img
            src={screenshot_url}
            alt=""
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-shade to-coal px-2 text-center font-mono text-xs text-smoke">
            {domain}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-4 pr-4">
        <div className="flex items-center gap-2 text-xs text-ash">
          {logo_url && (
            <img src={logo_url} className="h-4 w-4 rounded" alt="" />
          )}
          <span className="truncate font-mono">{domain}</span>
        </div>
        <h2 className="mt-1 truncate font-display text-xl text-bone sm:text-2xl">
          {title?.trim() || domain}
        </h2>
        {description?.trim() && (
          <p className="mt-1 line-clamp-2 text-sm text-ash">{description}</p>
        )}
        {error && (
          <p className="mt-1 text-xs text-smoke">
            Preview: <span className="text-warn">{error}</span>
          </p>
        )}
        {microlink_errors && microlink_errors.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-xs text-warn">
            {microlink_errors.map((line, i) => (
              <li key={i} className="break-all">
                {line}
              </li>
            ))}
          </ul>
        )}
        {showDebug && (
          <details className="mt-2 text-xs text-ash">
            <summary className="cursor-pointer text-smoke hover:text-bone">
              What Beacon sent to Microlink
            </summary>
            <dl className="mt-2 space-y-1 font-mono break-all">
              {requested_url != null && requested_url !== "" && (
                <>
                  <dt className="text-smoke">Requested URL</dt>
                  <dd>{requested_url}</dd>
                </>
              )}
              {resolved_url != null && resolved_url !== "" && (
                <>
                  <dt className="text-smoke">After redirects (Microlink `url`)</dt>
                  <dd>{resolved_url}</dd>
                </>
              )}
              {resolve_note != null && resolve_note !== "" && (
                <>
                  <dt className="text-smoke">Redirect probe</dt>
                  <dd className="text-warn">{resolve_note}</dd>
                </>
              )}
              {last_microlink_query != null && last_microlink_query !== "" && (
                <>
                  <dt className="text-smoke">Last Microlink request</dt>
                  <dd>{last_microlink_query}</dd>
                </>
              )}
            </dl>
          </details>
        )}
      </div>
    </div>
  );
}

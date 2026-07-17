"use client";

import { useState } from "react";
import { Icon } from "@/components/md/Icon";

const btn =
  "grid place-items-center size-10 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface transition-colors";

function Brand({ path, label }: { path: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" role="img" aria-label={label}>
      <path d={path} />
    </svg>
  );
}

const X_PATH =
  "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z";
const FB_PATH =
  "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z";
const LI_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z";

/** Social + email share for an article. All shares point at the canonical
 *  Optimixed URL and note that it was shared from www.optimixed.com. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;

  const xHref = `https://twitter.com/intent/tweet?text=${enc(`${title} (via Optimixed)`)}&url=${enc(url)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`;
  const emailHref = `mailto:?subject=${enc(title)}&body=${enc(`${title}\n\n${url}\n\nShared from www.optimixed.com`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
      <span className="text-label-large text-on-surface-variant mr-1 inline-flex items-center gap-1">
        <Icon name="share" className="text-[18px]" />
        Share
      </span>

      <a href={xHref} target="_blank" rel="noreferrer" aria-label="Share on X" title="Share on X" className={btn}>
        <Brand path={X_PATH} label="X" />
      </a>
      <a href={fbHref} target="_blank" rel="noreferrer" aria-label="Share on Facebook" title="Share on Facebook" className={btn}>
        <Brand path={FB_PATH} label="Facebook" />
      </a>
      <a href={liHref} target="_blank" rel="noreferrer" aria-label="Share on LinkedIn" title="Share on LinkedIn" className={btn}>
        <Brand path={LI_PATH} label="LinkedIn" />
      </a>
      <a href={emailHref} aria-label="Share by email" title="Share by email" className={btn}>
        <Icon name="mail" className="text-[20px]" />
      </a>
      <button onClick={copyLink} aria-label="Copy link" title="Copy link" className={btn}>
        <Icon name={copied ? "check" : "link"} className="text-[20px]" />
      </button>
      {copied && <span className="text-label-small text-on-surface-variant">Link copied</span>}
    </div>
  );
}

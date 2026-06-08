'use client';

/**
 * Runtime translation layer — the "layer" half of the hybrid i18n strategy.
 * When the active locale is English, it walks the rendered DOM, finds any text
 * still containing Arabic (UI not-yet-migrated to the dictionary, plus dynamic
 * content like names / project titles / email snippets), and swaps it to English
 * using the cached /api/translate engine. Cache hits are instant; misses are
 * fetched once and persisted (memory + localStorage) so repeat paints are
 * flicker-free. Pages already migrated to next-intl render English directly and
 * are simply skipped here (no Arabic to find).
 */
import { useEffect } from 'react';

const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT', 'OPTION']);
const LS_KEY = 'i18nLayer:en';
const LS_MAX_LEN = 300; // only persist short strings to keep localStorage bounded

const mem = new Map<string, string>();
let lsLoaded = false;

function loadLS() {
  if (lsLoaded) return;
  lsLoaded = true;
  try {
    const j = localStorage.getItem(LS_KEY);
    if (j) for (const [k, v] of Object.entries(JSON.parse(j) as Record<string, string>)) mem.set(k, v);
  } catch {
    /* ignore */
  }
}
function saveLS() {
  try {
    const o: Record<string, string> = {};
    mem.forEach((v, k) => {
      // Persist only real translations (skip identity results so transient
      // model failures retry on reload) and keep localStorage bounded.
      if (v !== k && k.length <= LS_MAX_LEN) o[k] = v;
    });
    localStorage.setItem(LS_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

type Target = { key: string; read: () => string; write: (s: string) => void };

function isSkipped(el: Element | null): boolean {
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.hasAttribute('data-i18n-skip')) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    el = el.parentElement;
  }
  return false;
}

function wsWrap(original: string, translated: string): string {
  const lead = original.match(/^\s*/)?.[0] ?? '';
  const trail = original.match(/\s*$/)?.[0] ?? '';
  return lead + translated + trail;
}

function collect(root: ParentNode): Target[] {
  const targets: Target[] = [];

  // Text nodes.
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const v = n.nodeValue ?? '';
      if (v.trim().length < 2 || !AR.test(v)) return NodeFilter.FILTER_REJECT;
      if (isSkipped((n as Text).parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let tn: Node | null;
  while ((tn = walker.nextNode())) {
    const node = tn as Text;
    targets.push({
      key: (node.nodeValue ?? '').trim(),
      read: () => node.nodeValue ?? '',
      write: (s) => {
        node.nodeValue = wsWrap(node.nodeValue ?? '', s);
      },
    });
  }

  // A few attributes that surface text to users.
  const rootEl =
    (root as Element).querySelectorAll ? (root as Element) : (document.body as Element);
  for (const attr of ['placeholder', 'aria-label', 'title']) {
    rootEl.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
      const v = el.getAttribute(attr) ?? '';
      if (v.trim().length < 2 || !AR.test(v) || isSkipped(el)) return;
      targets.push({
        key: v.trim(),
        read: () => el.getAttribute(attr) ?? '',
        write: (s) => el.setAttribute(attr, s),
      });
    });
  }
  return targets;
}

function applyHits(targets: Target[]): string[] {
  const missing = new Set<string>();
  for (const t of targets) {
    const tr = mem.get(t.key);
    if (tr) t.write(tr);
    else missing.add(t.key);
  }
  return Array.from(missing);
}

async function fetchTranslations(texts: string[]): Promise<boolean> {
  // Chunk to respect the API's per-request cap.
  let changed = false;
  for (let i = 0; i < texts.length; i += 180) {
    const slice = texts.slice(i, i + 180);
    try {
      const r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texts: slice, to: 'en', domain: 'content' }),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { translations?: Record<string, string> };
      for (const [k, v] of Object.entries(j.translations ?? {})) {
        if (typeof v !== 'string') continue;
        // Cache every returned key (even identity results for brand/proper
        // names) so we don't re-request it on the next mutation; only count a
        // real change for the re-apply + persist passes.
        if (!mem.has(k)) mem.set(k, v);
        if (v !== k) changed = true;
      }
    } catch {
      /* ignore */
    }
  }
  if (changed) saveLS();
  return changed;
}

export function TranslateLayer({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    loadLS();

    let raf = 0;
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        // Pass 1: apply cache hits across the whole document.
        let targets = collect(document.body);
        const missing = applyHits(targets);
        // Pass 2: fetch misses, then re-apply (DOM may have changed during await).
        if (missing.length) {
          const got = await fetchTranslations(missing);
          if (got) {
            targets = collect(document.body);
            applyHits(targets);
          }
        }
      } finally {
        running = false;
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // small debounce after paint
        window.setTimeout(run, 120);
      });
    };

    schedule(); // initial pass

    const observer = new MutationObserver(() => schedule());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  return null;
}

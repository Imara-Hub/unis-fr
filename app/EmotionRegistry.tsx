"use client";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";
import { useState, type ReactNode } from "react";

// Without this, Emotion writes Chakra's <style> tags inline next to the first component during
// server rendering, so the server HTML does not match the client (hydration error). Here the styles
// are collected and sent in the <head> instead.
export function EmotionRegistry({ children }: { children: ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "css" });
    cache.compat = true;
    const insert = cache.insert;
    let inserted: string[] = [];
    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) inserted.push(serialized.name);
      return insert(...args);
    };
    const flush = () => {
      const names = inserted;
      inserted = [];
      return names;
    };
    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    const styles = names.map((name) => cache.inserted[name]).filter((s) => typeof s === "string").join("");
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}

import type { NewsItem } from '@/types';

let candidateItems = new Map<string, NewsItem>();
let tavilyItems: NewsItem[] = [];
const listeners = new Set<(items: NewsItem[]) => void>();
let interpretedKeys = new Set<string>();
const interpretedListeners = new Set<(keys: Set<string>) => void>();
let interpretedMeta = new Map<string, number>();
const interpretedMetaListeners = new Set<(meta: Map<string, number>) => void>();

function itemKey(item: Pick<NewsItem, 'source' | 'title'>): string {
  return `${item.source}::${item.title}`;
}

export function setMediaBridgeItems(items: NewsItem[]): void {
  candidateItems = new Map(items.map((item) => [itemKey(item), item]));
  const allowedKeys = new Set(candidateItems.keys());
  interpretedKeys = new Set([...interpretedKeys].filter((key) => allowedKeys.has(key)));
  interpretedMeta = new Map(
    [...interpretedMeta.entries()].filter(([key]) => allowedKeys.has(key)),
  );
  tavilyItems = [...interpretedKeys]
    .map((key) => candidateItems.get(key))
    .filter((item): item is NewsItem => Boolean(item))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  for (const listener of listeners) {
    listener([...tavilyItems]);
  }
  for (const listener of interpretedListeners) {
    listener(new Set(interpretedKeys));
  }
  for (const listener of interpretedMetaListeners) {
    listener(new Map(interpretedMeta));
  }
}

export function getMediaBridgeItems(): NewsItem[] {
  return [...tavilyItems];
}

export function subscribeMediaBridgeItems(listener: (items: NewsItem[]) => void): () => void {
  listeners.add(listener);
  listener([...tavilyItems]);
  return () => {
    listeners.delete(listener);
  };
}

export function markMediaBridgeInterpreted(item: Pick<NewsItem, 'source' | 'title'>): void {
  const key = itemKey(item);
  const candidate = candidateItems.get(key);
  if (!candidate) return;
  interpretedKeys.add(key);
  interpretedMeta.set(key, Date.now());
  tavilyItems = [...interpretedKeys]
    .map((currentKey) => candidateItems.get(currentKey))
    .filter((currentItem): currentItem is NewsItem => Boolean(currentItem))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  for (const listener of listeners) {
    listener([...tavilyItems]);
  }
  for (const listener of interpretedListeners) {
    listener(new Set(interpretedKeys));
  }
  for (const listener of interpretedMetaListeners) {
    listener(new Map(interpretedMeta));
  }
}

export function getMediaBridgeInterpretedKeys(): Set<string> {
  return new Set(interpretedKeys);
}

export function subscribeMediaBridgeInterpretation(listener: (keys: Set<string>) => void): () => void {
  interpretedListeners.add(listener);
  listener(new Set(interpretedKeys));
  return () => {
    interpretedListeners.delete(listener);
  };
}

export function getMediaBridgeInterpretedMeta(): Map<string, number> {
  return new Map(interpretedMeta);
}

export function subscribeMediaBridgeInterpretationMeta(listener: (meta: Map<string, number>) => void): () => void {
  interpretedMetaListeners.add(listener);
  listener(new Map(interpretedMeta));
  return () => {
    interpretedMetaListeners.delete(listener);
  };
}

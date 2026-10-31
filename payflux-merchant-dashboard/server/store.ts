import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./config";
import type { LinkRecord } from "./types";

const FILE = path.join(DATA_DIR, "links.json");
let cache: LinkRecord[] | null = null;

function load(): LinkRecord[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(parsed) ? (parsed as LinkRecord[]) : [];
  } catch {
    return [];
  }
}

function all(): LinkRecord[] {
  if (!cache) cache = load();
  return cache;
}

function persist(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all(), null, 2));
  fs.renameSync(tmp, FILE);
}

export function findLink(id: string): LinkRecord | undefined {
  return all().find((l) => l.id === id);
}

export function listLinks(merchant: string): LinkRecord[] {
  const m = merchant.toLowerCase();
  return all()
    .filter((l) => l.merchant.toLowerCase() === m)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function nonceExists(nonce: string): boolean {
  const n = nonce.toLowerCase();
  return all().some((l) => l.request.r.nonce.toLowerCase() === n);
}

export function insertLink(link: LinkRecord): void {
  all().unshift(link);
  persist();
}

export function updateLink(id: string, patch: Partial<LinkRecord>): LinkRecord | undefined {
  const link = findLink(id);
  if (!link) return undefined;
  Object.assign(link, patch);
  persist();
  return link;
}

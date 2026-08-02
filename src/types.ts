export interface EcosystemPlugin {
  id: string;
  name: string;
  version: string;
  path: string;
  minAppVersion?: string;
  description?: string;
  changelog?: string;
  releaseNotesUrl?: string;
}

export interface EcosystemCatalog {
  schemaVersion: number;
  plugins: EcosystemPlugin[];
}

export interface CachedCatalog {
  fetchedAt: number;
  catalog: EcosystemCatalog;
}

/** Compare semver-ish strings. Returns >0 if a>b, <0 if a<b, 0 if equal. */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export type PluginInstallStatus =
  | "not-installed"
  | "up-to-date"
  | "update-available"
  | "newer-local";

export function statusFor(
  catalogVersion: string,
  localVersion: string | null
): PluginInstallStatus {
  if (!localVersion) return "not-installed";
  const cmp = compareSemver(localVersion, catalogVersion);
  if (cmp === 0) return "up-to-date";
  if (cmp < 0) return "update-available";
  return "newer-local";
}

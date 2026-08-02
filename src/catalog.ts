import { requestUrl } from "obsidian";
import type { EcosystemCatalog } from "./types";

export function isValidCatalog(data: unknown): data is EcosystemCatalog {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.schemaVersion !== "number") return false;
  if (!Array.isArray(obj.plugins)) return false;
  return obj.plugins.every((p) => {
    if (!p || typeof p !== "object") return false;
    const plugin = p as Record<string, unknown>;
    return (
      typeof plugin.id === "string" &&
      typeof plugin.name === "string" &&
      typeof plugin.version === "string" &&
      typeof plugin.path === "string"
    );
  });
}

export async function fetchCatalog(catalogUrl: string): Promise<EcosystemCatalog> {
  const res = await requestUrl({ url: catalogUrl, method: "GET" });
  const data = res.json;
  if (!isValidCatalog(data)) {
    throw new Error("Некорректный ecosystem.json");
  }
  return data;
}

/** Base URL of the repo raw root derived from catalog URL (.../ecosystem.json). */
export function repoRawRootFromCatalogUrl(catalogUrl: string): string {
  if (catalogUrl.endsWith("ecosystem.json")) {
    return catalogUrl.slice(0, -"ecosystem.json".length);
  }
  if (!catalogUrl.endsWith("/")) return catalogUrl + "/";
  return catalogUrl;
}

export function artifactUrl(
  repoRawRoot: string,
  pluginPath: string,
  fileName: string
): string {
  const base = repoRawRoot.endsWith("/") ? repoRawRoot : repoRawRoot + "/";
  const path = pluginPath.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${base}${path}/${fileName}`;
}

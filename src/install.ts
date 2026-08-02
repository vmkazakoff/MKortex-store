import { Notice, requestUrl, type App } from "obsidian";
import { artifactUrl } from "./catalog";
import type { EcosystemPlugin } from "./types";

const PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"] as const;

export async function readLocalManifestVersion(
  app: App,
  pluginId: string
): Promise<string | null> {
  const manifestPath = `${app.vault.configDir}/plugins/${pluginId}/manifest.json`;
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(manifestPath))) return null;
  try {
    const raw = await adapter.read(manifestPath);
    const manifest = JSON.parse(raw) as { version?: string };
    return manifest.version ?? null;
  } catch {
    return null;
  }
}

async function downloadText(url: string): Promise<string> {
  const res = await requestUrl({ url, method: "GET" });
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} для ${url}`);
  }
  return res.text;
}

/**
 * Install or update a plugin from dist files.
 * Preserves existing data.json.
 */
export async function installPlugin(
  app: App,
  plugin: EcosystemPlugin,
  repoRawRoot: string
): Promise<void> {
  const pluginDir = `${app.vault.configDir}/plugins/${plugin.id}`;
  const tmpDir = `${pluginDir}.mkortex-tmp`;
  const adapter = app.vault.adapter;

  if (await adapter.exists(tmpDir)) {
    await adapter.rmdir(tmpDir, true);
  }
  await adapter.mkdir(tmpDir);

  try {
    for (const file of PLUGIN_FILES) {
      const url = artifactUrl(repoRawRoot, plugin.path, file);
      try {
        const body = await downloadText(url);
        await adapter.write(`${tmpDir}/${file}`, body);
      } catch (e) {
        // styles.css is optional
        if (file === "styles.css") continue;
        throw e;
      }
    }

    if (!(await adapter.exists(`${tmpDir}/main.js`))) {
      throw new Error("В релизе нет main.js");
    }
    if (!(await adapter.exists(`${tmpDir}/manifest.json`))) {
      throw new Error("В релизе нет manifest.json");
    }

    // Preserve data.json across update
    let dataJson: string | null = null;
    const dataPath = `${pluginDir}/data.json`;
    if (await adapter.exists(dataPath)) {
      dataJson = await adapter.read(dataPath);
    }

    if (!(await adapter.exists(pluginDir))) {
      await adapter.mkdir(pluginDir);
    }

    for (const file of PLUGIN_FILES) {
      const src = `${tmpDir}/${file}`;
      if (!(await adapter.exists(src))) continue;
      const content = await adapter.read(src);
      await adapter.write(`${pluginDir}/${file}`, content);
    }

    if (dataJson !== null) {
      await adapter.write(dataPath, dataJson);
    }
  } finally {
    if (await adapter.exists(tmpDir)) {
      await adapter.rmdir(tmpDir, true);
    }
  }
}

/** Enable plugin if disabled; reload if already enabled. Uses private Obsidian API. */
export async function enableOrReloadPlugin(app: App, pluginId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugins = (app as any).plugins;
  if (!plugins) {
    new Notice(`Включите плагин «${pluginId}» в настройках Obsidian`);
    return;
  }

  try {
    await plugins.loadManifests();
  } catch {
    // ignore
  }

  const enabled: Record<string, boolean> = plugins.enabledPlugins
    ? Object.fromEntries([...plugins.enabledPlugins].map((id: string) => [id, true]))
    : {};

  try {
    if (enabled[pluginId] || plugins.enabledPlugins?.has?.(pluginId)) {
      if (typeof plugins.reloadPlugin === "function") {
        await plugins.reloadPlugin(pluginId);
        return;
      }
      await plugins.disablePlugin(pluginId);
      await plugins.enablePlugin(pluginId);
      return;
    }

    if (typeof plugins.enablePluginAndSave === "function") {
      await plugins.enablePluginAndSave(pluginId);
    } else {
      await plugins.enablePlugin(pluginId);
    }
  } catch (e) {
    console.error(e);
    new Notice(`Установлено. Включите «${pluginId}» вручную в настройках.`);
  }
}

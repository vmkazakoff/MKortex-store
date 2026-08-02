import { App, Modal, Notice, Plugin, Setting } from "obsidian";
import {
  fetchCatalog,
  repoRawRootFromCatalogUrl,
} from "./catalog";
import {
  enableOrReloadPlugin,
  installPlugin,
  readLocalManifestVersion,
} from "./install";
import { MKortexUpdaterSettingTab } from "./settings";
import {
  statusFor,
  type CachedCatalog,
  type EcosystemCatalog,
  type EcosystemPlugin,
} from "./types";

export interface MKortexUpdaterSettings {
  catalogUrl: string;
  cachedCatalog: CachedCatalog | null;
}

const DEFAULT_CATALOG_URL =
  "https://raw.githubusercontent.com/vmkazakoff/MKortex-updater/main/ecosystem.json";

const DEFAULT_SETTINGS: MKortexUpdaterSettings = {
  catalogUrl: DEFAULT_CATALOG_URL,
  cachedCatalog: null,
};

export default class MKortexUpdaterPlugin extends Plugin {
  settings: MKortexUpdaterSettings = DEFAULT_SETTINGS;
  readonly DEFAULT_CATALOG_URL = DEFAULT_CATALOG_URL;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MKortexUpdaterSettingTab(this.app, this));

    // Delayed startup check — don't block Obsidian boot
    window.setTimeout(() => {
      void this.checkForUpdates({ silent: true, showModalIfUpdates: true });
    }, 2500);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getCachedCatalog(): EcosystemCatalog | null {
    return this.settings.cachedCatalog?.catalog ?? null;
  }

  async checkForUpdates(opts: {
    silent: boolean;
    showModalIfUpdates: boolean;
  }): Promise<EcosystemPlugin[]> {
    const url = this.settings.catalogUrl || DEFAULT_CATALOG_URL;
    try {
      const catalog = await fetchCatalog(url);
      this.settings.cachedCatalog = {
        fetchedAt: Date.now(),
        catalog,
      };
      await this.saveSettings();

      const updates: EcosystemPlugin[] = [];
      for (const plugin of catalog.plugins) {
        const local = await readLocalManifestVersion(this.app, plugin.id);
        if (statusFor(plugin.version, local) === "update-available") {
          updates.push(plugin);
        }
      }

      if (updates.length === 0) {
        if (!opts.silent) new Notice("MKortex: всё актуально");
        return updates;
      }

      if (opts.showModalIfUpdates) {
        new UpdatesModal(this.app, this, updates).open();
      } else if (!opts.silent) {
        new Notice(`MKortex: доступно обновлений — ${updates.length}`);
      }
      return updates;
    } catch (e) {
      console.error("MKortex catalog check failed", e);
      if (!opts.silent) {
        new Notice("MKortex: не удалось загрузить каталог");
      }
      return [];
    }
  }

  async installFromCatalog(plugin: EcosystemPlugin): Promise<void> {
    const url = this.settings.catalogUrl || DEFAULT_CATALOG_URL;
    const root = repoRawRootFromCatalogUrl(url);
    await installPlugin(this.app, plugin, root);
    await enableOrReloadPlugin(this.app, plugin.id);
  }
}

class UpdatesModal extends Modal {
  constructor(
    app: App,
    private plugin: MKortexUpdaterPlugin,
    private updates: EcosystemPlugin[]
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Обновления MKortex" });
    contentEl.createEl("p", {
      text: "Доступны новые версии. Обновить сейчас?",
    });

    const list = contentEl.createEl("ul");
    for (const p of this.updates) {
      list.createEl("li", { text: `${p.name} → ${p.version}` });
    }

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Позже").onClick(() => this.close())
      )
      .addButton((btn) =>
        btn
          .setButtonText("Обновить всё")
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true);
            try {
              for (const p of this.updates) {
                await this.plugin.installFromCatalog(p);
              }
              new Notice("MKortex: обновление завершено");
              this.close();
            } catch (e) {
              console.error(e);
              new Notice(`Ошибка: ${String(e)}`);
              btn.setDisabled(false);
            }
          })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

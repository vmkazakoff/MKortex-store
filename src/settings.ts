import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type MKortexUpdaterPlugin from "./main";
import { statusFor, type EcosystemPlugin, type PluginInstallStatus } from "./types";
import { readLocalManifestVersion } from "./install";

const STATUS_LABEL: Record<PluginInstallStatus, string> = {
  "not-installed": "не установлен",
  "up-to-date": "актуален",
  "update-available": "есть обновление",
  "newer-local": "локально новее",
};

export class MKortexUpdaterSettingTab extends PluginSettingTab {
  plugin: MKortexUpdaterPlugin;

  constructor(app: App, plugin: MKortexUpdaterPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("mkortex-updater-settings");

    containerEl.createEl("h2", { text: "MKortex Updater" });

    new Setting(containerEl)
      .setName("URL каталога")
      .setDesc("ecosystem.json в репозитории экосистемы")
      .addText((text) =>
        text
          .setPlaceholder(this.plugin.DEFAULT_CATALOG_URL)
          .setValue(this.plugin.settings.catalogUrl)
          .onChange(async (value) => {
            this.plugin.settings.catalogUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Проверить обновления")
      .setDesc("Скачать каталог и сравнить с установленными плагинами")
      .addButton((btn) =>
        btn.setButtonText("Проверить").onClick(async () => {
          btn.setDisabled(true);
          try {
            await this.plugin.checkForUpdates({ silent: false, showModalIfUpdates: true });
            this.display();
          } finally {
            btn.setDisabled(false);
          }
        })
      );

    containerEl.createEl("h3", { text: "Экосистема" });

    const catalog = this.plugin.getCachedCatalog();
    if (!catalog) {
      containerEl.createEl("p", {
        text: "Каталог ещё не загружен. Нажмите «Проверить».",
        cls: "mkortex-plugin-desc",
      });
      return;
    }

    for (const plugin of catalog.plugins) {
      void this.renderPluginRow(containerEl, plugin);
    }
  }

  private async renderPluginRow(containerEl: HTMLElement, plugin: EcosystemPlugin) {
    const localVersion = await readLocalManifestVersion(this.app, plugin.id);
    const status = statusFor(plugin.version, localVersion);

    const row = containerEl.createDiv({ cls: "mkortex-plugin-row" });
    const meta = row.createDiv({ cls: "mkortex-plugin-meta" });
    meta.createDiv({ cls: "mkortex-plugin-name", text: plugin.name });
    if (plugin.description) {
      meta.createDiv({ cls: "mkortex-plugin-desc", text: plugin.description });
    }
    const versionText = localVersion
      ? `${localVersion} → ${plugin.version}`
      : `каталог: ${plugin.version}`;
    meta.createDiv({
      cls: "mkortex-plugin-status",
      text: `${STATUS_LABEL[status]} · ${versionText}`,
    });

    const actions = row.createDiv({ cls: "mkortex-plugin-actions" });

    if (status === "not-installed") {
      const btn = actions.createEl("button", { text: "Install", cls: "mod-cta" });
      btn.onclick = async () => {
        btn.setAttr("disabled", "true");
        try {
          await this.plugin.installFromCatalog(plugin);
          new Notice(`${plugin.name} установлен`);
          this.display();
        } catch (e) {
          console.error(e);
          new Notice(`Ошибка установки: ${String(e)}`);
          btn.removeAttribute("disabled");
        }
      };
    } else if (status === "update-available") {
      const btn = actions.createEl("button", { text: "Update", cls: "mod-cta" });
      btn.onclick = async () => {
        btn.setAttr("disabled", "true");
        try {
          await this.plugin.installFromCatalog(plugin);
          new Notice(`${plugin.name} обновлён`);
          this.display();
        } catch (e) {
          console.error(e);
          new Notice(`Ошибка обновления: ${String(e)}`);
          btn.removeAttribute("disabled");
        }
      };
    }
  }
}

# MKortex Updater

Ядро экосистемы MKortex для Obsidian: ставит и обновляет плагины из каталога `ecosystem.json`.

## Для клиентов

1. Скачайте папку `dist/mkortex-updater/` (или release zip).
2. Положите в `Vault/.obsidian/plugins/mkortex-updater/`.
3. Включите плагин в настройках Obsidian.

Дальше остальные плагины экосистемы ставятся из настроек updater’а.

## Для разработки

```bash
npm install
npm run dev      # сборка + копирование в vault
npm run build    # production в dist/mkortex-updater/
```

Публикуются только артефакты в `dist/<plugin-id>/` + `ecosystem.json`. После релиза нового билда обновите `version` в `manifest.json`, `package.json` и `ecosystem.json`.

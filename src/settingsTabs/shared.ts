import { Setting } from "obsidian";
import type { DashboardSettingTab } from "../settings";

/** A validated integer text field that saves and refreshes on every valid edit. */
export function numberSetting(
  tab: DashboardSettingTab,
  containerEl: HTMLElement,
  name: string,
  desc: string,
  get: () => number,
  set: (n: number) => void,
  min: number,
  max: number
) {
  new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addText((tx) =>
      tx.setValue(String(get())).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!Number.isFinite(n) || n < min || n > max) return;
        set(n);
        await tab.plugin.saveSettings();
        tab.plugin.refreshViews();
      })
    );
}

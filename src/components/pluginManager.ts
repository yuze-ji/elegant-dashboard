import { Notice } from "obsidian";
import { Ctx, card } from "../ui";

interface PluginManifestLike {
  id: string;
  name: string;
  version?: string;
}

interface PluginsApi {
  manifests: Record<string, PluginManifestLike>;
  enabledPlugins: Set<string>;
  /**
   * The "AndSave" variants, not the bare `enablePlugin`/`disablePlugin` — the
   * bare pair only loads/unloads the runtime instance and never touches
   * `enabledPlugins` or the on-disk config. Using them here made the toggle
   * a one-way door: the first click actually disabled the plugin, but with
   * `enabledPlugins` never updated, every click after that re-read the same
   * stale "still enabled" state and called disable again — the plugin could
   * never be turned back on from this list, and the disable did not survive
   * a restart either since it was never persisted.
   */
  enablePluginAndSave: (id: string) => Promise<boolean>;
  disablePluginAndSave: (id: string) => Promise<void>;
}

export function renderPluginManager(parent: HTMLElement, ctx: Ctx) {
  const { t } = ctx;
  const root = card(parent, `🔌 ${t.pluginManager}`);

  const plugins = (ctx.app as unknown as { plugins?: PluginsApi }).plugins;
  if (!plugins || !plugins.manifests) {
    root.createDiv({ cls: "ed-empty", text: "—" });
    return;
  }

  const list = root.createDiv({ cls: "ed-plugin-list" });

  const draw = () => {
    list.empty();
    // Disabling this plugin from inside its own UI would tear down the very
    // view rendering the toggle mid-click (timers stopped, engines torn down,
    // but the leaf stays open referencing them) — so it never gets a row here.
    // Turning it off is one click away in Community Plugins either way.
    const ids = Object.keys(plugins.manifests)
      .filter((id) => id !== ctx.selfId)
      .sort((a, b) => plugins.manifests[a].name.localeCompare(plugins.manifests[b].name));
    for (const id of ids) {
      const manifest = plugins.manifests[id];
      const item = list.createDiv({ cls: "ed-plugin-item" });
      const name = item.createDiv({ cls: "ed-plugin-name" });
      name.createSpan({ text: manifest.name });
      if (manifest.version) {
        name.createSpan({ cls: "ed-plugin-version", text: `v${manifest.version}` });
      }

      const on = plugins.enabledPlugins.has(id);
      const toggle = item.createDiv({ cls: "ed-toggle" });
      if (on) toggle.addClass("is-on");
      toggle.createDiv({ cls: "ed-toggle-knob" });
      toggle.setAttr("role", "switch");
      toggle.setAttr("aria-checked", String(on));
      toggle.setAttr("aria-label", manifest.name);

      toggle.onclick = async () => {
        try {
          if (plugins.enabledPlugins.has(id)) await plugins.disablePluginAndSave(id);
          else await plugins.enablePluginAndSave(id);
        } catch (err) {
          new Notice(`Failed to toggle ${manifest.name}: ${String(err)}`);
        }
        draw();
      };
    }
  };

  draw();
}

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
  enablePlugin: (id: string) => Promise<void>;
  disablePlugin: (id: string) => Promise<void>;
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
    const ids = Object.keys(plugins.manifests).sort((a, b) =>
      plugins.manifests[a].name.localeCompare(plugins.manifests[b].name)
    );
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
          if (plugins.enabledPlugins.has(id)) await plugins.disablePlugin(id);
          else await plugins.enablePlugin(id);
        } catch (err) {
          new Notice(`Failed to toggle ${manifest.name}: ${String(err)}`);
        }
        draw();
      };
    }
  };

  draw();
}

import { Setting } from "obsidian";
import { CustomItemKind, MODULE_ORDER, newId } from "../types";
import type { DashboardSettingTab } from "../settings";

export function renderModuleSettings(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  new Setting(containerEl).setName(cn ? "自定义面板" : "Custom panels").setHeading();
  renderCustomPanels(tab, containerEl, cn);

  new Setting(containerEl).setName(cn ? "模块开关" : "Modules").setHeading();

  for (const id of MODULE_ORDER) {
    new Setting(containerEl).setName(tab.label(id)).addToggle((tg) =>
      tg.setValue(tab.plugin.settings.modules[id]).onChange(async (v) => {
        tab.plugin.settings.modules[id] = v;
        await tab.plugin.saveSettings();
        tab.plugin.refreshViews();
      })
    );
  }
}

/**
 * Editor for the Custom panels module: each panel has a title and items;
 * each item a label, an optional icon (emoji or Lucide name), a kind and
 * a target whose meaning follows the kind. All data-driven — nothing in
 * the plugin decides what a panel is for.
 */
export function renderCustomPanels(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  const s = tab.plugin.settings;
  const commit = async () => {
    await tab.plugin.saveSettings();
    tab.plugin.refreshViews();
  };
  const redraw = async () => {
    await commit();
    tab.display();
  };
  new Setting(containerEl).setDesc(
    cn
      ? "自己定义的面板，每个面板是一张卡片，里面的每一项可以是：网页链接、笔记、文件夹（显示笔记数）、标签（显示笔记数）、命令。图标留空自动匹配，也可以填一个表情或 Lucide 图标名。记得在下方“模块开关”里打开“自定义面板”"
      : "Panels of your own, one card each. An item can be a web link, a note, a folder (shows its note count), a tag (note count) or a command. Leave the icon empty to pick one automatically, or give an emoji / Lucide icon name. Turn the “Custom panels” module on below"
  );
  const kinds: Array<[CustomItemKind, string]> = [
    ["link", cn ? "网页链接" : "Web link"],
    ["note", cn ? "笔记" : "Note"],
    ["folder", cn ? "文件夹（计数）" : "Folder (count)"],
    ["tag", cn ? "标签（计数）" : "Tag (count)"],
    ["command", cn ? "命令" : "Command"],
  ];
  const placeholder: Record<CustomItemKind, string> = {
    link: "https://…",
    note: cn ? "笔记路径，如 Note/INDEX" : "Note path, e.g. Notes/Index",
    folder: cn ? "文件夹路径，如 Note" : "Folder path, e.g. Notes",
    tag: cn ? "标签，如 #ml" : "Tag, e.g. #ml",
    command: cn ? "命令 id，如 daily-notes" : "Command id, e.g. daily-notes",
  };

  s.customPanels.forEach((panel, pi) => {
    const head = new Setting(containerEl).setClass("ed-settings-panel-head");
    head.addText((tx) => {
      tx.setPlaceholder(cn ? "面板标题" : "Panel title").setValue(panel.title).onChange(async (v) => {
        panel.title = v;
        await commit();
      });
      tx.inputEl.style.width = "220px";
      tx.inputEl.style.fontWeight = "700";
    });
    head.addExtraButton((b) =>
      b.setIcon("chevron-up").setTooltip(cn ? "上移" : "Move up").setDisabled(pi === 0).onClick(async () => {
        [s.customPanels[pi - 1], s.customPanels[pi]] = [s.customPanels[pi], s.customPanels[pi - 1]];
        await redraw();
      })
    );
    head.addExtraButton((b) =>
      b
        .setIcon("chevron-down")
        .setTooltip(cn ? "下移" : "Move down")
        .setDisabled(pi === s.customPanels.length - 1)
        .onClick(async () => {
          [s.customPanels[pi + 1], s.customPanels[pi]] = [s.customPanels[pi], s.customPanels[pi + 1]];
          await redraw();
        })
    );
    head.addExtraButton((b) =>
      b.setIcon("trash-2").setTooltip(cn ? "删除面板" : "Delete panel").onClick(async () => {
        s.customPanels.splice(pi, 1);
        await redraw();
      })
    );

    panel.items.forEach((item, ii) => {
      const row = new Setting(containerEl).setClass("ed-settings-item-row");
      row.addText((tx) => {
        tx.setPlaceholder(cn ? "图标" : "Icon").setValue(item.icon).onChange(async (v) => {
          item.icon = v.trim();
          await commit();
        });
        tx.inputEl.style.width = "64px";
      });
      row.addText((tx) => {
        tx.setPlaceholder(cn ? "名称" : "Label").setValue(item.label).onChange(async (v) => {
          item.label = v;
          await commit();
        });
        tx.inputEl.style.width = "130px";
      });
      let targetInput: HTMLInputElement | null = null;
      row.addDropdown((d) => {
        for (const [k, label] of kinds) d.addOption(k, label);
        d.setValue(item.kind).onChange(async (v) => {
          item.kind = v as CustomItemKind;
          if (targetInput) targetInput.placeholder = placeholder[item.kind];
          await commit();
        });
      });
      row.addText((tx) => {
        targetInput = tx.inputEl;
        tx.setPlaceholder(placeholder[item.kind]).setValue(item.target).onChange(async (v) => {
          item.target = v.trim();
          await commit();
        });
        tx.inputEl.style.width = "220px";
      });
      row.addExtraButton((b) =>
        b.setIcon("chevron-up").setTooltip(cn ? "上移" : "Move up").setDisabled(ii === 0).onClick(async () => {
          [panel.items[ii - 1], panel.items[ii]] = [panel.items[ii], panel.items[ii - 1]];
          await redraw();
        })
      );
      row.addExtraButton((b) =>
        b
          .setIcon("chevron-down")
          .setTooltip(cn ? "下移" : "Move down")
          .setDisabled(ii === panel.items.length - 1)
          .onClick(async () => {
            [panel.items[ii + 1], panel.items[ii]] = [panel.items[ii], panel.items[ii + 1]];
            await redraw();
          })
      );
      row.addExtraButton((b) =>
        b.setIcon("x").setTooltip(cn ? "删除" : "Delete").onClick(async () => {
          panel.items.splice(ii, 1);
          await redraw();
        })
      );
    });
    new Setting(containerEl).setClass("ed-settings-item-add").addButton((b) =>
      b.setButtonText(cn ? "+ 添加项目" : "+ Add item").onClick(async () => {
        panel.items.push({ id: newId(), label: "", icon: "", kind: "link", target: "" });
        await redraw();
      })
    );
  });
  new Setting(containerEl).addButton((b) =>
    b
      .setButtonText(cn ? "+ 新建面板" : "+ New panel")
      .setCta()
      .onClick(async () => {
        s.customPanels.push({ id: newId(), title: "", items: [] });
        await redraw();
      })
  );
}

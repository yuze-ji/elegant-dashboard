import { Setting } from "obsidian";
import { newId } from "../types";
import { BUNDLED_BACKGROUND, GRADIENT_BACKGROUND } from "../settings";
import type { DashboardSettingTab } from "../settings";

export function renderAppearanceSettings(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  new Setting(containerEl).setName(cn ? "外观" : "Appearance").setHeading();

  new Setting(containerEl)
    .setName(cn ? "Overview 布局" : "Overview layout")
    .setDesc(
      cn
        ? "一屏网格 = 所有模块排进一屏的固定网格，卡片内部滚动，像一个首页；逐行 = 原来的上下堆叠，整页滚动"
        : "One-screen grid = every module in a fixed grid that fits the window, cards scrolling inside, like a home page; Rows = the original stacked rows, scrolling as a page"
    )
    .addDropdown((d) =>
      d
        .addOption("home", cn ? "首页" : "Home page")
        .addOption("grid", cn ? "一屏网格" : "One-screen grid")
        .addOption("rows", cn ? "逐行" : "Rows")
        .setValue(tab.plugin.settings.overviewLayout)
        .onChange(async (v) => {
          tab.plugin.settings.overviewLayout =
            v === "rows" ? "rows" : v === "grid" ? "grid" : "home";
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
          tab.display();
        })
    );

  if (tab.plugin.settings.overviewLayout === "home") {
    new Setting(containerEl)
      .setName(cn ? "首页横幅图片" : "Home banner image")
      .setDesc(
        cn
          ? "URL 或库内路径；留空用自带的莫奈，填 @gradient 用渐变色带"
          : "URL or vault path; empty = the bundled Monet, @gradient = a gradient band"
      )
      .addText((tx) => {
        tx.setPlaceholder("attachments/banner.jpg");
        tx.setValue(tab.plugin.settings.homeBanner).onChange(async (v) => {
          tab.plugin.settings.homeBanner = v.trim();
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        });
        tx.inputEl.style.width = "280px";
      });
    new Setting(containerEl)
      .setName(cn ? "首页标语" : "Home motto")
      .setDesc(cn ? "头像旁的一句话；留空用默认" : "The line beside the avatar; empty = default")
      .addText((tx) => {
        tx.setValue(tab.plugin.settings.homeMotto).onChange(async (v) => {
          tab.plugin.settings.homeMotto = v;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        });
        tx.inputEl.style.width = "280px";
      });
    new Setting(containerEl)
      .setName(cn ? "首页头像" : "Home avatar")
      .setDesc(cn ? "图片 URL / 库内路径，或一个表情、一两个字" : "Image URL / vault path, or an emoji / a letter or two")
      .addText((tx) => {
        tx.setValue(tab.plugin.settings.homeAvatar).onChange(async (v) => {
          tab.plugin.settings.homeAvatar = v;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        });
        tx.inputEl.style.width = "280px";
      });
  }
  renderHomeLinks(tab, containerEl, cn);

  new Setting(containerEl)
    .setName(cn ? "背景图片" : "Background image")
    .setDesc(
      cn
        ? "可填网址或库内相对路径；留空则不显示背景图。“渐变”是不用图片的柔和底色"
        : "A URL or a vault-relative path; leave empty to disable. “Gradient” is a soft colour wash with no image"
    )
    .addText((tx) => {
      tx.setPlaceholder("https://… / path/to/image.jpg")
        .setValue(tab.plugin.settings.backgroundImage)
        .onChange(async (v) => {
          tab.plugin.settings.backgroundImage = v.trim();
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        });
      tx.inputEl.style.width = "260px";
    })
    .addButton((btn) =>
      btn
        .setButtonText(cn ? "莫奈睡莲" : "Monet")
        .setTooltip(
          cn
            ? "使用插件内置的《睡莲》(1906) 图片"
            : "Use the bundled Water Lilies (1906) image"
        )
        .onClick(async () => {
          tab.plugin.settings.backgroundImage = BUNDLED_BACKGROUND;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
          tab.display();
        })
    )
    .addButton((btn) =>
      btn
        .setButtonText(cn ? "渐变" : "Gradient")
        .setTooltip(cn ? "柔和的绿-蓝-紫渐变底色，不用图片" : "A soft green-blue-lavender wash, no image")
        .onClick(async () => {
          tab.plugin.settings.backgroundImage = GRADIENT_BACKGROUND;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
          tab.display();
        })
    )
    .addButton((btn) =>
      btn
        .setButtonText(cn ? "清除" : "Clear")
        .onClick(async () => {
          tab.plugin.settings.backgroundImage = "";
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
          tab.display();
        })
    );

  new Setting(containerEl)
    .setName(cn ? "背景透明度" : "Background opacity")
    .addSlider((s) =>
      s
        .setLimits(0, 1, 0.02)
        .setValue(tab.plugin.settings.backgroundOpacity)
        .setDynamicTooltip()
        .onChange(async (v) => {
          tab.plugin.settings.backgroundOpacity = v;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName(cn ? "背景模糊" : "Background blur")
    .setDesc(cn ? "0 = 清晰；20 左右是柔和的虚化" : "0 = sharp; around 20 is a soft blur")
    .addSlider((s) =>
      s
        .setLimits(0, 40, 1)
        .setValue(tab.plugin.settings.backgroundBlur)
        .setDynamicTooltip()
        .onChange(async (v) => {
          tab.plugin.settings.backgroundBlur = v;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName(cn ? "液态玻璃" : "Liquid glass")
    .setDesc(
      cn
        ? "开：毛玻璃卡片（背景模糊、色彩增强、边缘高光）；关：和首页头部一致的白底实心卡片"
        : "On: frosted panels (backdrop blur, saturation boost, specular edges). Off: solid white cards matching the home header"
    )
    .addToggle((tg) =>
      tg.setValue(tab.plugin.settings.liquidGlass).onChange(async (v) => {
        tab.plugin.settings.liquidGlass = v;
        await tab.plugin.saveSettings();
        tab.plugin.refreshViews();
      })
    );

  new Setting(containerEl)
    .setName(cn ? "玻璃模糊强度" : "Glass blur")
    .setDesc(cn ? "数值越大越朦胧" : "Higher is hazier")
    .addSlider((s) =>
      s
        .setLimits(0, 60, 2)
        .setValue(tab.plugin.settings.glassBlur)
        .setDynamicTooltip()
        .onChange(async (v) => {
          tab.plugin.settings.glassBlur = v;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        })
    );

  new Setting(containerEl)
    .setName(cn ? "模块卡片不透明度" : "Card opacity")
    .setDesc(
      cn
        ? "0 = 卡片完全透明（背景图直接透出），1 = 完整绿色玻璃质感"
        : "0 = fully transparent cards, 1 = full green glass tint"
    )
    .addSlider((s) =>
      s
        .setLimits(0, 1, 0.05)
        .setValue(tab.plugin.settings.cardOpacity)
        .setDynamicTooltip()
        .onChange(async (v) => {
          tab.plugin.settings.cardOpacity = v;
          await tab.plugin.saveSettings();
          tab.plugin.refreshViews();
        })
    );
}

/**
 * Bookmarks for the home page: label + URL per row, reorder, delete, add.
 * A URL may be http(s)://, obsidian://, mailto:, or a vault note path.
 */
export function renderHomeLinks(tab: DashboardSettingTab, containerEl: HTMLElement, cn: boolean) {
  const s = tab.plugin.settings;
  const commit = async () => {
    await tab.plugin.saveSettings();
    tab.plugin.refreshViews();
  };
  new Setting(containerEl)
    .setName(cn ? "常用站点" : "Sites")
    .setDesc(
      cn
        ? "“常用站点”模块里的书签（模块开关在下方）。网址填 https://…、obsidian://… 或库内笔记路径；名称以表情开头可自定义图标"
        : "Bookmarks for the Sites module (toggle it below). A URL can be https://…, obsidian://…, or a vault note path; start the label with an emoji to pick your own mark"
    );
  s.homeLinks.forEach((link, i) => {
    const row = new Setting(containerEl).setName("");
    row.addText((tx) => {
      tx.setPlaceholder(cn ? "名称" : "Label").setValue(link.label).onChange(async (v) => {
        link.label = v;
        await commit();
      });
      tx.inputEl.style.width = "140px";
    });
    row.addText((tx) => {
      tx.setPlaceholder("https://…").setValue(link.url).onChange(async (v) => {
        link.url = v.trim();
        await commit();
      });
      tx.inputEl.style.width = "260px";
    });
    row.addExtraButton((b) =>
      b
        .setIcon("chevron-up")
        .setTooltip(cn ? "上移" : "Move up")
        .setDisabled(i === 0)
        .onClick(async () => {
          [s.homeLinks[i - 1], s.homeLinks[i]] = [s.homeLinks[i], s.homeLinks[i - 1]];
          await commit();
          tab.display();
        })
    );
    row.addExtraButton((b) =>
      b
        .setIcon("chevron-down")
        .setTooltip(cn ? "下移" : "Move down")
        .setDisabled(i === s.homeLinks.length - 1)
        .onClick(async () => {
          [s.homeLinks[i + 1], s.homeLinks[i]] = [s.homeLinks[i], s.homeLinks[i + 1]];
          await commit();
          tab.display();
        })
    );
    row.addExtraButton((b) =>
      b
        .setIcon("trash-2")
        .setTooltip(cn ? "删除" : "Delete")
        .onClick(async () => {
          s.homeLinks.splice(i, 1);
          await commit();
          tab.display();
        })
    );
  });
  new Setting(containerEl).addButton((b) =>
    b.setButtonText(cn ? "+ 添加链接" : "+ Add link").onClick(async () => {
      s.homeLinks.push({ id: newId(), label: "", url: "" });
      await commit();
      tab.display();
    })
  );
}

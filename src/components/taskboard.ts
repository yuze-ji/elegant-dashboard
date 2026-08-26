import { drawRing, themeColors, withAlpha } from "../charts";
import { Ctx, card } from "../ui";

const RING_SIZE = 34;

export function renderTaskboard(
  parent: HTMLElement,
  ctx: Ctx,
  counts: { today: number; week: number; month: number }
) {
  const { t, settings } = ctx;
  const root = card(parent, `📊 ${t.taskboard}`);

  const items = [
    { label: t.today, completed: counts.today, target: settings.taskTargetToday, color: "#E7BA86" },
    { label: t.week, completed: counts.week, target: settings.taskTargetWeek, color: "#829E8F" },
    { label: t.month, completed: counts.month, target: settings.taskTargetMonth, color: "#DDA3A2" },
  ];

  const colors = themeColors();
  const row = root.createDiv({ cls: "ed-taskboard-row" });

  for (const item of items) {
    const col = row.createDiv({ cls: "ed-taskboard-col" });
    const canvas = col.createEl("canvas");
    const target = Math.max(1, item.target);
    const ratio = Math.min(item.completed / target, 1);
    drawRing(canvas, RING_SIZE, ratio, item.color, withAlpha(colors.border, 0.9));

    const text = col.createDiv({ cls: "ed-taskboard-text" });
    text.createDiv({ cls: "ed-taskboard-label", text: item.label });
    text.createDiv({
      cls: "ed-taskboard-value",
      text: `✓ ${item.completed} / ${item.target}`,
    });
  }
}

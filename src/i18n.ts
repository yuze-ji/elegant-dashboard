import { Lang } from "./types";

export interface Strings {
  dashboard: string;
  noteActivity: string;
  projectsBoard: string;
  taskboard: string;
  taskDetails: string;
  focusSession: string;
  today: string;
  todo: string;
  done: string;
  week: string;
  month: string;
  projects: string;
  tasks: string;
  overview: string;
  allProjects: string;
  allTasks: string;
  openNote: string;
  focus: string;
  focusHistory: string;
  totalFocus: string;
  avgPerDay: string;
  bestDay: string;
  streak: string;
  activeDaysShort: string;
  noFocusData: string;
  hoursUnit: string;
  daysUnit: string;
  recentEdited: string;
  totalNotes: string;
  totalWords: string;
  totalLinks: string;
  last365days: string;
  noTodayTasks: string;
  noTodoTasks: string;
  noDoneTasks: string;
  noProjects: string;
  wordTrend: string;
  tagRatio: string;
  noTags: string;
  wordsUnit: string;
  notesUnit: string;
  weekView: string;
  monthView: string;
  yearView: string;
  less: string;
  more: string;
  activeDays: string;
  fileUpdates: string;
  newNotes: string;
  fileActivity: string;
  added: string;
  andMore: (n: number) => string;
  minutesFocused: string;
  countdownMode: string;
  accumulateMode: string;
  setLabel: string;
  minutes: string;
  minuteUnit: string;
  todayFocus: string;
  monthTotal: string;
  start: string;
  pause: string;
  reset: string;
  refresh: string;
  countdownLabel: string;
  accumulateLabel: string;
  focusDone: (m: number) => string;
  focusSaved: (m: number) => string;
  focusRangeError: string;
  focusSetTo: (m: number) => string;
  stopBeforeSwitch: string;
  switchedTo: (mode: string) => string;
  clock: string;
  am: string;
  pm: string;
  alarms: string;
  addAlarm: string;
  noAlarms: string;
  alarmUntitled: string;
  alarmLabelPlaceholder: string;
  alarmEveryDay: string;
  alarmOff: string;
  alarmDelete: string;
  alarmStop: string;
  alarmInvalidTime: string;
  alarmNextIn: (h: number, m: number) => string;
  alarmRinging: (time: string, label: string) => string;
  deadlines: string;
  noDeadlines: string;
  addDeadline: string;
  deadlineAddPlaceholder: string;
  deadlineDelete: string;
  deadlineToday: string;
  deadlineDaysLeft: (n: number) => string;
  deadlineOverdue: (n: number) => string;
  habits: string;
  noHabits: string;
  addHabit: string;
  habitAddPlaceholder: string;
  habitDelete: string;
  weekdayShort: string[];
  weekdayFull: string[];
  monthNames: string[];
  formatDayTitle: (month: number, day: number) => string;
  formatMonthTitle: (y: number, m: number) => string;
  formatRange: (a: Date, b: Date) => string;
}

const pad = (n: number) => String(n);

export const I18N: Record<Lang, Strings> = {
  cn: {
    dashboard: "仪表板",
    noteActivity: "笔记活动",
    projectsBoard: "项目概览",
    taskboard: "任务统计",
    taskDetails: "任务详情",
    focusSession: "专注时段",
    today: "今日",
    todo: "待办",
    done: "完成",
    week: "本周",
    month: "本月",
    projects: "项目",
    tasks: "任务",
    overview: "总览",
    allProjects: "全部项目",
    allTasks: "全部任务",
    openNote: "打开源笔记",
    focus: "专注",
    focusHistory: "专注时长变化",
    totalFocus: "累计专注",
    avgPerDay: "日均",
    bestDay: "最高单日",
    streak: "连续专注",
    activeDaysShort: "专注天数",
    noFocusData: "还没有专注记录，用计时器开始第一段专注吧",
    hoursUnit: "小时",
    daysUnit: "天",
    recentEdited: "最近编辑",
    totalNotes: "总笔记数量",
    totalWords: "总字数",
    totalLinks: "总链接数",
    last365days: "最近 365 天",
    noTodayTasks: "暂无今日任务",
    noTodoTasks: "没有待办任务",
    noDoneTasks: "还没有完成的任务",
    noProjects: "暂无进行中的项目",
    wordTrend: "近 12 个月字数趋势",
    tagRatio: "标签占比",
    noTags: "暂无标签",
    wordsUnit: "字",
    notesUnit: "篇",
    weekView: "周",
    monthView: "月",
    yearView: "年",
    less: "少",
    more: "多",
    activeDays: "个活跃日",
    fileUpdates: "次文件活动",
    newNotes: "篇新增",
    fileActivity: "次文件活动",
    added: "新增",
    andMore: (n) => `…等 ${n} 篇`,
    minutesFocused: "分钟专注",
    countdownMode: "⏱️ 倒计时",
    accumulateMode: "⏲️ 累加",
    setLabel: "设置:",
    minutes: "分钟",
    minuteUnit: "分钟",
    todayFocus: "今日专注",
    monthTotal: "本月统计",
    start: "▶ 开始",
    pause: "⏸ 暂停",
    reset: "↻ 重置",
    refresh: "刷新",
    countdownLabel: "倒计时",
    accumulateLabel: "累加中",
    focusDone: (m) => `🎉 专注时间完成！已记录 ${m} 分钟`,
    focusSaved: (m) => `✅ 已保存累加时间：${m} 分钟`,
    focusRangeError: "请输入 1-180 分钟之间的时间",
    focusSetTo: (m) => `⏱️ 已设置专注时间为 ${m} 分钟`,
    stopBeforeSwitch: "请先停止计时器再切换模式",
    switchedTo: (mode) => `已切换到 ${mode}`,
    clock: "时钟",
    am: "上午",
    pm: "下午",
    alarms: "闹钟",
    addAlarm: "+ 添加",
    noAlarms: "还没有闹钟，点「添加」创建一个",
    alarmUntitled: "闹钟",
    alarmLabelPlaceholder: "标签（可选）",
    alarmEveryDay: "每天",
    alarmOff: "已关闭",
    alarmDelete: "删除闹钟",
    alarmStop: "停止",
    alarmInvalidTime: "请输入有效时间（HH:MM）",
    alarmNextIn: (h, m) =>
      h > 0 ? `${h} 小时 ${m} 分钟后响铃` : `${m} 分钟后响铃`,
    alarmRinging: (time, label) => `⏰ ${time} — ${label}`,
    deadlines: "日程倒计时",
    noDeadlines: "还没有日程，添加一个截止日期吧",
    addDeadline: "+ 添加",
    deadlineAddPlaceholder: "事项名称…",
    deadlineDelete: "删除日程",
    deadlineToday: "今天",
    deadlineDaysLeft: (n) => `还有 ${n} 天`,
    deadlineOverdue: (n) => `已过期 ${n} 天`,
    habits: "习惯追踪",
    noHabits: "还没有习惯，添加一个开始打卡吧",
    addHabit: "+ 添加",
    habitAddPlaceholder: "习惯名称…",
    habitDelete: "删除习惯",
    weekdayShort: ["一", "二", "三", "四", "五", "六", "日"],
    weekdayFull: ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"],
    monthNames: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    formatDayTitle: (m, d) => `${m}月${d}日`,
    formatMonthTitle: (y, m) => `${y}年${m}月`,
    formatRange: (a, b) =>
      `${a.getMonth() + 1}月${a.getDate()}日 — ${b.getMonth() + 1}月${b.getDate()}日`,
  },
  en: {
    dashboard: "Dashboard",
    noteActivity: "Note Activity",
    projectsBoard: "Projects Board",
    taskboard: "Taskboard",
    taskDetails: "Task Details",
    focusSession: "Focus Session",
    today: "Today",
    todo: "Todo",
    done: "Done",
    week: "Week",
    month: "Month",
    projects: "Projects",
    tasks: "Tasks",
    overview: "Overview",
    allProjects: "All Projects",
    allTasks: "All Tasks",
    openNote: "Open source note",
    focus: "Focus",
    focusHistory: "Focus Time Trend",
    totalFocus: "Total",
    avgPerDay: "Daily avg",
    bestDay: "Best day",
    streak: "Streak",
    activeDaysShort: "Focus days",
    noFocusData: "No focus sessions yet — start the timer to record your first one",
    hoursUnit: "h",
    daysUnit: "d",
    recentEdited: "Recently Edited",
    totalNotes: "Total Notes",
    totalWords: "Total Words",
    totalLinks: "Total Links",
    last365days: "Last 365 Days",
    noTodayTasks: "No tasks today",
    noTodoTasks: "No tasks",
    noDoneTasks: "No completed tasks",
    noProjects: "No ongoing projects",
    wordTrend: "Last 12 Months Words",
    tagRatio: "Tag Distribution",
    noTags: "No tags",
    wordsUnit: "words",
    notesUnit: "notes",
    weekView: "W",
    monthView: "M",
    yearView: "Y",
    less: "Less",
    more: "More",
    activeDays: "active days",
    fileUpdates: "file updates",
    newNotes: "new notes",
    fileActivity: "file updates",
    added: "Added",
    andMore: (n) => `…and ${n} more`,
    minutesFocused: "min focused",
    countdownMode: "⏱️ Countdown",
    accumulateMode: "⏲️ Accumulate",
    setLabel: "Set:",
    minutes: "min",
    minuteUnit: "min",
    todayFocus: "Today Focus",
    monthTotal: "Month Total",
    start: "▶ Start",
    pause: "⏸ Pause",
    reset: "↻ Reset",
    refresh: "Refresh",
    countdownLabel: "Countdown",
    accumulateLabel: "Accumulate",
    focusDone: (m) => `🎉 Focus completed! Recorded ${m} min`,
    focusSaved: (m) => `✅ Saved accumulated time: ${m} min`,
    focusRangeError: "Please enter a time between 1-180 minutes",
    focusSetTo: (m) => `⏱️ Focus time set to ${m} min`,
    stopBeforeSwitch: "Please stop the timer before switching mode",
    switchedTo: (mode) => `Switched to ${mode}`,
    clock: "Clock",
    am: "AM",
    pm: "PM",
    alarms: "Alarms",
    addAlarm: "+ Add",
    noAlarms: "No alarms yet — hit Add to create one",
    alarmUntitled: "Alarm",
    alarmLabelPlaceholder: "Label (optional)",
    alarmEveryDay: "Every day",
    alarmOff: "Off",
    alarmDelete: "Delete alarm",
    alarmStop: "Stop",
    alarmInvalidTime: "Enter a valid time (HH:MM)",
    alarmNextIn: (h, m) => (h > 0 ? `rings in ${h}h ${m}m` : `rings in ${m}m`),
    alarmRinging: (time, label) => `⏰ ${time} — ${label}`,
    deadlines: "Deadlines",
    noDeadlines: "No deadlines yet — add one to start the countdown",
    addDeadline: "+ Add",
    deadlineAddPlaceholder: "What's due…",
    deadlineDelete: "Delete deadline",
    deadlineToday: "Today",
    deadlineDaysLeft: (n) => `${n} day${n === 1 ? "" : "s"} left`,
    deadlineOverdue: (n) => `${n} day${n === 1 ? "" : "s"} overdue`,
    habits: "Habits",
    noHabits: "No habits yet — add one to start tracking",
    addHabit: "+ Add",
    habitAddPlaceholder: "Habit name…",
    habitDelete: "Delete habit",
    weekdayShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekdayFull: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    formatDayTitle: (m, d) => `${m}/${d}`,
    formatMonthTitle: (y, m) => `${y}-${pad(m)}`,
    formatRange: (a, b) =>
      `${a.getMonth() + 1}/${a.getDate()} — ${b.getMonth() + 1}/${b.getDate()}`,
  },
};

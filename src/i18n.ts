import { Lang } from "./types";

export interface Strings {
  dashboard: string;
  noteActivity: string;
  projectsBoard: string;
  ganttTitle: string;
  ganttNoDates: string;
  taskboard: string;
  taskDetails: string;
  focusSession: string;
  focusTargetLabel: string;
  focusNoTarget: string;
  focusTargetTasks: string;
  focusTargetProjects: string;
  focusTargetHabits: string;
  focusTargetTotal: (min: number) => string;
  focusPlay: string;
  focusStartedOn: (name: string) => string;
  focusBreakdown: string;
  focusUnattributed: string;
  focusTargetGone: string;
  minuteUnitShort: string;
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
  taskArchived: (n: number) => string;
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
  pomodoroMode: string;
  pomodoroSkip: string;
  pomodoroWorkLabel: (round: number, total: number) => string;
  pomodoroShortLabel: string;
  pomodoroLongLabel: string;
  pomodoroWorkDone: (breakMin: number) => string;
  pomodoroCycleDone: (rounds: number, breakMin: number) => string;
  pomodoroBreakDone: (round: number, total: number) => string;
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
  alarmDaily: string;
  alarmWeekly: string;
  alarmOnce: string;
  alarmInvalidDate: string;
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
  deadlineTime: string;
  deadlineToday: string;
  deadlineDaysLeft: (n: number) => string;
  deadlineOverdue: (n: number) => string;
  deadlineRemindNone: string;
  deadlineRemindSameDay: string;
  deadlineRemindNDays: (n: number) => string;
  deadlineRemindMinutes: (n: number) => string;
  deadlineReminderNotice: (title: string, daysLeft: number) => string;
  deadlineReminderTimeNotice: (title: string, time: string, minutesLeft: number) => string;
  deadlineDone: string;
  deadlineDoneSection: (n: number) => string;
  deadlinePrepProgress: (done: number, total: number) => string;
  deadlinePrepAdd: string;
  deadlinePrepPlaceholder: string;
  icsSyncResult: (added: number, updated: number, skipped: number) => string;
  icsSyncFailed: (err: string) => string;
  noteLink: string;
  habitReminderNotice: (names: string[]) => string;
  habitReminderNoticeOne: (name: string) => string;
  habitReminderTime: string;
  habitLinkedLang: string;
  habitLinkedNone: string;
  agenda: string;
  agendaToday: string;
  agendaTomorrow: string;
  agendaNothing: string;
  habits: string;
  noHabits: string;
  addHabit: string;
  habitAddPlaceholder: string;
  habitDelete: string;
  habitTargetDaily: string;
  habitTargetPerWeek: (n: number) => string;
  habitWeekProgress: (done: number, target: number) => string;
  habitStreakWeeks: (n: number) => string;
  habitCheckinCount: (n: number) => string;
  habitCheckedIn: string;
  habitUnchecked: string;
  language: string;
  vocabDue: string;
  vocabReviewedToday: string;
  vocabNewToday: string;
  vocabGoal: (done: number, goal: number) => string;
  vocabStreak: (days: number) => string;
  vocabStartReview: string;
  vocabNothingDue: string;
  vocabNextDue: (n: number, days: number) => string;
  vocabAllDone: string;
  vocabWordPlaceholder: string;
  vocabMeaningPlaceholder: string;
  vocabExamplePlaceholder: string;
  vocabAdd: string;
  vocabAdded: (word: string) => string;
  vocabReview: string;
  vocabProgress: (done: number, total: number) => string;
  vocabReveal: string;
  vocabForgot: string;
  vocabKnew: string;
  vocabSessionDone: (right: number, total: number) => string;
  vocabWordList: string;
  vocabEmpty: string;
  vocabSearch: string;
  vocabAllLanguages: string;
  vocabBox: (box: number) => string;
  vocabMastered: string;
  vocabDueBadge: string;
  vocabDueIn: (days: number) => string;
  vocabEdit: string;
  vocabDelete: string;
  vocabDeleted: string;
  vocabReset: string;
  vocabStats: string;
  vocabTotal: string;
  vocabMasteredCount: string;
  vocabLearning: string;
  vocabLapses: (n: number) => string;
  vocabHardest: string;
  vocabBoxLegend: string;
  vocabWall: string;
  vocabWallToday: string;
  vocabWallWeek: string;
  vocabWallMonth: string;
  vocabWallAll: string;
  vocabWallEmpty: string;
  vocabWallAdded: (date: string) => string;
  vocabWallShuffle: string;
  vocabNotesTitle: string;
  vocabNotesGenerated: string;
  vocabNotesColWord: string;
  vocabNotesColMeaning: string;
  vocabNotesColExample: string;
  vocabNotesColLevel: string;
  vocabNotesColAdded: string;
  vocabNotesSynced: (written: number, langs: number) => string;
  vocabNotesFailed: (err: string) => string;
  vocabLookup: string;
  vocabLookupBusy: string;
  vocabLookupNone: string;
  vocabLookupNumber: string;
  scripts: string;
  scriptNames: { hiragana: string; katakana: string; hangul: string; hangulSyllables: string };
  scriptSections: Record<string, string>;
  scriptAccuracy: (right: number, total: number) => string;
  scriptUnseen: string;
  speak: string;
  scriptStop: string;
  scriptTest: string;
  scriptTestRange: string;
  scriptTestWeak: string;
  scriptTestMixed: string;
  scriptTestMode: string;
  scriptTestModeRead: string;
  scriptTestModeWrite: string;
  scriptTestCount: string;
  scriptTestCountAll: string;
  scriptTestStart: string;
  scriptTestEmpty: string;
  scriptTestAskRead: string;
  scriptTestAskWrite: (script: string) => string;
  scriptTestCheck: string;
  scriptTestNext: string;
  scriptTestCorrect: string;
  scriptTestWrong: (answer: string) => string;
  scriptTestDone: (right: number, total: number) => string;
  scriptTestWrongList: string;
  scriptTestAgain: string;
  vocabLookupUnknownLang: (lang: string) => string;
  todayOverview: string;
  homeMottoDefault: string;
  homeGreetingMorning: string;
  homeGreetingNoon: string;
  homeGreetingAfternoon: string;
  homeGreetingEvening: string;
  homeGreetingNight: string;
  homeLocalData: string;
  homeCounts: (openTasks: number, openDeadlines: number) => string;
  homeNewTask: string;
  homeNewDeadline: string;
  homeStartFocus: string;
  homeTools: string;
  homeLinks: string;
  linksEmpty: string;
  homeWebLinks: string;
  homeRefreshed: string;
  linksAddLabel: string;
  linksAddUrl: string;
  linksDelete: string;
  linksDeletedNotice: string;
  linksHint: string;
  customPanels: string;
  customPanelsEmpty: string;
  customPanelNoItems: string;
  homeSyncCalendar: string;
  homeBackupNow: string;
  homeSettings: string;
  homeKpiTasks: string;
  homeKpiTasksSub: (open: number, overdue: number) => string;
  homeKpiDeadlines: string;
  homeKpiDeadlinesSub: (title: string, open: number, overdue: number) => string;
  homeKpiFocus: string;
  homeKpiFocusSub: (monthHours: number, goal: number) => string;
  homeKpiHabits: string;
  homeKpiHabitsSub: (left: number) => string;
  todayTasksLeft: (n: number) => string;
  todayHabitsLeft: (n: number) => string;
  todayDeadlinesOverdue: (n: number) => string;
  todayAllDone: string;
  undo: string;
  quickAddedTask: (text: string) => string;
  quickAddedDeadline: (title: string, date: string) => string;
  quickAddInvalid: string;
  taskRepeatedNotice: (nextDue: string) => string;
  taskDeleted: string;
  projectDeleted: string;
  deadlineDeletedNotice: string;
  habitDeleted: string;
  alarmDeleted: string;
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
    ganttTitle: "项目甘特图",
    ganttNoDates: "还没有项目设置截止日期——设置一个才会出现在这里",
    taskboard: "任务统计",
    taskDetails: "任务详情",
    focusSession: "专注时段",
    focusTargetLabel: "专注于",
    focusNoTarget: "不关联",
    focusTargetTasks: "任务",
    focusTargetProjects: "项目",
    focusTargetHabits: "习惯",
    focusTargetTotal: (min) => `已累计 ${min} 分钟`,
    focusPlay: "开始专注",
    focusStartedOn: (name) => `▶ 开始专注：${name}`,
    focusBreakdown: "时间去向",
    focusUnattributed: "未关联的专注",
    focusTargetGone: "（已删除）",
    minuteUnitShort: "分",
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
    taskArchived: (n) => `更早完成的 ${n} 项`,
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
    pomodoroMode: "🍅 番茄",
    pomodoroSkip: "跳过",
    pomodoroWorkLabel: (round, total) => `第 ${round}/${total} 轮 · 工作`,
    pomodoroShortLabel: "短休息",
    pomodoroLongLabel: "长休息",
    pomodoroWorkDone: (breakMin) => `🍅 工作结束，休息 ${breakMin} 分钟`,
    pomodoroCycleDone: (rounds, breakMin) => `🍅 ${rounds} 轮完成！长休息 ${breakMin} 分钟`,
    pomodoroBreakDone: (round, total) => `🍅 休息结束，开始第 ${round}/${total} 轮`,
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
    alarmDaily: "每天",
    alarmWeekly: "每周",
    alarmOnce: "单次",
    alarmInvalidDate: "请选择单次闹钟的日期",
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
    deadlineTime: "具体时间（可选）",
    deadlineToday: "今天",
    deadlineDaysLeft: (n) => `还有 ${n} 天`,
    deadlineOverdue: (n) => `已过期 ${n} 天`,
    deadlineRemindNone: "不提醒",
    deadlineRemindSameDay: "当天提醒",
    deadlineRemindNDays: (n) => `提前 ${n} 天`,
    deadlineRemindMinutes: (n) => (n % 60 === 0 ? `提前 ${n / 60} 小时` : `提前 ${n} 分钟`),
    deadlineReminderNotice: (title, daysLeft) =>
      daysLeft === 0
        ? `⏳ 「${title}」就是今天`
        : `⏳ 「${title}」还有 ${daysLeft} 天`,
    deadlineReminderTimeNotice: (title, time, minutesLeft) =>
      `⏳ 「${title}」${time} 开始，还有 ${minutesLeft} 分钟`,
    deadlineDone: "标记完成",
    deadlineDoneSection: (n) => `已完成 ${n} 项`,
    deadlinePrepProgress: (done, total) => `准备任务 ${done}/${total}，点击展开`,
    deadlinePrepAdd: "添加准备任务",
    deadlinePrepPlaceholder: "准备任务，如“复习第 1 章”…",
    icsSyncResult: (added, updated, skipped) =>
      `📅 日历同步：新增 ${added}，更新 ${updated}，跳过 ${skipped}`,
    icsSyncFailed: (err) => `⚠️ 日历同步失败：${err}`,
    noteLink: "关联笔记",
    habitReminderNotice: (names) => `🔥 还没打卡：${names.join("、")}`,
    habitReminderNoticeOne: (name) => `🔥 该打卡了：${name}`,
    habitReminderTime: "单独提醒时间（可选）",
    habitLinkedLang: "关联语言：在语言学习板块学习该语言时自动打卡",
    habitLinkedNone: "不关联",
    agenda: "未来 7 天",
    agendaToday: "今天",
    agendaTomorrow: "明天",
    agendaNothing: "没有安排",
    habits: "习惯追踪",
    noHabits: "还没有习惯，添加一个开始打卡吧",
    addHabit: "+ 添加",
    habitAddPlaceholder: "习惯名称…",
    habitDelete: "删除习惯",
    habitTargetDaily: "每天",
    habitTargetPerWeek: (n) => `每周 ${n} 次`,
    habitWeekProgress: (done, target) => `本周 ${done}/${target}`,
    habitStreakWeeks: (n) => `🔥 连续 ${n} 周`,
    habitCheckinCount: (n) => `共 ${n} 次打卡`,
    habitCheckedIn: "已打卡",
    habitUnchecked: "未打卡",
    language: "语言学习",
    vocabDue: "待复习",
    vocabReviewedToday: "今日已复习",
    vocabNewToday: "今日新词",
    vocabGoal: (done, goal) => `${done}/${goal}`,
    vocabStreak: (days) => `🔥 连续 ${days} 天`,
    vocabStartReview: "开始复习",
    vocabNothingDue: "今天没有待复习的单词",
    vocabNextDue: (n, days) => (days === 1 ? `明天有 ${n} 个到期` : `${days} 天后有 ${n} 个到期`),
    vocabAllDone: "今天的复习完成了 🎉",
    vocabWordPlaceholder: "单词或中文（回车自动翻译）…",
    vocabMeaningPlaceholder: "释义…",
    vocabExamplePlaceholder: "例句（可选）…",
    vocabAdd: "+ 添加",
    vocabAdded: (word) => `已添加单词：${word}`,
    vocabReview: "复习",
    vocabProgress: (done, total) => `${done} / ${total}`,
    vocabReveal: "显示答案",
    vocabForgot: "忘了",
    vocabKnew: "记得",
    vocabSessionDone: (right, total) => `本轮 ${total} 张，答对 ${right} 张`,
    vocabWordList: "单词本",
    vocabEmpty: "还没有单词，添加一个开始背吧",
    vocabSearch: "搜索单词或释义…",
    vocabAllLanguages: "全部语言",
    vocabBox: (box) => `第 ${box} 级`,
    vocabMastered: "已掌握",
    vocabDueBadge: "待复习",
    vocabDueIn: (days) => (days === 1 ? "明天" : `${days} 天后`),
    vocabEdit: "编辑单词",
    vocabDelete: "删除单词",
    vocabDeleted: "已删除单词",
    vocabReset: "重新学习",
    vocabStats: "学习统计",
    vocabTotal: "总词数",
    vocabMasteredCount: "已掌握",
    vocabLearning: "学习中",
    vocabLapses: (n) => `错 ${n} 次`,
    vocabHardest: "最常错",
    vocabBoxLegend: "各级分布（左新右熟）",
    vocabWall: "单词墙",
    vocabWallToday: "今天",
    vocabWallWeek: "本周",
    vocabWallMonth: "本月",
    vocabWallAll: "全部",
    vocabWallEmpty: "这段时间还没添加单词",
    vocabWallAdded: (date) => `添加于 ${date}`,
    vocabWallShuffle: "打乱",
    vocabNotesTitle: "词汇表",
    vocabNotesGenerated: "此笔记由 Elegant Dashboard 自动生成，每次单词本变动都会整篇重写，请在仪表盘里编辑单词。",
    vocabNotesColWord: "单词",
    vocabNotesColMeaning: "释义",
    vocabNotesColExample: "例句",
    vocabNotesColLevel: "等级",
    vocabNotesColAdded: "添加日期",
    vocabNotesSynced: (written, langs) => `词汇表已同步：${langs} 种语言，更新了 ${written} 篇笔记`,
    vocabNotesFailed: (err) => `词汇表同步失败：${err}`,
    vocabLookup: "查词",
    vocabLookupBusy: "查询中…",
    vocabLookupNone: "没查到，请手动填写释义",
    vocabLookupNumber: "数字和符号没法翻译，请输入词语，比如「一」",
    scripts: "假名 / 谚文",
    scriptNames: { hiragana: "平假名", katakana: "片假名", hangul: "韩语字母", hangulSyllables: "韩语拼读" },
    scriptSections: {
      gojuon: "五十音",
      dakuten: "浊音 / 半浊音",
      yoon: "拗音",
      consonants: "基本辅音",
      doubleConsonants: "双辅音",
      vowels: "基本元音",
      compoundVowels: "复合元音",
      syllables: "辅音 × 元音（行：辅音，列：元音）",
    },
    scriptAccuracy: (right, total) => `${right}/${total} 正确`,
    scriptUnseen: "还没测过",
    speak: "点击朗读",
    scriptStop: "结束",
    scriptTest: "假名 / 谚文测试",
    scriptTestRange: "范围",
    scriptTestWeak: "只测薄弱",
    scriptTestMixed: "混合",
    scriptTestMode: "方式",
    scriptTestModeRead: "看字写读音",
    scriptTestModeWrite: "看读音写字",
    scriptTestCount: "题量",
    scriptTestCountAll: "全部",
    scriptTestStart: "开始测试",
    scriptTestEmpty: "这个范围里没有可测的字",
    scriptTestAskRead: "写出读音（罗马音）",
    scriptTestAskWrite: (script) => `写出${script}`,
    scriptTestCheck: "判分",
    scriptTestNext: "下一题",
    scriptTestCorrect: "✓ 正确",
    scriptTestWrong: (answer) => `✗ 答案：${answer}`,
    scriptTestDone: (right, total) => `${total} 题，答对 ${right} 题`,
    scriptTestWrongList: "错题",
    scriptTestAgain: "再测一次错题",
    vocabLookupUnknownLang: (lang) => `不认识语言「${lang}」，请在设置里用 Deutsch / English / 日本語 / 한국어 这类名称`,
    todayOverview: "今日概览",
    homeMottoDefault: "今天也要加油呀",
    homeGreetingMorning: "早上好",
    homeGreetingNoon: "中午好",
    homeGreetingAfternoon: "下午好",
    homeGreetingEvening: "晚上好",
    homeGreetingNight: "夜深了",
    homeLocalData: "本地数据",
    homeCounts: (openTasks, openDeadlines) => `${openTasks} 个待办 · ${openDeadlines} 项日程`,
    homeNewTask: "新建任务",
    homeNewDeadline: "新建日程",
    homeStartFocus: "开始专注",
    homeTools: "快捷操作",
    homeLinks: "常用站点",
    linksEmpty: "还没有站点，到设置 → 外观 → 常用站点 里添加",
    homeWebLinks: "网页链接",
    homeRefreshed: "已刷新",
    linksAddLabel: "名称（可选，开头放表情可自定义图标）",
    linksAddUrl: "https://… 或 obsidian://… 或库内笔记路径",
    linksDelete: "删除链接",
    linksDeletedNotice: "已删除链接",
    linksHint: "点击图标打开；悬停图标右上角可删除。网页在浏览器打开，笔记路径在新标签页打开。",
    customPanels: "自定义面板",
    customPanelsEmpty: "还没有面板，到设置 → 自定义面板 里创建",
    customPanelNoItems: "这个面板还没有项目",
    homeSyncCalendar: "同步日历",
    homeBackupNow: "导出备份",
    homeSettings: "设置",
    homeKpiTasks: "任务流",
    homeKpiTasksSub: (open, overdue) =>
      overdue > 0 ? `今日待办 ${open} · ${overdue} 项逾期` : `今日待办 ${open}`,
    homeKpiDeadlines: "最近日程",
    homeKpiDeadlinesSub: (title, open, overdue) =>
      overdue > 0 ? `${title} · 进行中 ${open} · 逾期 ${overdue}` : `${title} · 进行中 ${open}`,
    homeKpiFocus: "今日专注",
    homeKpiFocusSub: (monthHours, goal) => `本月 ${monthHours} 小时 · 目标 ${goal} 分钟`,
    homeKpiHabits: "今日打卡",
    homeKpiHabitsSub: (left) => (left > 0 ? `还有 ${left} 项未打卡` : "全部完成 🎉"),
    todayTasksLeft: (n) => `${n} 个任务待办`,
    todayHabitsLeft: (n) => `${n} 个习惯未打卡`,
    todayDeadlinesOverdue: (n) => `${n} 项日程已过期`,
    todayAllDone: "今天很轻松，都处理完了",
    undo: "撤销",
    quickAddedTask: (text) => `✅ 已添加任务：${text}`,
    quickAddedDeadline: (title, date) => `⏳ 已添加日程：${title}（${date}）`,
    quickAddInvalid: "⚠️ 事项名称或日期无效，未添加",
    taskRepeatedNotice: (nextDue) => `🔁 已安排下一次：${nextDue}`,
    taskDeleted: "已删除任务",
    projectDeleted: "已删除项目",
    deadlineDeletedNotice: "已删除日程",
    habitDeleted: "已删除习惯",
    alarmDeleted: "已删除闹钟",
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
    ganttTitle: "Project Gantt Chart",
    ganttNoDates: "No projects have a due date yet — set one to show it here",
    taskboard: "Taskboard",
    taskDetails: "Task Details",
    focusSession: "Focus Session",
    focusTargetLabel: "Focus on",
    focusNoTarget: "Nothing in particular",
    focusTargetTasks: "Tasks",
    focusTargetProjects: "Projects",
    focusTargetHabits: "Habits",
    focusTargetTotal: (min) => `${min} min so far`,
    focusPlay: "Focus on this",
    focusStartedOn: (name) => `▶ Focusing on: ${name}`,
    focusBreakdown: "Where it went",
    focusUnattributed: "Unattributed focus",
    focusTargetGone: "(deleted)",
    minuteUnitShort: "m",
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
    taskArchived: (n) => `${n} finished earlier`,
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
    pomodoroMode: "🍅 Pomodoro",
    pomodoroSkip: "Skip",
    pomodoroWorkLabel: (round, total) => `Round ${round}/${total} · work`,
    pomodoroShortLabel: "Short break",
    pomodoroLongLabel: "Long break",
    pomodoroWorkDone: (breakMin) => `🍅 Work done — ${breakMin} min break`,
    pomodoroCycleDone: (rounds, breakMin) => `🍅 ${rounds} rounds done! Long break: ${breakMin} min`,
    pomodoroBreakDone: (round, total) => `🍅 Break over — round ${round}/${total}`,
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
    alarmDaily: "Daily",
    alarmWeekly: "Weekly",
    alarmOnce: "Once",
    alarmInvalidDate: "Choose a date for the one-time alarm",
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
    deadlineTime: "Time (optional)",
    deadlineToday: "Today",
    deadlineDaysLeft: (n) => `${n} day${n === 1 ? "" : "s"} left`,
    deadlineOverdue: (n) => `${n} day${n === 1 ? "" : "s"} overdue`,
    deadlineRemindNone: "No reminder",
    deadlineRemindSameDay: "Same day",
    deadlineRemindNDays: (n) => `${n} day${n === 1 ? "" : "s"} before`,
    deadlineRemindMinutes: (n) =>
      n % 60 === 0 ? `${n / 60} hour${n === 60 ? "" : "s"} before` : `${n} min before`,
    deadlineReminderNotice: (title, daysLeft) =>
      daysLeft === 0
        ? `⏳ "${title}" is due today`
        : `⏳ "${title}" due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    deadlineReminderTimeNotice: (title, time, minutesLeft) =>
      `⏳ "${title}" at ${time} — ${minutesLeft} min to go`,
    deadlineDone: "Mark done",
    deadlineDoneSection: (n) => `Done (${n})`,
    deadlinePrepProgress: (done, total) => `Prep tasks ${done}/${total} — click to expand`,
    deadlinePrepAdd: "Add a prep task",
    deadlinePrepPlaceholder: "Prep task, e.g. “revise chapter 1”…",
    icsSyncResult: (added, updated, skipped) =>
      `📅 Calendar sync: ${added} added, ${updated} updated, ${skipped} skipped`,
    icsSyncFailed: (err) => `⚠️ Calendar sync failed: ${err}`,
    noteLink: "Linked note",
    habitReminderNotice: (names) => `🔥 Not checked in yet: ${names.join(", ")}`,
    habitReminderNoticeOne: (name) => `🔥 Time for: ${name}`,
    habitReminderTime: "Own reminder time (optional)",
    habitLinkedLang: "Linked language: studying it in Language learning checks this off",
    habitLinkedNone: "No link",
    agenda: "Next 7 days",
    agendaToday: "today",
    agendaTomorrow: "tomorrow",
    agendaNothing: "Nothing scheduled",
    habits: "Habits",
    noHabits: "No habits yet — add one to start tracking",
    addHabit: "+ Add",
    habitAddPlaceholder: "Habit name…",
    habitDelete: "Delete habit",
    habitTargetDaily: "Daily",
    habitTargetPerWeek: (n) => `${n}x / week`,
    habitWeekProgress: (done, target) => `${done}/${target} this week`,
    habitStreakWeeks: (n) => `🔥 ${n} week${n === 1 ? "" : "s"}`,
    habitCheckinCount: (n) => `${n} check-in${n === 1 ? "" : "s"}`,
    habitCheckedIn: "Checked in",
    habitUnchecked: "Not checked in",
    language: "Language",
    vocabDue: "Due",
    vocabReviewedToday: "Reviewed today",
    vocabNewToday: "New today",
    vocabGoal: (done, goal) => `${done}/${goal}`,
    vocabStreak: (days) => `🔥 ${days} day${days === 1 ? "" : "s"}`,
    vocabStartReview: "Start review",
    vocabNothingDue: "Nothing due today",
    vocabNextDue: (n, days) =>
      days === 1 ? `${n} due tomorrow` : `${n} due in ${days} days`,
    vocabAllDone: "All reviews done for today 🎉",
    vocabWordPlaceholder: "Word (Enter to look up)…",
    vocabMeaningPlaceholder: "Meaning…",
    vocabExamplePlaceholder: "Example (optional)…",
    vocabAdd: "+ Add",
    vocabAdded: (word) => `Added: ${word}`,
    vocabReview: "Review",
    vocabProgress: (done, total) => `${done} / ${total}`,
    vocabReveal: "Show answer",
    vocabForgot: "Forgot",
    vocabKnew: "Knew it",
    vocabSessionDone: (right, total) => `${right} of ${total} right this session`,
    vocabWordList: "Word list",
    vocabEmpty: "No words yet — add one to start",
    vocabSearch: "Search word or meaning…",
    vocabAllLanguages: "All languages",
    vocabBox: (box) => `Box ${box}`,
    vocabMastered: "Mastered",
    vocabDueBadge: "Due",
    vocabDueIn: (days) => (days === 1 ? "tomorrow" : `in ${days} days`),
    vocabEdit: "Edit word",
    vocabDelete: "Delete word",
    vocabDeleted: "Word deleted",
    vocabReset: "Relearn",
    vocabStats: "Stats",
    vocabTotal: "Words",
    vocabMasteredCount: "Mastered",
    vocabLearning: "Learning",
    vocabLapses: (n) => `${n} miss${n === 1 ? "" : "es"}`,
    vocabHardest: "Most missed",
    vocabBoxLegend: "Words per box (new → mastered)",
    vocabWall: "Word wall",
    vocabWallToday: "Today",
    vocabWallWeek: "This week",
    vocabWallMonth: "This month",
    vocabWallAll: "All",
    vocabWallEmpty: "No words added in this period",
    vocabWallAdded: (date) => `Added ${date}`,
    vocabWallShuffle: "Shuffle",
    vocabNotesTitle: "vocabulary",
    vocabNotesGenerated: "Generated by Elegant Dashboard and rewritten whenever the deck changes — edit words in the dashboard, not here.",
    vocabNotesColWord: "Word",
    vocabNotesColMeaning: "Meaning",
    vocabNotesColExample: "Example",
    vocabNotesColLevel: "Level",
    vocabNotesColAdded: "Added",
    vocabNotesSynced: (written, langs) => `Vocabulary notes synced: ${langs} language${langs === 1 ? "" : "s"}, ${written} note${written === 1 ? "" : "s"} updated`,
    vocabNotesFailed: (err) => `Vocabulary notes sync failed: ${err}`,
    vocabLookup: "Look up",
    vocabLookupBusy: "Looking up…",
    vocabLookupNone: "Nothing found — type the meaning by hand",
    vocabLookupNumber: "Digits and symbols cannot be translated — type a word, e.g. \"one\"",
    scripts: "Kana / Hangul",
    scriptNames: { hiragana: "Hiragana", katakana: "Katakana", hangul: "Korean alphabet", hangulSyllables: "Korean syllables" },
    scriptSections: {
      gojuon: "Gojūon",
      dakuten: "Dakuten / handakuten",
      yoon: "Yōon",
      consonants: "Basic consonants",
      doubleConsonants: "Double consonants",
      vowels: "Basic vowels",
      compoundVowels: "Compound vowels",
      syllables: "Consonant × vowel (rows: consonants, columns: vowels)",
    },
    scriptAccuracy: (right, total) => `${right}/${total} right`,
    scriptUnseen: "Not tested yet",
    speak: "Read aloud",
    scriptStop: "Stop",
    scriptTest: "Kana / Hangul test",
    scriptTestRange: "Range",
    scriptTestWeak: "Weak only",
    scriptTestMixed: "Mixed",
    scriptTestMode: "Mode",
    scriptTestModeRead: "See character, type reading",
    scriptTestModeWrite: "See reading, type character",
    scriptTestCount: "Questions",
    scriptTestCountAll: "All",
    scriptTestStart: "Start test",
    scriptTestEmpty: "Nothing to test in this range",
    scriptTestAskRead: "Type the reading (romaji)",
    scriptTestAskWrite: (script) => `Type the ${script}`,
    scriptTestCheck: "Check",
    scriptTestNext: "Next",
    scriptTestCorrect: "✓ Correct",
    scriptTestWrong: (answer) => `✗ Answer: ${answer}`,
    scriptTestDone: (right, total) => `${right} of ${total} right`,
    scriptTestWrongList: "Missed",
    scriptTestAgain: "Retest the missed ones",
    vocabLookupUnknownLang: (lang) => `Unknown language "${lang}" — name it Deutsch / English / 日本語 / 한국어 in Settings`,
    todayOverview: "Today",
    homeMottoDefault: "Make today count",
    homeGreetingMorning: "Good morning",
    homeGreetingNoon: "Good day",
    homeGreetingAfternoon: "Good afternoon",
    homeGreetingEvening: "Good evening",
    homeGreetingNight: "Late night",
    homeLocalData: "Local data",
    homeCounts: (openTasks, openDeadlines) =>
      `${openTasks} open task${openTasks === 1 ? "" : "s"} · ${openDeadlines} deadline${openDeadlines === 1 ? "" : "s"}`,
    homeNewTask: "New task",
    homeNewDeadline: "New deadline",
    homeStartFocus: "Start focus",
    homeTools: "Quick actions",
    homeLinks: "Sites",
    linksEmpty: "No sites yet — add some under Settings → Appearance → Sites",
    homeWebLinks: "Web links",
    homeRefreshed: "Refreshed",
    linksAddLabel: "Label (optional; start with an emoji to pick the mark)",
    linksAddUrl: "https://…, obsidian://…, or a vault note path",
    linksDelete: "Delete link",
    linksDeletedNotice: "Link deleted",
    linksHint: "Click a tile to open it; hover for the delete button. Web links open in the browser, note paths in a new tab.",
    customPanels: "Custom panels",
    customPanelsEmpty: "No panels yet — create some under Settings → Custom panels",
    customPanelNoItems: "This panel has no items yet",
    homeSyncCalendar: "Sync calendar",
    homeBackupNow: "Export backup",
    homeSettings: "Settings",
    homeKpiTasks: "Task flow",
    homeKpiTasksSub: (open, overdue) =>
      overdue > 0 ? `${open} due today · ${overdue} overdue` : `${open} due today`,
    homeKpiDeadlines: "Next deadline",
    homeKpiDeadlinesSub: (title, open, overdue) =>
      overdue > 0 ? `${title} · ${open} open · ${overdue} overdue` : `${title} · ${open} open`,
    homeKpiFocus: "Focus today",
    homeKpiFocusSub: (monthHours, goal) => `${monthHours} h this month · goal ${goal} min`,
    homeKpiHabits: "Habits today",
    homeKpiHabitsSub: (left) => (left > 0 ? `${left} still to check in` : "All done 🎉"),
    todayTasksLeft: (n) => `${n} task${n === 1 ? "" : "s"} left today`,
    todayHabitsLeft: (n) => `${n} habit${n === 1 ? "" : "s"} not checked in`,
    todayDeadlinesOverdue: (n) => `${n} deadline${n === 1 ? "" : "s"} overdue`,
    todayAllDone: "All clear — nothing left today",
    undo: "Undo",
    quickAddedTask: (text) => `✅ Task added: ${text}`,
    quickAddedDeadline: (title, date) => `⏳ Deadline added: ${title} (${date})`,
    quickAddInvalid: "⚠️ Invalid title or date — nothing added",
    taskRepeatedNotice: (nextDue) => `🔁 Next one scheduled for ${nextDue}`,
    taskDeleted: "Task deleted",
    projectDeleted: "Project deleted",
    deadlineDeletedNotice: "Deadline deleted",
    habitDeleted: "Habit deleted",
    alarmDeleted: "Alarm deleted",
    weekdayShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    weekdayFull: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    formatDayTitle: (m, d) => `${m}/${d}`,
    formatMonthTitle: (y, m) => `${y}-${pad(m)}`,
    formatRange: (a, b) =>
      `${a.getMonth() + 1}/${a.getDate()} — ${b.getMonth() + 1}/${b.getDate()}`,
  },
};

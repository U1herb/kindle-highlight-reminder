const STORAGE_KEY = "kindle-highlight-reminder:v1";
const SETTINGS_KEY = "kindle-highlight-reminder:settings";

const sampleData = {
  exportedAt: new Date().toISOString(),
  source: "notion:05_book",
  books: [
    {
      id: "sample-1",
      title: "Notion 05_book サンプル",
      author: "",
      tags: ["AI", "技術"],
      url: "",
      createdAt: new Date().toISOString(),
      highlights: [
        "Notion MCPから取得した各本ページの本文を、短い読書メモとして保存します。",
        "毎朝ランダムに3つ選び、過去の知恵として通知します。",
        "検索は本の名前、著者、タグ、ハイライト本文を対象にします。"
      ]
    }
  ]
};

const state = {
  books: [],
  today: [],
  settings: {
    notifyTime: "08:00",
    notificationsEnabled: false,
    lastNotificationDate: ""
  },
  timer: null
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  importFile: $("#importFile"),
  syncBundledButton: $("#syncBundledButton"),
  loadSampleButton: $("#loadSampleButton"),
  exportButton: $("#exportButton"),
  notifyTestButton: $("#notifyTestButton"),
  notificationToggle: $("#notificationToggle"),
  notifyTime: $("#notifyTime"),
  highlightCount: $("#highlightCount"),
  bookCount: $("#bookCount"),
  lastSync: $("#lastSync"),
  todayList: $("#todayList"),
  todayStatus: $("#todayStatus"),
  libraryList: $("#libraryList"),
  reshuffleButton: $("#reshuffleButton"),
  searchInput: $("#searchInput"),
  template: $("#highlightTemplate")
};

init();

function init() {
  loadState();
  bindEvents();
  render();
  loadBundledNotionData();
  scheduleNotification();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

async function loadBundledNotionData(force = false) {
  if (!force && state.books.length) return;
  const candidates = ["./data/notion-highlights.json", "./data/notion-highlights.demo.json"];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data.books) && data.books.length) {
        importData(data);
        return;
      }
    } catch {
      // Optional bundled data is absent on a fresh checkout.
    }
  }
}

function bindEvents() {
  elements.importFile.addEventListener("change", importJsonFile);
  elements.syncBundledButton?.addEventListener("click", () => loadBundledNotionData(true));
  elements.loadSampleButton.addEventListener("click", () => importData(sampleData));
  elements.exportButton.addEventListener("click", exportData);
  elements.reshuffleButton.addEventListener("click", () => {
    recreateToday();
  });
  elements.searchInput.addEventListener("input", renderLibrary);
  elements.notifyTime.addEventListener("change", () => {
    state.settings.notifyTime = elements.notifyTime.value || "08:00";
    persistSettings();
    scheduleNotification();
  });
  elements.notificationToggle.addEventListener("change", async () => {
    if (elements.notificationToggle.checked) {
      const granted = await requestNotificationPermission();
      state.settings.notificationsEnabled = granted;
      elements.notificationToggle.checked = granted;
    } else {
      state.settings.notificationsEnabled = false;
    }
    persistSettings();
    scheduleNotification();
  });
  elements.notifyTestButton.addEventListener("click", async () => {
    if (await requestNotificationPermission()) {
      showNotification("過去の知恵", makeNotificationBody(state.today));
    }
  });
}

async function importJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  importData(JSON.parse(text));
  event.target.value = "";
}

function importData(data) {
  const books = normalizeBooks(data);
  state.books = books;
  state.today = chooseDailyBooks(true);
  persist();
  render();
}

function normalizeBooks(data) {
  const rawBooks = Array.isArray(data) ? data : data.books || [];
  return rawBooks
    .map((book, index) => ({
      id: String(book.id || book.url || `book-${index}`),
      title: String(book.title || book.name || book["名前"] || "無題"),
      author: String(book.author || book["作者"] || ""),
      tags: normalizeTags(book.tags || book["タグ"]),
      url: String(book.url || book["URL"] || ""),
      createdAt: String(book.createdAt || book["作成日時"] || ""),
      highlights: normalizeHighlights(book.highlights || book.notes || book.memo || book.content)
    }))
    .filter((book) => book.highlights.length > 0);
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return String(value)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
}

function normalizeHighlights(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/\n+/);
  return items
    .map((item) => String(item).replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 12 && !item.startsWith("![]("));
}

function chooseDailyBooks(force = false) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const savedKey = localStorage.getItem(`${STORAGE_KEY}:today-key`);
  if (!force && savedKey === todayKey && isDailyBookSelection(state.today)) return state.today;

  const candidates = state.books.filter((book) => book.highlights.length > 0);
  const shuffledBooks = seededShuffle(candidates, force ? `${todayKey}:books:${Date.now()}` : `${todayKey}:books`);
  const selected = shuffledBooks.slice(0, 3).map((book) => {
    const highlights = seededShuffle(
      book.highlights.map((text, index) => ({ id: `${book.id}:${index}`, text: formatHighlight(text) })),
      force ? `${todayKey}:${book.id}:${Date.now()}` : `${todayKey}:${book.id}`
    ).slice(0, 3);
    return {
      id: book.id,
      title: book.title,
      author: book.author,
      tags: book.tags,
      highlights
    };
  });
  localStorage.setItem(`${STORAGE_KEY}:today-key`, todayKey);
  return selected;
}

function isDailyBookSelection(items) {
  return Array.isArray(items) && items.every((item) => item && Array.isArray(item.highlights));
}

function formatHighlight(text) {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (normalized.length <= 100) return normalized;
  return `${normalized.slice(0, 99)}…`;
}

function seededShuffle(items, seedText) {
  const result = [...items];
  let seed = Array.from(seedText).reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function render() {
  elements.notifyTime.value = state.settings.notifyTime;
  elements.notificationToggle.checked = state.settings.notificationsEnabled;
  state.today = chooseDailyBooks();
  renderSummary();
  renderToday();
  renderLibrary();
}

function renderSummary() {
  const highlightTotal = state.books.reduce((sum, book) => sum + book.highlights.length, 0);
  elements.highlightCount.textContent = String(highlightTotal);
  elements.bookCount.textContent = String(state.books.length);
  elements.lastSync.textContent = state.books.length ? "保存済み" : "未同期";
}

function renderToday() {
  elements.todayList.replaceChildren();
  if (!state.today.length) {
    elements.todayList.append(emptyState("Notion MCP JSONを読み込むと、今日の3冊が表示されます。"));
    return;
  }
  for (const book of state.today) {
    elements.todayList.append(renderDailyBook(book));
  }
}

function recreateToday() {
  state.today = chooseDailyBooks(true);
  persist();
  renderToday();
  const total = state.today.reduce((sum, book) => sum + book.highlights.length, 0);
  elements.todayStatus.textContent = `${new Date().toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  })} に再作成しました。${state.today.length}冊 / ${total}ハイライトを提示しています。`;
}

function renderDailyBook(book) {
  const node = elements.template.content.firstElementChild.cloneNode(true);
  node.querySelector("strong").textContent = book.title;
  node.querySelector("span").textContent = [book.author, book.tags?.join(", ")].filter(Boolean).join(" / ");
  const list = node.querySelector("ol");
  for (const highlight of book.highlights) {
    const item = document.createElement("li");
    item.textContent = highlight.text;
    list.append(item);
  }
  return node;
}

function renderLibrary() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const books = state.books.filter((book) => {
    const haystack = [book.title, book.author, book.tags.join(" "), book.highlights.join(" ")].join(" ").toLowerCase();
    return haystack.includes(query);
  });
  elements.libraryList.replaceChildren();
  if (!books.length) {
    elements.libraryList.append(emptyState(state.books.length ? "一致する本がありません。" : "まだデータがありません。"));
    return;
  }
  for (const book of books) {
    const row = document.createElement("article");
    row.className = "book-row";
    row.innerHTML = `
      <h3></h3>
      <p class="book-meta"></p>
      <div class="tag-list"></div>
    `;
    row.querySelector("h3").textContent = book.title;
    row.querySelector(".book-meta").textContent = [book.author, `${book.highlights.length}件`].filter(Boolean).join(" / ");
    const tagList = row.querySelector(".tag-list");
    for (const tag of book.tags) {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = tag;
      tagList.append(chip);
    }
    elements.libraryList.append(row);
  }
}

function emptyState(message) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = message;
  return div;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ books: state.books, today: state.today }));
  persistSettings();
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadState() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  state.books = saved.books || [];
  state.today = saved.today || [];
  state.settings = { ...state.settings, ...settings };
}

function exportData() {
  const blob = new Blob([JSON.stringify({ source: "notion:05_book", books: state.books }, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "kindle-highlights.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

function scheduleNotification() {
  if (state.timer) window.clearTimeout(state.timer);
  if (!state.settings.notificationsEnabled) return;
  const delay = getNextNotificationDelay(state.settings.notifyTime);
  state.timer = window.setTimeout(async () => {
    if (await requestNotificationPermission()) {
      state.today = chooseDailyBooks();
      showNotification("過去の知恵", makeNotificationBody(state.today));
      state.settings.lastNotificationDate = new Date().toISOString().slice(0, 10);
      persist();
    }
    scheduleNotification();
  }, delay);
}

function getNextNotificationDelay(timeText) {
  const [hour, minute] = timeText.split(":").map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hour || 8, minute || 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function showNotification(title, body) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, { body, tag: "daily-wisdom" });
    });
    return;
  }
  new Notification(title, { body });
}

function makeNotificationBody(items) {
  if (!items.length) return "今日のハイライトを表示するにはNotion MCP JSONを読み込んでください。";
  return items
    .map((book, index) => {
      const lines = book.highlights.map((highlight, highlightIndex) => `  ${highlightIndex + 1}. ${highlight.text}`);
      return `${index + 1}. ${book.title}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

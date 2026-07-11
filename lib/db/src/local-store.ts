import fs from "fs";
import path from "path";

// مخزّن محلي بملف JSON — يُستخدم تلقائياً عند تشغيل الخادم بدون DATABASE_URL (localhost بدون Postgres).
// يحفظ نفس البيانات (الحالة، الفائزون، الأرشيف، سجل البطولات) في ملف على القرص عشان تبقى بعد إعادة التشغيل.
const FILE = process.env.LOCAL_DB_FILE || path.resolve(process.cwd(), "local-data.json");

// نفس حدود التخزين المستعملة فـ وضع Postgres (lib/db/src/index.ts)، عشان ملف
// local-data.json ما يكبرش بلا حدود هو الآخر (خصوصاً مع صور Base64 فـ records).
const MAX_WINNERS = 500;
const MAX_ARCHIVES = 150;
const MAX_RECORDS = 100;

interface Store {
  state: any | null;
  winners: any[];
  archives: any[];
  records: any[];
  helpers: any[];
  seq: { winners: number; archives: number; records: number; helpers: number };
}

function empty(): Store {
  return { state: null, winners: [], archives: [], records: [], helpers: [], seq: { winners: 0, archives: 0, records: 0, helpers: 0 } };
}

let cache: Store | null = null;

function load(): Store {
  if (cache) return cache;
  try {
    if (fs.existsSync(FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
      cache = { ...empty(), ...parsed, seq: { ...empty().seq, ...(parsed.seq || {}) } };
    } else {
      cache = empty();
    }
  } catch {
    cache = empty();
  }
  return cache!;
}

// نبقي فقط أحدث `max` عنصر فـ المصفوفة (نفترض أنها مرتّبة من الأقدم للأحدث
// حسب ترتيب الإضافة، فنحذف من البداية).
function capArray<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
}

function save(s: Store) {
  s.winners = capArray(s.winners, MAX_WINNERS);
  s.archives = capArray(s.archives, MAX_ARCHIVES);
  s.records = capArray(s.records, MAX_RECORDS);
  cache = s;
  try {
    fs.writeFileSync(FILE, JSON.stringify(s, null, 2), "utf8");
  } catch (e) {
    console.error("⚠️ فشل حفظ الملف المحلي:", e);
  }
}

const nowISO = () => new Date().toISOString();

export const localStore = {
  filePath: FILE,

  getState() {
    return load().state || undefined;
  },
  saveState(data: any) {
    const s = load();
    // نشيل أي id/createdAt منزلقين من كائن قادم من مصدر آخر، تفادياً لتلوث الحالة.
    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...safeData } = data || {};
    s.state = { ...(s.state || {}), ...safeData, updatedAt: nowISO() };
    save(s);
    return [s.state];
  },

  getWinners() {
    return [...load().winners].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  },
  addWinner(w: any) {
    const s = load();
    const row = { ...w, id: ++s.seq.winners, date: w.date || nowISO(), createdAt: nowISO() };
    s.winners.push(row);
    save(s);
    return [row];
  },

  getArchives() {
    return [...load().archives].sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)));
  },
  getArchiveById(id: number) {
    return load().archives.find((a) => a.id === id);
  },
  addArchive(a: any) {
    const s = load();
    const row = { ...a, id: ++s.seq.archives, finishedAt: a.finishedAt || nowISO(), createdAt: nowISO() };
    s.archives.push(row);
    save(s);
    return [row];
  },

  getRecords() {
    return [...load().records].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  addRecord(r: any) {
    const s = load();
    const row = { isHidden: false, ...r, id: ++s.seq.records, createdAt: nowISO() };
    s.records.push(row);
    save(s);
    return [row];
  },
  // تعديل/إنشاء سجل لعبة بالمفتاح tournamentName (اسم اللعبة) — سجل واحد لكل لعبة.
  upsertRecord(r: any) {
    const s = load();
    const idx = s.records.findIndex((x) => x.tournamentName === r.tournamentName);
    if (idx >= 0) {
      const row = {
        ...s.records[idx],
        winnerName: r.winnerName ?? "",
        image: r.image ?? "",
        // displayName و image2 يُحدَّثان فقط إذا جاءا فـ الطلب، وإلا نبقي القيمة المحفوظة.
        displayName: r.displayName !== undefined ? r.displayName : s.records[idx].displayName,
        image2: r.image2 !== undefined ? r.image2 : (s.records[idx].image2 ?? ""),
      };
      s.records[idx] = row;
      save(s);
      return [row];
    }
    const row = { isHidden: false, ...r, id: ++s.seq.records, createdAt: nowISO() };
    s.records.push(row);
    save(s);
    return [row];
  },
  deleteRecord(id: number) {
    const s = load();
    const idx = s.records.findIndex((r) => r.id === id);
    const removed = idx >= 0 ? s.records.splice(idx, 1) : [];
    save(s);
    return removed;
  },
  // إخفاء/إظهار كرت فائز بدون حذف بياناته
  setRecordVisibility(id: number, isHidden: boolean) {
    const s = load();
    const idx = s.records.findIndex((r) => r.id === id);
    if (idx < 0) return [];
    s.records[idx] = { ...s.records[idx], isHidden };
    save(s);
    return [s.records[idx]];
  },

  getHelpers() {
    return [...load().helpers].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  findHelperByCode(code: string) {
    return load().helpers.find((h) => h.code === code);
  },
  addHelper(h: any) {
    const s = load();
    const row = { permissions: {}, ...h, id: ++s.seq.helpers, createdAt: nowISO() };
    s.helpers.push(row);
    save(s);
    return row;
  },
  updateHelperPermissions(id: number, permissions: any) {
    const s = load();
    const idx = s.helpers.findIndex((h) => h.id === id);
    if (idx < 0) return null;
    s.helpers[idx] = { ...s.helpers[idx], permissions };
    save(s);
    return s.helpers[idx];
  },
  deleteHelper(id: number) {
    const s = load();
    const idx = s.helpers.findIndex((h) => h.id === id);
    const removed = idx >= 0 ? s.helpers.splice(idx, 1) : [];
    save(s);
    return removed[0] || null;
  },
};
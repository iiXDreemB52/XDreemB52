import { useEffect, useRef, useState } from "react";
import type { TournamentState, Winner, TournamentArchive, TournamentRecord } from "./types";

const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";
const BASE = `${API_ORIGIN}/api/tournament`;

export async function getState(): Promise<TournamentState> {
  const res = await fetch(`${BASE}/state`);
  if (!res.ok) throw new Error("Failed to fetch state");
  return res.json();
}

export async function postState(state: TournamentState, token: string): Promise<void> {
  const res = await fetch(`${BASE}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error("Failed to save state");
}

// قراءة JSON بأمان: لو الرد فاضي أو مو JSON (مثلاً الخادم غير شغّال أو البروكسي رجّع خطأ) ما نرمي خطأ غامض
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface AdminPermissions {
  tournament?: boolean;
  records?: boolean;
}

export interface AdminSession {
  token: string;
  role: "admin" | "helper";
  permissions: AdminPermissions;
  name?: string;
}

export async function adminLogin(password: string): Promise<AdminSession> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
  } catch {
    throw new Error("تعذّر الاتصال بالخادم. تأكد أن خادم الـ API شغّال.");
  }
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || "تعذّر تسجيل الدخول. تأكد أن خادم الـ API شغّال.");
  }
  if (!data?.token) throw new Error("رد غير متوقع من الخادم");
  return data as AdminSession;
}

// دخول المساعد بكود منحه له الأدمن الرئيسي
export async function adminHelperLogin(code: string): Promise<AdminSession> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/admin/helper-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    throw new Error("تعذّر الاتصال بالخادم. تأكد أن خادم الـ API شغّال.");
  }
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.error || "كود غير صحيح");
  }
  if (!data?.token) throw new Error("رد غير متوقع من الخادم");
  return data as AdminSession;
}

// يتأكد من صلاحية توكن محفوظ ويرجّع دوره وصلاحياته (يُستخدم عند إعادة تحميل الصفحة)
export async function adminWhoami(token: string): Promise<AdminSession | null> {
  try {
    const res = await fetch(`${BASE}/admin/whoami`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await safeJson(res);
    if (!data?.role) return null;
    return { token, role: data.role, permissions: data.permissions || {} };
  } catch {
    return null;
  }
}

export interface AdminHelper {
  id: number;
  name: string;
  code: string;
  permissions: AdminPermissions;
  createdAt: string;
}

export async function getHelpers(token: string): Promise<AdminHelper[]> {
  const res = await fetch(`${BASE}/admin/helpers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function createHelper(name: string, permissions: AdminPermissions, token: string): Promise<AdminHelper> {
  const res = await fetch(`${BASE}/admin/helpers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, permissions }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error || "فشل إنشاء المساعد");
  return data as AdminHelper;
}

export async function updateHelperPermissions(id: number, permissions: AdminPermissions, token: string): Promise<AdminHelper> {
  const res = await fetch(`${BASE}/admin/helpers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ permissions }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error || "فشل تحديث الصلاحيات");
  return data as AdminHelper;
}

export async function deleteHelper(id: number, token: string): Promise<void> {
  await fetch(`${BASE}/admin/helpers/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// حالة الأدمن التجريبي:
// - "enabled"     → الخادم شغّال وملف dev-admin.txt موجود (ندخل تلقائياً)
// - "disabled"    → الخادم شغّال بس الملف غير موجود (نعرض نموذج كلمة المرور)
// - "unreachable" → ما قدرنا نوصل للخادم (خادم الـ API مو شغّال)
export type DevAdminStatus = "enabled" | "disabled" | "unreachable";

export async function getDevAdminStatus(): Promise<DevAdminStatus> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/admin/dev-status`);
  } catch {
    return "unreachable";
  }
  if (!res.ok) return "unreachable";
  const data = await safeJson(res);
  if (data == null) return "unreachable";
  return data.enabled ? "enabled" : "disabled";
}

// دخول تجريبي بدون كلمة مرور (يشتغل فقط إذا كان الملف موجود)
export async function devAdminLogin(): Promise<AdminSession> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/admin/dev-login`, { method: "POST" });
  } catch {
    throw new Error("تعذّر الاتصال بالخادم. تأكد أن خادم الـ API شغّال.");
  }
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data?.error || "الأدمن التجريبي غير مفعّل");
  if (!data?.token) throw new Error("رد غير متوقع من الخادم");
  return data as AdminSession;
}

export async function getWinners(): Promise<Winner[]> {
  try {
    const res = await fetch(`${BASE}/winners`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function postWinner(w: Winner, token: string): Promise<void> {
  try {
    await fetch(`${BASE}/winners`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(w),
    });
  } catch {}
}

// ✅ useSSE محسّن — يعيد الاتصال تلقائياً ويمنع memory leaks
export function useSSE(onState: (s: TournamentState) => void) {
  const cbRef = useRef(onState);
  cbRef.current = onState;

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isActive = true;

    const connect = () => {
      if (!isActive) return;

      try {
        eventSource = new EventSource(`${BASE}/events`);
        console.log("[SSE] Connecting...");

        eventSource.onopen = () => {
          console.log("[SSE] Connected successfully");
        };

        eventSource.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data) as TournamentState;
            console.log("[SSE] Received, phase:", data.phase, "rounds:", data.rounds?.length);
            cbRef.current(data);
          } catch (err) {
            console.error("[SSE] Parse error:", err);
          }
        };

        eventSource.onerror = () => {
          console.error("[SSE] Connection error, reconnecting in 3s...");
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isActive && !reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              reconnectTimeout = null;
              connect();
            }, 3000);
          }
        };
      } catch (err) {
        console.error("[SSE] Failed to create connection:", err);
        if (isActive && !reconnectTimeout) {
          reconnectTimeout = setTimeout(() => {
            reconnectTimeout = null;
            connect();
          }, 3000);
        }
      }
    };

    connect();

    return () => {
      isActive = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      console.log("[SSE] Cleanup completed");
    };
  }, []);
}

export function useAdminToken() {
  const [session, setSession] = useState<AdminSession | null>(() => {
    const raw = localStorage.getItem("adminSession");
    if (raw) {
      try { return JSON.parse(raw) as AdminSession; } catch { /* fallthrough */ }
    }
    // توافق مع نسخة قديمة كانت تخزّن التوكن فقط بدون دور/صلاحيات
    const legacyToken = localStorage.getItem("adminToken");
    if (legacyToken) return { token: legacyToken, role: "admin", permissions: { tournament: true, records: true } };
    return null;
  });

  const save = (s: AdminSession) => {
    localStorage.setItem("adminSession", JSON.stringify(s));
    localStorage.removeItem("adminToken");
    setSession(s);
  };

  const clear = () => {
    localStorage.removeItem("adminSession");
    localStorage.removeItem("adminToken");
    setSession(null);
  };

  return {
    token: session?.token ?? null,
    role: session?.role ?? "admin",
    permissions: session?.permissions ?? {},
    save,
    clear,
  };
}

export async function getArchives(): Promise<TournamentArchive[]> {
  try {
    const res = await fetch(`${BASE}/archives`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getArchive(id: number): Promise<TournamentArchive | null> {
  try {
    const res = await fetch(`${BASE}/archives/${id}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function postArchive(archive: Omit<TournamentArchive, "id">, token: string): Promise<TournamentArchive | null> {
  try {
    const res = await fetch(`${BASE}/archives`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(archive),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ── سجل البطولات (Tournament Records) ──
export async function getRecords(): Promise<TournamentRecord[]> {
  try {
    const res = await fetch(`${BASE}/records`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// تعديل/حفظ لعبة (المفتاح = اسم اللعبة tournamentName): اسم الفائز + الصورة + الاسم المخصص. تعديل بدل إضافة.
export async function putRecord(
  record: { tournamentName: string; displayName?: string; winnerName: string; image: string; image2?: string },
  token: string
): Promise<TournamentRecord | null> {
  const res = await fetch(`${BASE}/records`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    let msg = "فشل حفظ السجل";
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function deleteRecord(id: number, token: string): Promise<void> {
  const res = await fetch(`${BASE}/records/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("فشل حذف السجل");
}

// إخفاء/إظهار كرت فائز من الصفحة العامة بدون حذف بياناته (اسم الفائز + الصورة يبقون محفوظين).
export async function setRecordVisibility(id: number, isHidden: boolean, token: string): Promise<TournamentRecord | null> {
  const res = await fetch(`${BASE}/records/${id}/visibility`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isHidden }),
  });
  if (!res.ok) throw new Error("فشل تغيير حالة الظهور");
  return res.json();
}
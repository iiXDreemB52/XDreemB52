import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PusherLib from "pusher-js";
import bgImg from "@assets/تصميم بدون عنوان.png";
import { getRecords, getState, getPlayerStats, useSSE } from "@/lib/api";
import { type TournamentRecord, type PlayerStats, type PlayerSession, type Winner, levelFromWins, progressWithinLevel, WINS_PER_LEVEL } from "@/lib/types";
import WinnerHistoryBar from "@/components/WinnerHistoryBar";

// إعدادات شات كيك (نفس المستخدمة بصفحة الأدمن) — عشان نتحقق من هوية اللاعب:
// اللاعب يكتب أمر الربط بشاته الحقيقي، ونحن نسمع الرسالة مباشرة من قناة القناة.
const KICK_PUSHER_KEY = "32cbd69e4b950bf97679";
const KICK_PUSHER_CLUSTER = "us2";
const KICK_CHANNEL = "ik3mo";
const KICK_CHATROOM_ID = 5675989;
const LINK_CODE_TTL_MS = 5 * 60 * 1000; // صلاحية أمر الربط: 5 دقائق ثم يُطلب توليد جديد

function normalizeName(u: string): string {
  return (u || "").normalize("NFKC").trim().toLowerCase();
}
function safeParse(v: string): unknown {
  try { return JSON.parse(v); } catch { return v; }
}
function nestedPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const rec = value as Record<string, unknown>;
  if (typeof rec.data === "string") return nestedPayload(safeParse(rec.data));
  if (rec.data && typeof rec.data === "object") return nestedPayload(rec.data);
  return rec;
}

export default function LandingPage() {
  const [records, setRecords] = useState<TournamentRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // ── جلسة اللاعب المسجّل + إحصائياته (فوزات/لفل لكل لعبة) ──
  const [session, setSession] = useState<PlayerSession | null>(() => {
    try { const raw = localStorage.getItem("playerSession"); return raw ? (JSON.parse(raw) as PlayerSession) : null; } catch { return null; }
  });
  const [stats, setStats] = useState<PlayerStats | null>(null);

  // ── حالة نافذة تسجيل الدخول عبر شات كيك ──
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginStep, setLoginStep] = useState<"enter" | "verify">("enter");
  const [nameInput, setNameInput] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [verifyMsg, setVerifyMsg] = useState("");
  const [codeExpired, setCodeExpired] = useState(false);

  const pusherRef = useRef<any>(null);
  const chatChannelRef = useRef<any>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshStats = useCallback(() => {
    const name = session?.username;
    if (!name) { setStats(null); return; }
    getPlayerStats(name).then((s) => { if (s) setStats(s); }).catch(() => {});
  }, [session]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const [winnerHistory, setWinnerHistory] = useState<Winner[]>([]);
  const refreshWinnerHistory = useCallback(() => {
    getState().then((s) => setWinnerHistory(s?.winnerHistory || [])).catch(() => {});
  }, []);

  // ── حالة البطولة الحية (لتلوين نقطة زر "مشاهدة البطولة") ──
  // phase: "setup" = لا توجد بطولة جارية، "tournament" = البطولة جارية الآن.
  // joinDeadline: وقت انتهاء نافذة الانضمام لو الأدمن فتحها (null يعني مغلقة).
  const [liveTournamentPhase, setLiveTournamentPhase] = useState<"setup" | "tournament">("setup");
  const [liveJoinDeadline, setLiveJoinDeadline] = useState<number | null>(null);
  // نبضة كل ثانية عشان ننتبه لانتهاء مهلة نافذة الانضمام حتى بدون رسالة SSE جديدة
  const [, setDotTick] = useState(0);
  useEffect(() => {
    if (!liveJoinDeadline) return;
    const id = setInterval(() => setDotTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [liveJoinDeadline]);

  useEffect(() => {
    getRecords().then(setRecords).catch(() => {});
    refreshWinnerHistory();
    getState().then((s) => {
      setLiveTournamentPhase(s?.phase || "setup");
      setLiveJoinDeadline(s?.joinDeadline ?? null);
    }).catch(() => {});
  }, [refreshWinnerHistory]);

  // تحديث لحظي: أي تعديل من الأدمن (يستدعي broadcast بالخادم) يوصل عبر SSE،
  // فنعيد جلب السجل + إحصائيات اللاعب فوراً (الفوزات تتغيّر عند تحديد فائز جديد).
  useSSE((data) => {
    getRecords().then(setRecords).catch(() => {});
    refreshStats();
    refreshWinnerHistory();
    setLiveTournamentPhase(data?.phase || "setup");
    setLiveJoinDeadline(data?.joinDeadline ?? null);
  });

  // ⏱️ هل نافذة الانضمام مفتوحة فعلاً الآن (فيه مهلة ولسا ما خلصت)؟
  const isJoinWindowOpen = !!liveJoinDeadline && liveJoinDeadline > Date.now();
  // 🔴 أحمر: ما فيه بطولة جارية ولا نافذة انضمام مفتوحة
  // 🟢 أخضر: الأدمن فتح باب الانضمام الآن
  // ⚪ أبيض (الوضع الطبيعي): البطولة جارية فعلاً
  const watchDotStatus: "red" | "green" | "white" =
    isJoinWindowOpen ? "green" : liveTournamentPhase === "tournament" ? "white" : "red";

  // إيقاف الاستماع لشات كيك وتنظيف المؤقّت
  const teardownVerify = useCallback(() => {
    if (chatChannelRef.current) {
      try {
        chatChannelRef.current.unbind_all();
        if (pusherRef.current) pusherRef.current.unsubscribe(chatChannelRef.current.name);
      } catch { /* ignore */ }
      chatChannelRef.current = null;
    }
    if (expireTimerRef.current) { clearTimeout(expireTimerRef.current); expireTimerRef.current = null; }
  }, []);

  useEffect(() => () => teardownVerify(), [teardownVerify]);

  function genCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function openLogin() {
    setLoginOpen(true);
    setLoginStep("enter");
    setNameInput("");
    setLinkCode("");
    setVerifyMsg("");
    setCodeExpired(false);
  }

  function closeLogin() {
    setLoginOpen(false);
    teardownVerify();
  }

  function onVerified(user: string) {
    const sess: PlayerSession = { username: user };
    try { localStorage.setItem("playerSession", JSON.stringify(sess)); } catch { /* ignore */ }
    setSession(sess);
    setLoginOpen(false);
    teardownVerify();
    getPlayerStats(user).then((s) => { if (s) setStats(s); }).catch(() => {});
  }

  function logout() {
    try { localStorage.removeItem("playerSession"); } catch { /* ignore */ }
    setSession(null);
    setStats(null);
  }

  function connectVerify(name: string, code: string) {
    teardownVerify();
    const target = normalizeName(name);
    try {
      if (!pusherRef.current) {
        pusherRef.current = new PusherLib(KICK_PUSHER_KEY, { cluster: KICK_PUSHER_CLUSTER, forceTLS: true });
      }
      const channel = pusherRef.current.subscribe(`chatrooms.${KICK_CHATROOM_ID}.v2`);
      chatChannelRef.current = channel;
      const handler = (rawData: unknown) => {
        const payload = typeof rawData === "string" ? safeParse(rawData) : rawData;
        const normalized = nestedPayload(payload);
        const content = String((normalized?.content as unknown) ?? (normalized?.message as unknown) ?? (normalized?.text as unknown) ?? "").trim();
        const sender = (normalized?.sender as Record<string, unknown> | undefined) ?? (normalized?.user as Record<string, unknown> | undefined) ?? normalized;
        const user = String((sender?.username as unknown) ?? (sender?.name as unknown) ?? "").trim();
        if (!content || !user) return;
        if (normalizeName(user) !== target) return;
        if (!/(!ربط|!link|!رابط)/i.test(content)) return;
        if (!content.toLowerCase().includes(code.toLowerCase())) return;
        onVerified(user);
      };
      channel.bind("App\\Events\\ChatMessageEvent", handler);
      channel.bind("ChatMessageEvent", handler);
      channel.bind("App\\Events\\ChatMessageEventV2", handler);
    } catch {
      setVerifyMsg("تعذّر الاتصال بشات كيك — جرّب مرة ثانية بعد شوي.");
    }
  }

  function startVerify() {
    const name = nameInput.trim();
    if (!name) return;
    const code = genCode();
    setLinkCode(code);
    setCodeExpired(false);
    setVerifyMsg("");
    setLoginStep("verify");
    connectVerify(name, code);
    if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    expireTimerRef.current = setTimeout(() => {
      setCodeExpired(true);
      teardownVerify();
    }, LINK_CODE_TTL_MS);
  }

  // الكروت ديناميكية: كل سجل غير مخفي = كرت واحد، وكرت محذوف من الأدمن
  // يختفي كامل من هنا تلقائيًا (بدون خانة فاضية مكانه).
  const slots = useMemo(() => {
    return records
      .filter((r) => !r.isHidden)
      .map((r) => ({
        game: r.tournamentName,
        name: r.displayName || r.tournamentName,
        winner: r.winnerName || "",
        image: r.image || "",
        image2: r.image2 || "",
        empty: false,
      }));
  }, [records]);

  return (
    <>
      <style>{`
        @keyframes rgbShift {
          0%{color:#ff0040;text-shadow:0 0 8px rgba(255,0,64,.7)}
          16%{color:#ff8c00;text-shadow:0 0 8px rgba(255,140,0,.7)}
          33%{color:#ffd700;text-shadow:0 0 8px rgba(255,215,0,.7)}
          50%{color:#00e676;text-shadow:0 0 8px rgba(0,230,118,.7)}
          66%{color:#00b0ff;text-shadow:0 0 8px rgba(0,176,255,.7)}
          83%{color:#7c4dff;text-shadow:0 0 8px rgba(124,77,255,.7)}
          100%{color:#ff0040;text-shadow:0 0 8px rgba(255,0,64,.7)}
        }
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes enterDown{
          from{opacity:0;transform:translateY(-18px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes enterUp{
          from{opacity:0;transform:translateY(28px)}
          to{opacity:1;transform:translateY(0)}
        }
        @keyframes enterScale{
          0%{opacity:0;transform:scale(.55) rotate(-8deg)}
          60%{opacity:1;transform:scale(1.08) rotate(2deg)}
          100%{opacity:1;transform:scale(1) rotate(0)}
        }
        @keyframes enterCard{
          from{opacity:0;transform:translateY(36px) scale(.92)}
          to{opacity:1;transform:translateY(0) scale(1)}
        }
        @keyframes sheenSweep{
          0%{transform:translateX(-120%) skewX(-20deg)}
          100%{transform:translateX(220%) skewX(-20deg)}
        }
        @keyframes mascotGlow{
          0%,100%{filter:drop-shadow(0 0 18px rgba(41,182,246,.55))}
          50%{filter:drop-shadow(0 0 30px rgba(41,182,246,.85))}
        }
        @keyframes bgReveal{
          0%{opacity:0;filter:blur(28px) brightness(1.5);transform:scale(1.1)}
          55%{opacity:1;filter:blur(8px) brightness(1.25);transform:scale(1.04)}
          100%{opacity:1;filter:blur(0) brightness(1);transform:scale(1)}
        }
        @keyframes bgFlash{
          0%{opacity:.6}
          100%{opacity:0}
        }

        .lp-page{
          min-height:100vh;width:100%;
          color:#fff;font-family:Cairo, sans-serif;
          padding:28px 20px 60px;position:relative;overflow-x:hidden;
        }
        .lp-bg{
          position:fixed;inset:0;z-index:0;
          background:url(${bgImg}) center/cover no-repeat fixed;
          transform-origin:center center;
          animation:bgReveal 1.9s cubic-bezier(.22,1,.36,1) both;
        }
        .lp-bg::after{
          content:"";position:absolute;inset:0;
          background:radial-gradient(ellipse 65% 45% at 50% 32%, rgba(255,255,255,.95), transparent 62%);
          animation:bgFlash 1.5s ease-out both;
          pointer-events:none;
        }

        /* ===== الهيدر ===== */
        .lp-nav{
          max-width:1400px;margin:0 auto 8px;display:flex;align-items:center;justify-content:space-between;gap:18px;
          position:relative;z-index:2;
          animation:enterDown .7s cubic-bezier(.22,1,.36,1) both;
        }
        .lp-nav-social{display:flex;align-items:center;gap:18px}
        .lp-nav-icon{
          width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          color:#e6f3ff;opacity:.85;transition:opacity .2s ease, transform .2s ease;
        }
        .lp-nav-icon:hover{opacity:1;transform:translateY(-2px)}
        .lp-ikemo-btn{
          display:flex;align-items:center;gap:8px;padding:8px 18px;border-radius:999px;
          border:1px solid rgba(41,182,246,.45);background:rgba(41,182,246,.1);
          font-weight:800;font-size:.85rem;color:#eaf6ff;letter-spacing:.5px;text-decoration:none;
          box-shadow:0 0 18px rgba(41,182,246,.25);
        }
        .lp-nav-sep{width:1px;height:26px;background:rgba(255,255,255,.18);margin:0 2px}

        /* ===== الكروت ===== */
        .lp-grid{
          position:absolute;top:56.5%;left:0;right:0;
          max-width:1400px;margin:0 auto;display:flex;flex-wrap:wrap;
          justify-content:center;align-items:stretch;z-index:2;
          gap:16px;
        }
        .lp-card-wrap{
          position:relative;
          flex:0 1 220px;
          opacity:0;
          animation:enterCard .7s cubic-bezier(.22,1,.36,1) forwards;
          animation-delay:calc(.8s + var(--card-i, 0) * .09s);
        }
        @media (max-width: 900px){
          .lp-card-wrap{flex-basis:calc(33.333% - 11px)}
        }
        @media (max-width: 520px){
          .lp-card-wrap{flex-basis:calc(50% - 8px)}
        }
        .lp-card-wrap.is-empty{opacity:.55}

        .lp-card{
          background:linear-gradient(180deg, rgba(15,30,58,.9), rgba(6,13,26,.92));
          background-size:cover;background-position:center;
          border:1px solid rgba(41,182,246,.22);
          border-radius:18px;overflow:hidden;
          box-shadow:0 14px 34px rgba(0,0,0,.4);
          transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease;
          display:flex;flex-direction:column;min-height:270px;
          width:100%;
          position:relative;
        }
        .lp-card::before{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
          background:linear-gradient(180deg, rgba(6,10,22,.35) 0%, rgba(5,9,20,.55) 45%, rgba(4,7,16,.92) 100%);
        }
        .lp-card::after{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:1;
          background:linear-gradient(100deg,transparent 40%,rgba(255,255,255,.16) 50%,transparent 60%);
          transform:translateX(-120%) skewX(-20deg);
          animation:sheenSweep 1.1s ease-out forwards;
          animation-delay:calc(1.05s + var(--card-i, 0) * .09s);
        }
        .lp-card:hover{transform:translateY(-4px) scale(1.1);box-shadow:0 20px 44px rgba(41,182,246,.18);border-color:rgba(255,255,255,.75);z-index:5}

        .lp-card-head{
          position:absolute;top:0;left:50%;transform:translate(-50%,-50%);
          z-index:3;white-space:nowrap;max-width:92%;overflow:hidden;text-overflow:ellipsis;
          text-align:center;font-weight:900;
          font-size:clamp(1.05rem,2.6vw,1.5rem);color:#fff;letter-spacing:.3px;
          text-shadow:0 2px 10px rgba(0,0,0,.9), 0 0 18px rgba(0,0,0,.7);
        }

        .lp-card-spotlight{
          position:relative;z-index:2;
          flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:12px;padding:32px 14px 20px;
        }
        .lp-card-winner-group{display:flex;flex-direction:column;align-items:center;gap:2px}
        .lp-card-hint{
          color:rgba(255,255,255,.5);font-size:.7rem;font-weight:700;letter-spacing:.3px;
          text-shadow:0 1px 4px rgba(0,0,0,.8);
        }

        .image-modal{position:fixed;inset:0;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);animation:fadeIn .3s ease-out}
        .image-modal-content{position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center}
        .image-modal-img{width:100%;height:100%;object-fit:contain;border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,.8)}
        .image-modal-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.1);border:none;color:#fff;width:44px;height:44px;border-radius:50%;font-size:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease;z-index:1001}
        .image-modal-close:hover{background:rgba(255,255,255,.2);transform:scale(1.1)}

        .lp-card-winner{
          text-align:center;font-weight:900;
          font-size:clamp(.95rem,2.1vw,1.25rem);
          display:flex;align-items:center;justify-content:center;
        }
        .lp-card-winner.is-empty{color:rgba(255,255,255,.35);font-weight:700;font-size:.75rem}
        .lp-trophy{
          font-size:1.5rem;line-height:1;
          animation:trophyFloat 2.6s ease-in-out infinite;
        }
        @keyframes trophyFloat{
          0%,100%{transform:translateY(0) rotate(-2deg)}
          50%{transform:translateY(-5px) rotate(2deg)}
        }
        .rgb-name{
          font-weight:900;color:#7fd4ff;
          text-shadow:0 0 12px rgba(41,182,246,.75), 0 0 2px rgba(41,182,246,.5);
          letter-spacing:.2px;
        }

        .lp-card-main{flex:1}

        /* ===== زر مشاهدة البطولة ===== */
        .lp-watch-btn{
          display:flex;align-items:center;gap:9px;padding:10px 24px;border-radius:999px;
          background:linear-gradient(135deg,#39c4ff 0%,#1976e6 55%,#0d4fb0 100%);
          color:#fff;font-weight:800;font-size:.88rem;letter-spacing:.2px;
          text-decoration:none;white-space:nowrap;
          border:1px solid rgba(255,255,255,.22);
          box-shadow:0 6px 18px rgba(25,118,230,.4), inset 0 1px 0 rgba(255,255,255,.25);
          transition:transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }
        .lp-watch-btn:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(25,118,230,.55), inset 0 1px 0 rgba(255,255,255,.3);filter:brightness(1.06)}
        .lp-watch-btn:active{transform:translateY(0)}
        .lp-watch-dot{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 8px #fff,0 0 2px #fff;
          animation:fadeIn 1.2s ease-in-out infinite alternate;flex-shrink:0}
        /* 🔴 ما فيه بطولة جارية الآن */
        .lp-watch-dot.dot-red{background:#ff4444;box-shadow:0 0 8px #ff4444,0 0 2px #ff4444}
        /* 🟢 الأدمن فتح باب الانضمام الآن */
        .lp-watch-dot.dot-green{background:#22c55e;box-shadow:0 0 8px #22c55e,0 0 2px #22c55e}
        /* ⚪ البطولة جارية فعلاً (الوضع الافتراضي) */
        .lp-watch-dot.dot-white{background:#fff;box-shadow:0 0 8px #fff,0 0 2px #fff}

        /* ===== زر تسجيل الدخول + شريحة اللاعب (فوق يسار) ===== */
        .lp-nav-left{display:flex;align-items:center;gap:10px}
        .lp-login-btn{
          display:flex;align-items:center;gap:8px;padding:9px 20px;border-radius:999px;cursor:pointer;
          background:linear-gradient(135deg,#39c4ff 0%,#1976e6 55%,#0d4fb0 100%);
          color:#fff;font-weight:900;font-size:.88rem;letter-spacing:.2px;
          border:1px solid rgba(255,255,255,.28);
          box-shadow:0 6px 18px rgba(25,118,230,.4), inset 0 1px 0 rgba(255,255,255,.3);
          transition:transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }
        .lp-login-btn:hover{transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 10px 26px rgba(25,118,230,.55)}
        .lp-user-chip{
          display:flex;align-items:center;gap:8px;padding:7px 8px 7px 14px;border-radius:999px;
          border:1px solid rgba(41,182,246,.45);background:rgba(41,182,246,.1);
          font-weight:800;font-size:.85rem;color:#eaf6ff;
        }
        .lp-user-avatar{
          width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          background:linear-gradient(135deg,#39c4ff,#0d4fb0);color:#fff;font-weight:900;font-size:.8rem;flex-shrink:0;
        }
        .lp-logout-btn{
          width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;
          background:rgba(255,255,255,.1);color:#ffb4b4;font-size:.9rem;line-height:1;
          display:flex;align-items:center;justify-content:center;transition:background .2s ease;
        }
        .lp-logout-btn:hover{background:rgba(255,80,80,.25)}

        /* ===== لفل + شريط التقدّم تحت كل كرت (للمسجّلين فقط) ===== */
        .lp-card-level{
          position:relative;z-index:2;margin-top:auto;
          padding:9px 12px 11px;
          background:linear-gradient(180deg,rgba(4,10,22,.35),rgba(4,10,22,.75));
          border-top:1px solid rgba(41,182,246,.25);
        }
        .lp-level-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
        .lp-level-badge{
          display:inline-flex;align-items:center;gap:5px;font-weight:900;font-size:.82rem;color:#7fd4ff;
          text-shadow:0 0 8px rgba(41,182,246,.45);
        }
        .lp-level-wins{font-size:.68rem;font-weight:700;color:rgba(255,255,255,.55)}
        .lp-level-track{
          position:relative;height:8px;border-radius:999px;overflow:hidden;
          background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.1);
        }
        .lp-level-fill{
          position:absolute;inset:0 auto 0 0;border-radius:999px;
          background:linear-gradient(90deg,#1976e6,#39c4ff);
          box-shadow:0 0 10px rgba(41,182,246,.6);
          transition:width .5s cubic-bezier(.22,1,.36,1);
        }
        .lp-level-next{margin-top:5px;font-size:.64rem;font-weight:700;color:rgba(255,255,255,.5);text-align:center}

        /* ===== نافذة تسجيل الدخول ===== */
        .lp-modal{position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:1200;backdrop-filter:blur(6px);animation:fadeIn .25s ease-out;padding:20px}
        .lp-modal-card{
          width:100%;max-width:440px;border-radius:22px;position:relative;
          background:linear-gradient(180deg,rgba(16,32,60,.98),rgba(6,13,26,.99));
          border:1px solid rgba(41,182,246,.32);
          box-shadow:0 30px 70px rgba(0,0,0,.7),0 0 40px rgba(41,182,246,.14);
          padding:26px 24px 24px;animation:enterCard .45s cubic-bezier(.22,1,.36,1) both;
        }
        .lp-modal-close{position:absolute;top:14px;left:14px;background:rgba(255,255,255,.08);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s ease}
        .lp-modal-close:hover{background:rgba(255,255,255,.18)}
        .lp-modal-title{font-weight:900;font-size:1.3rem;color:#fff;text-align:center;margin-bottom:4px}
        .lp-modal-sub{font-size:.82rem;color:rgba(255,255,255,.6);text-align:center;margin-bottom:18px;line-height:1.7}
        .lp-modal-label{font-size:.82rem;font-weight:800;color:#7fd4ff;margin-bottom:7px;display:block}
        .lp-modal-input{
          width:100%;padding:12px 14px;border-radius:12px;font-size:1rem;font-weight:700;color:#fff;
          background:rgba(255,255,255,.06);border:1px solid rgba(41,182,246,.35);outline:none;text-align:center;
          font-family:Cairo,sans-serif;
        }
        .lp-modal-input:focus{border-color:#39c4ff;box-shadow:0 0 0 3px rgba(41,182,246,.18)}
        .lp-modal-btn{
          width:100%;margin-top:16px;padding:13px;border-radius:12px;border:none;cursor:pointer;
          background:linear-gradient(135deg,#39c4ff,#1976e6);color:#fff;font-weight:900;font-size:.95rem;
          font-family:Cairo,sans-serif;transition:filter .2s ease,transform .2s ease;
        }
        .lp-modal-btn:hover{filter:brightness(1.07);transform:translateY(-1px)}
        .lp-modal-btn:disabled{opacity:.5;cursor:default;transform:none;filter:none}
        .lp-steps{display:flex;flex-direction:column;gap:12px;margin:6px 0 14px}
        .lp-step{display:flex;gap:11px;align-items:flex-start;font-size:.85rem;color:rgba(255,255,255,.85);line-height:1.6}
        .lp-step-n{
          flex-shrink:0;width:24px;height:24px;border-radius:50%;background:rgba(41,182,246,.18);
          border:1px solid rgba(41,182,246,.45);color:#7fd4ff;font-weight:900;font-size:.78rem;
          display:flex;align-items:center;justify-content:center;
        }
        .lp-code-box{
          display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;
          margin:4px 0 10px;padding:14px;border-radius:14px;
          background:rgba(41,182,246,.1);border:1px dashed rgba(41,182,246,.5);
        }
        .lp-code-cmd{font-family:'Courier New',monospace;font-weight:900;font-size:1.5rem;letter-spacing:2px;color:#7fd4ff;direction:ltr}
        .lp-code-copy{background:rgba(255,255,255,.1);border:none;color:#fff;border-radius:8px;padding:6px 12px;font-size:.75rem;cursor:pointer;font-weight:700}
        .lp-code-copy:hover{background:rgba(255,255,255,.2)}
        .lp-verify-wait{display:flex;align-items:center;justify-content:center;gap:9px;font-size:.85rem;color:#7fd4ff;font-weight:700;margin-top:6px}
        .lp-verify-spinner{width:16px;height:16px;border-radius:50%;border:2px solid rgba(41,182,246,.35);border-top-color:#39c4ff;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .lp-open-chat{display:block;text-align:center;margin-top:12px;font-size:.8rem;color:#7fd4ff;text-decoration:underline;font-weight:700}
        .lp-modal-err{margin-top:10px;font-size:.8rem;color:#ffb4b4;text-align:center}

      `}</style>

      <div className="lp-page">
        <div className="lp-bg" />

        {/* ===== الهيدر: تسجيل الدخول (يسار) + أيقونات السوشل + زر مشاهدة البطولة (يمين) ===== */}
        <nav className="lp-nav">
          <div className="lp-nav-left">
            {session ? (
              <div className="lp-user-chip">
                <span className="lp-user-avatar">{session.username.charAt(0).toUpperCase()}</span>
                <span>{session.username}</span>
                <button className="lp-logout-btn" onClick={logout} title="تسجيل الخروج" aria-label="تسجيل الخروج">⏻</button>
              </div>
            ) : (
              <button className="lp-login-btn" onClick={openLogin}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 17l5-5-5-5v3H3v4h7v3zm2-15a10 10 0 1 0 0 20 10 10 0 0 0 6.32-2.26l-1.44-1.4A8 8 0 1 1 20 12a8 8 0 0 1-3.12 6.34l1.44 1.4A10 10 0 0 0 12 2z"/></svg>
                تسجيل دخول
              </button>
            )}
          </div>
          <div className="lp-nav-social">
            <a className="lp-nav-icon" href="https://discord.gg/ArYbJ9McA" target="_blank" rel="noopener noreferrer" aria-label="ديسكورد">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a14.6 14.6 0 0 1 4.3 1.7 16.5 16.5 0 0 0-14.9 0 14 14 0 0 1 4.3-1.7L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 9 .3 13.6.6 18a20 20 0 0 0 6 3l1-1.6a12.7 12.7 0 0 1-1.9-.9l.5-.4a14.2 14.2 0 0 0 12 0l.5.4a12.7 12.7 0 0 1-1.9.9l1 1.6a20 20 0 0 0 6-3c.4-5-.7-9.6-3.5-13.6ZM8.7 15.2c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z"/></svg>
            </a>
            <a className="lp-nav-icon" href="https://kick.com/ik3mo" target="_blank" rel="noopener noreferrer" aria-label="كيك">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h5v6.3L12 2h6l-6.6 8L18.5 22h-6.2l-4-6-1.3 1.5V22H2V2Z"/></svg>
            </a>
            <span className="lp-nav-sep" />
            <a className="lp-watch-btn" href="/live" aria-label="مشاهدة البطولة">
              <span
                className={`lp-watch-dot dot-${watchDotStatus}`}
                title={
                  watchDotStatus === "green"
                    ? "باب الانضمام مفتوح الآن"
                    : watchDotStatus === "white"
                      ? "البطولة جارية الآن"
                      : "لا توجد بطولة جارية حالياً"
                }
              />
              مشاهدة البطولة
            </a>
          </div>
        </nav>

        {/* ===== كروت الأبطال ===== */}
        <div className="lp-grid">
          {slots.map((slot, i) => (
            <div key={i} className={`lp-card-wrap${slot.empty ? " is-empty" : ""}`} style={{ ["--card-i" as any]: i }}>
              <div className="lp-card-head">{slot.name || "—"}</div>

              <div
                className="lp-card"
                style={{
                  cursor: slot.image ? "pointer" : "default",
                  ...(slot.image2 ? { backgroundImage: `url(${slot.image2})` } : {}),
                }}
                onClick={() => slot.image && setSelectedImage(slot.image)}
              >
                <div className="lp-card-spotlight">
                  <div className="lp-card-winner-group">
                    {slot.winner && <span className="lp-trophy">🏆</span>}
                    <div className={`lp-card-winner${slot.winner ? "" : " is-empty"}`}>
                      {slot.winner ? <span className="rgb-name">{slot.winner}</span> : slot.empty ? "" : "— لا يوجد فائز —"}
                    </div>
                  </div>
                  {slot.image && <div className="lp-card-hint">اضغط لعرض الصورة</div>}
                </div>

                {/* لفل اللاعب المسجّل + شريط التقدّم — يظهر فقط بعد تسجيل الدخول */}
                {session && (() => {
                  const wins = stats?.wins?.[slot.game] ?? 0;
                  const level = levelFromWins(wins);
                  const inLevel = progressWithinLevel(wins);
                  const pct = (inLevel / WINS_PER_LEVEL) * 100;
                  const toNext = WINS_PER_LEVEL - inLevel;
                  return (
                    <div className="lp-card-level" onClick={(e) => e.stopPropagation()}>
                      <div className="lp-level-row">
                        <span className="lp-level-badge">⭐ المستوى {level}</span>
                        <span className="lp-level-wins">{wins} فوز</span>
                      </div>
                      <div className="lp-level-track">
                        <div className="lp-level-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="lp-level-next">
                        {toNext === WINS_PER_LEVEL && inLevel === 0
                          ? `تحتاج ${WINS_PER_LEVEL} فوزات للمستوى ${level + 1}`
                          : `باقي ${toNext} للمستوى ${level + 1}`}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>

      </div>

      {selectedImage && (
        <div className="image-modal" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img className="image-modal-img" src={selectedImage} alt="Tournament" />
            <button className="image-modal-close" onClick={() => setSelectedImage(null)} aria-label="Close image">✕</button>
          </div>
        </div>
      )}

      {/* ===== نافذة تسجيل الدخول عبر شات كيك ===== */}
      {loginOpen && (
        <div className="lp-modal" onClick={closeLogin}>
          <div className="lp-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="lp-modal-close" onClick={closeLogin} aria-label="إغلاق">✕</button>

            {loginStep === "enter" ? (
              <>
                <div className="lp-modal-title">👋 تسجيل الدخول</div>
                <div className="lp-modal-sub">
                  سجّل بحسابك في كيك عشان تشوف مستواك وعدد فوزاتك تحت كل لعبة.
                </div>
                <label className="lp-modal-label">اسم حسابك في كيك</label>
                <input
                  className="lp-modal-input"
                  type="text"
                  placeholder="مثلاً: ik3mo"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") startVerify(); }}
                  autoFocus
                />
                <button className="lp-modal-btn" disabled={!nameInput.trim()} onClick={startVerify}>
                  التالي ⟵
                </button>
              </>
            ) : (
              <>
                <div className="lp-modal-title">🔗 اربط حسابك</div>
                <div className="lp-modal-sub">
                  عشان نتأكد إنه حسابك، اكتب الأمر التالي في شات كيك بنفس الحساب اللي كتبته:
                </div>

                <div className="lp-code-box">
                  <span className="lp-code-cmd">!ربط {linkCode}</span>
                  <button
                    className="lp-code-copy"
                    onClick={() => { navigator.clipboard?.writeText(`!ربط ${linkCode}`); }}
                  >📋 نسخ</button>
                </div>

                <div className="lp-steps">
                  <div className="lp-step"><span className="lp-step-n">1</span><span>افتح شات قناة <b>{KICK_CHANNEL}</b> في كيك</span></div>
                  <div className="lp-step"><span className="lp-step-n">2</span><span>اكتب الأمر <b>!ربط {linkCode}</b> في الشات</span></div>
                  <div className="lp-step"><span className="lp-step-n">3</span><span>راح تتسجّل تلقائياً بمجرد ما نشوف رسالتك ✅</span></div>
                </div>

                {codeExpired ? (
                  <>
                    <div className="lp-modal-err">⏱️ انتهت صلاحية الأمر — ولّد أمر جديد.</div>
                    <button className="lp-modal-btn" onClick={startVerify}>🔄 توليد أمر جديد</button>
                  </>
                ) : (
                  <div className="lp-verify-wait">
                    <span className="lp-verify-spinner" />
                    بانتظار كتابة الأمر في الشات...
                  </div>
                )}

                {verifyMsg && <div className="lp-modal-err">{verifyMsg}</div>}

                <a className="lp-open-chat" href={`https://kick.com/${KICK_CHANNEL}`} target="_blank" rel="noopener noreferrer">
                  فتح قناة {KICK_CHANNEL} في كيك ↗
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

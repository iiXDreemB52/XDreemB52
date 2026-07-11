import { useState, useEffect, useRef, useCallback } from "react";
import PusherLib from "pusher-js";
import bgImg from "@assets/ik3mo-bg-1280_1782771571176.jpg";
import iconImg from "@assets/kemo1_1.icon_1782771567876.png";
import { postState, getState, postArchive, getRecords, putRecord, deleteRecord, setRecordVisibility, getHelpers, createHelper, updateHelperPermissions, deleteHelper, useSSE, type AdminHelper, type AdminPermissions } from "@/lib/api";
import { BYE, defaultState, type TournamentState, type EntryLogItem, type HistorySnapshot, type TournamentRecord } from "@/lib/types";
import {
  p2, buildBracket, doWin, setSize as stSetSize, getOpenMatches, rTitle,
} from "@/lib/tournament";
import { playTick, playLock, playWin, playChampion, playStart, isSoundEnabled, toggleSound } from "@/lib/sounds";
import BracketDisplay from "@/components/BracketDisplay";

const CHANNEL_META: Record<string, { chatroomId: number }> = {
  ik3mo: { chatroomId: 5675989 },
  honkfm: { chatroomId: 20137066 },
};

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface Props {
  token: string;
  role: "admin" | "helper";
  permissions: AdminPermissions;
  onLogout: () => void;
}

type SlotState = "idle" | "rolling" | "locked";

export default function AdminPage({ token, role, permissions, onLogout }: Props) {
  const canTournament = role === "admin" || !!permissions?.tournament;
  const canRecords = role === "admin" || !!permissions?.records;
  const [st, setSt] = useState<TournamentState>(defaultState());
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [CH, setCH] = useState("ik3mo");
  const [kLive, setKLive] = useState(false);
  const [chatStatus, setChatStatus] = useState<"offline" | "connecting" | "live">("offline");
  const [slotA, setSlotA] = useState("—");
  const [slotB, setSlotB] = useState("—");
  const [slotStateA, setSlotStateA] = useState<SlotState>("idle");
  const [slotStateB, setSlotStateB] = useState<SlotState>("idle");
  const [pickRunning, setPickRunning] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [soundOn, setSoundOn] = useState(true);

  // ⏱️ مدة نافذة الانضمام بالدقائق (يحددها الأدمن قبل ما يفتح الباب)
  const [joinDurationInput, setJoinDurationInput] = useState(1);
  // نبضة كل ثانية عشان العداد التنازلي يتحدث بالواجهة (الوقت الفعلي مخزّن بـ st.joinDeadline)
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!st.joinDeadline) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [st.joinDeadline]);

  const [records, setRecords] = useState<TournamentRecord[]>([]);
  const [savingGame, setSavingGame] = useState<string | null>(null);
  const [recError, setRecError] = useState("");
  // مسودّات أسماء الفائزين لكل لعبة (يتحكم بها المستخدم قبل الحفظ)
  const [winnerDrafts, setWinnerDrafts] = useState<Record<string, string>>({});
  // أسماء الألعاب القابلة للتعديل
  const [gameNames, setGameNames] = useState<Record<string, string>>({});
  const [newGameName, setNewGameName] = useState("");

  const refreshRecords = useCallback(() => {
    getRecords().then((recs) => {
      setRecords(recs);
      // نزامن المسودّات مع القيم المحفوظة (بدون ما ندوس على تعديل جارٍ للمستخدم)
      setWinnerDrafts((prev) => {
        const next = { ...prev };
        for (const r of recs) {
          if (next[r.tournamentName] === undefined) next[r.tournamentName] = r.winnerName || "";
        }
        return next;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshRecords();
  }, [refreshRecords]);

  // ── إدارة المساعدين (الأدمن الرئيسي فقط) ──
  const [helpers, setHelpers] = useState<AdminHelper[]>([]);
  const [helperName, setHelperName] = useState("");
  const [newHelperPerms, setNewHelperPerms] = useState<AdminPermissions>({ tournament: true, records: false });
  const [helperError, setHelperError] = useState("");
  const [creatingHelper, setCreatingHelper] = useState(false);
  const [revealedCode, setRevealedCode] = useState<{ name: string; code: string } | null>(null);

  const refreshHelpers = useCallback(() => {
    if (role !== "admin") return;
    getHelpers(token).then(setHelpers).catch(() => {});
  }, [role, token]);

  useEffect(() => {
    refreshHelpers();
  }, [refreshHelpers]);

  async function handleCreateHelper() {
    if (!helperName.trim()) return;
    setCreatingHelper(true);
    setHelperError("");
    try {
      const helper = await createHelper(helperName.trim(), newHelperPerms, token);
      setHelperName("");
      setNewHelperPerms({ tournament: true, records: false });
      setRevealedCode({ name: helper.name, code: helper.code });
      refreshHelpers();
    } catch (err: unknown) {
      setHelperError(err instanceof Error ? err.message : "فشل إنشاء المساعد");
    } finally {
      setCreatingHelper(false);
    }
  }

  async function handleToggleHelperPerm(h: AdminHelper, key: keyof AdminPermissions) {
    const nextPerms = { ...h.permissions, [key]: !h.permissions?.[key] };
    setHelpers((prev) => prev.map((x) => (x.id === h.id ? { ...x, permissions: nextPerms } : x)));
    try {
      await updateHelperPermissions(h.id, nextPerms, token);
    } catch {
      refreshHelpers();
    }
  }

  async function handleDeleteHelper(h: AdminHelper) {
    setHelpers((prev) => prev.filter((x) => x.id !== h.id));
    try {
      await deleteHelper(h.id, token);
    } catch {
      refreshHelpers();
    }
  }

  // يقرأ الصورة ويصغّرها (حد أقصى 1000px، JPEG) ويرجّع Base64 data URL.
  function processImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX = 1000;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const scale = Math.min(MAX / width, MAX / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // حفظ لعبة (upsert بمفتاح اسم اللعبة): اسم الفائز + الصورة معاً.
  async function saveGame(game: string, winnerName: string, image: string) {
    setRecError("");
    setSavingGame(game);
    try {
      await putRecord({ tournamentName: game, winnerName, image }, token);
      refreshRecords();
    } catch (e: any) {
      setRecError(e?.message || "تعذّر الحفظ");
    } finally {
      setSavingGame(null);
    }
  }

  // رفع صورة لعبة: يقرأ الملف ويصغّره، ويحفظه مع اسم الفائز الحالي.
  async function handleGameImage(game: string, file: File, currentWinner: string) {
    setRecError("");
    if (!file.type.startsWith("image/")) {
      setRecError("الملف المختار ليس صورة");
      return;
    }
    try {
      const image = await processImage(file);
      await saveGame(game, currentWinner, image);
    } catch {
      setRecError("تعذّر قراءة الصورة");
    }
  }

  // رفع الصورة الإضافية (image2) — يحفظها مع الإبقاء على اسم الفائز وصورة البطولة الحاليين.
  async function handleGameImage2(game: string, file: File, currentWinner: string, currentImage: string) {
    setRecError("");
    if (!file.type.startsWith("image/")) {
      setRecError("الملف المختار ليس صورة");
      return;
    }
    setSavingGame(game);
    try {
      const image2 = await processImage(file);
      await putRecord({ tournamentName: game, winnerName: currentWinner, image: currentImage, image2 }, token);
      refreshRecords();
    } catch (e: any) {
      setRecError(e?.message || "تعذّر قراءة الصورة");
    } finally {
      setSavingGame(null);
    }
  }

  // حذف الصورة الإضافية فقط (image2) مع الإبقاء على باقي بيانات اللعبة.
  async function handleClearGameImage2(game: string, currentWinner: string, currentImage: string) {
    setRecError("");
    setSavingGame(game);
    try {
      await putRecord({ tournamentName: game, winnerName: currentWinner, image: currentImage, image2: "" }, token);
      refreshRecords();
    } catch (e: any) {
      setRecError(e?.message || "تعذّر حذف الصورة");
    } finally {
      setSavingGame(null);
    }
  }

  // حفظ اسم الفائز (عند الخروج من الحقل) مع الإبقاء على الصورة الحالية.
  function handleWinnerBlur(game: string, currentImage: string, savedWinner: string) {
    const draft = (winnerDrafts[game] ?? "").trim();
    if (draft === (savedWinner || "").trim()) return; // لا تغيير
    saveGame(game, draft, currentImage);
  }

  // حفظ اسم اللعبة المعدل
  async function handleGameNameBlur(game: string, newName: string, currentWinner: string, currentImage: string) {
    const trimmedName = (newName || "").trim();
    if (trimmedName === game) return; // لا تغيير
    setRecError("");
    setSavingGame(game);
    try {
      await putRecord({
        tournamentName: game,
        displayName: trimmedName,
        winnerName: currentWinner,
        image: currentImage
      }, token);
      refreshRecords();
    } catch (e: any) {
      setRecError(e?.message || "تعذّر حفظ الاسم");
    } finally {
      setSavingGame(null);
    }
  }

  function drawHeader(ctx: CanvasRenderingContext2D, W: number, title: string, winner: string, trophyY: number, titleY: number) {
    ctx.textAlign = "center";
    ctx.font = "48px 'Segoe UI Emoji','Noto Color Emoji',sans-serif";
    ctx.fillText("🏆", W / 2, trophyY);
    const tName = (title || "بطولة").trim();
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 26px Tahoma, Arial, sans-serif";
    ctx.fillText(tName, W / 2, titleY);
    if (!winner) return titleY + 20;
    ctx.font = "900 20px Tahoma, Arial, sans-serif";
    const label = `👑 ${winner} 👑`;
    const bw = Math.min(560, Math.max(180, ctx.measureText(label).width + 60));
    const bx = W / 2 - bw / 2;
    const by = titleY + 16;
    const bh = 42;
    ctx.fillStyle = "rgba(255,215,0,0.14)";
    ctx.strokeStyle = "rgba(255,215,0,0.55)";
    ctx.lineWidth = 2;
    drawRoundRect(ctx, bx, by, bw, bh, 21);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd700";
    ctx.fillText(label, W / 2, by + 28);
    return by + bh;
  }

  // يولّد صورة من بيانات البطولة الحالية (البراكيت + الفائز) ويرجّعها كـ data URL،
  // أو null لو ما فيه بيانات كافية (مع رسالة خطأ). العنوان = اسم البطولة الحالية.
  function generateBracketImage(winner: string): string | null {
    const rounds = st.rounds || [];
    const allPlayers = (st.players || []).filter(p => p && p !== BYE);
    const title = st.name || "بطولة";
    if (rounds.length === 0 && allPlayers.length === 0 && !winner) {
      setRecError("ما كاين بيانات بطولة حالية (لا براكيت ولا منافسين) باش نولّدو منها صورة");
      return null;
    }
    if (rounds.length > 0) {
      const totalRounds = rounds.length;
      const matchW = 190, matchH = 58, rowH = 92, colGap = 60;
      const colW = matchW + colGap;
      const marginX = 40, headerH = 190;
      const centersY: number[][] = [];
      centersY[0] = rounds[0].map((_, i) => headerH + i * rowH + rowH / 2);
      for (let r = 1; r < totalRounds; r++) {
        centersY[r] = rounds[r].map((_, i) => {
          const y1 = centersY[r - 1][2 * i];
          const y2 = centersY[r - 1][2 * i + 1];
          if (y1 !== undefined && y2 !== undefined) return (y1 + y2) / 2;
          return y1 ?? y2 ?? headerH;
        });
      }
      const maxY = Math.max(...centersY[0]) + rowH / 2 + 50;
      const W = marginX * 2 + totalRounds * colW - colGap;
      const H = Math.max(560, maxY + 40);
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, "#0a1a33");
      bgGrad.addColorStop(1, "#020814");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);
      const glow = ctx.createRadialGradient(W / 2, 60, 10, W / 2, 60, 320);
      glow.addColorStop(0, "rgba(255,215,0,0.28)");
      glow.addColorStop(1, "rgba(255,215,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(41,182,246,0.35)";
      ctx.lineWidth = 3;
      ctx.strokeRect(5, 5, W - 10, H - 10);
      drawHeader(ctx, W, title, winner, 58, 96);
      ctx.strokeStyle = "rgba(41,182,246,0.4)";
      ctx.lineWidth = 2;
      for (let r = 0; r < totalRounds - 1; r++) {
        const x1 = marginX + r * colW + matchW;
        const x2 = marginX + (r + 1) * colW;
        const midX = (x1 + x2) / 2;
        rounds[r + 1].forEach((_, i) => {
          const targetY = centersY[r + 1][i];
          [2 * i, 2 * i + 1].forEach((si) => {
            const sourceY = centersY[r][si];
            if (sourceY === undefined) return;
            ctx.beginPath();
            ctx.moveTo(x1, sourceY);
            ctx.lineTo(midX, sourceY);
            ctx.lineTo(midX, targetY);
            ctx.lineTo(x2, targetY);
            ctx.stroke();
          });
        });
      }
      ctx.textAlign = "center";
      rounds.forEach((round, r) => {
        const x = marginX + r * colW;
        const isFinal = r === totalRounds - 1;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "700 13px Tahoma, Arial, sans-serif";
        ctx.fillText(rTitle(r, totalRounds).replace("🏆", "").trim(), x + matchW / 2, headerH - 18);
        round.forEach((m, i) => {
          const cy = centersY[r][i];
          const y = cy - matchH / 2;
          ctx.fillStyle = isFinal ? "rgba(255,215,0,0.08)" : "rgba(41,182,246,0.08)";
          ctx.strokeStyle = isFinal ? "rgba(255,215,0,0.5)" : "rgba(41,182,246,0.35)";
          ctx.lineWidth = 1.5;
          drawRoundRect(ctx, x, y, matchW, matchH, 10);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, cy);
          ctx.lineTo(x + matchW, cy);
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.strokeStyle = isFinal ? "rgba(255,215,0,0.5)" : "rgba(41,182,246,0.35)";
          ctx.lineWidth = 1.5;
          const half = matchH / 2;
          const drawSlot = (name: string | null, slotY: number) => {
            const isBye = name === BYE;
            const isW = !!m.winner && m.winner === name && name !== BYE;
            ctx.font = `${isW ? "800" : "500"} 14px Tahoma, Arial, sans-serif`;
            ctx.fillStyle = isW ? "#ffd700" : isBye ? "rgba(255,255,255,0.35)" : name ? "#e5e7eb" : "rgba(255,255,255,0.3)";
            let label = isBye ? "بايب" : name || "—";
            const maxW = matchW - 20;
            if (ctx.measureText(label).width > maxW) {
              while (label.length > 3 && ctx.measureText(label + "…").width > maxW) {
                label = label.slice(0, -1);
              }
              label += "…";
            }
            ctx.fillText(label, x + matchW / 2, slotY);
          };
          drawSlot(m.a, y + half / 2 + 5);
          drawSlot(m.b, y + half + half / 2 + 5);
        });
      });
      return canvas.toDataURL("image/jpeg", 0.9);
    }
    const others = allPlayers.filter(p => p !== winner);
    const W = 1000, H = 625;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#0a1a33");
    bgGrad.addColorStop(1, "#020814");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 120, 10, W / 2, 120, 260);
    glow.addColorStop(0, "rgba(255,215,0,0.35)");
    glow.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(41,182,246,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    const afterHeader = drawHeader(ctx, W, title, winner, 95, 150);
    const listStartY = afterHeader + 34;
    if (others.length > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "700 16px Tahoma, Arial, sans-serif";
      ctx.fillText(`المنافسون (${allPlayers.length})`, W / 2, listStartY);
      const gridTop = listStartY + 34;
      const cols = 4;
      const cellW = (W - 80) / cols;
      const rowH = 44;
      const maxRows = Math.max(1, Math.floor((H - gridTop - 30) / rowH));
      const shown = others.slice(0, cols * maxRows);
      shown.forEach((name, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = 40 + cellW * col + cellW / 2;
        const cy = gridTop + row * rowH;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        drawRoundRect(ctx, cx - cellW / 2 + 8, cy - 22, cellW - 16, 34, 10);
        ctx.fill();
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "600 15px Tahoma, Arial, sans-serif";
        let display = name;
        const maxW = cellW - 30;
        if (ctx.measureText(display).width > maxW) {
          while (display.length > 3 && ctx.measureText(display + "…").width > maxW) {
            display = display.slice(0, -1);
          }
          display += "…";
        }
        ctx.fillText(display, cx, cy + 5);
      });
      if (others.length > shown.length) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "600 14px Tahoma, Arial, sans-serif";
        ctx.fillText(`+${others.length - shown.length} آخرين`, W / 2, H - 18);
      }
    }
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  // يولّد صورة البراكيت الحالي ويحفظها لهذي اللعبة (مع اسم الفائز الحالي أو بطل البطولة).
  async function handleGenerateGameImage(game: string) {
    setRecError("");
    const winner = (winnerDrafts[game] ?? "").trim() || (st.champion || "").trim();
    const image = generateBracketImage(winner);
    if (!image) return;
    await saveGame(game, winner, image);
  }

  // تفريغ لعبة (يمسح اسم الفائز والصورتين بس الكرت يبقى موجود بنفس الاسم).
  // إخفاء/إظهار كرت الفائز عن الصفحة العامة (بدون حذف الاسم أو الصورة، ويرجع بأي وقت)
  async function toggleGameVisibility(rec: TournamentRecord) {
    setRecError("");
    setSavingGame(rec.tournamentName);
    try {
      await setRecordVisibility(rec.id, !rec.isHidden, token);
      refreshRecords();
    } catch (e: any) {
      setRecError(e?.message || "تعذّر تغيير حالة الظهور");
    } finally {
      setSavingGame(null);
    }
  }

  async function handleClearGame(rec: TournamentRecord) {
    if (!confirm(`تفريغ "${rec.displayName || rec.tournamentName}" (اسم الفائز والصورة)؟`)) return;
    setSavingGame(rec.tournamentName);
    try {
      await putRecord({ tournamentName: rec.tournamentName, displayName: rec.displayName || "", winnerName: "", image: "", image2: "" }, token);
      setWinnerDrafts((prev) => ({ ...prev, [rec.tournamentName]: "" }));
      refreshRecords();
    } catch {
      setRecError("فشل التفريغ");
    } finally {
      setSavingGame(null);
    }
  }

  // حذف الكرت نهائيًا: يشيل السجل بالكامل من قاعدة البيانات فيختفي الكرت
  // كامل من صفحة الأدمن وصفحة الزوار، ولا يرجع إلا بإضافته من جديد.
  async function handleDeleteGameCard(rec: TournamentRecord) {
    if (!confirm(`حذف كرت "${rec.displayName || rec.tournamentName}" نهائيًا؟ هاذي العملية ما ترجعش، غير إضافة كرت جديد بنفس الاسم.`)) return;
    setRecError("");
    setSavingGame(rec.tournamentName);
    try {
      await deleteRecord(rec.id, token);
      setWinnerDrafts((prev) => {
        const next = { ...prev };
        delete next[rec.tournamentName];
        return next;
      });
      setGameNames((prev) => {
        const next = { ...prev };
        delete next[rec.tournamentName];
        return next;
      });
      refreshRecords();
    } catch {
      setRecError("فشل حذف الكرت");
    } finally {
      setSavingGame(null);
    }
  }

  // إضافة كرت جديد: يعمل سجل جديد فاضي بالاسم إللي يكتبه الأدمن، يظهر مباشرة كخانة جديدة.
  async function handleAddGame() {
    const name = newGameName.trim();
    if (!name) return;
    if (records.some((r) => r.tournamentName === name)) {
      setRecError("فما كرت بنفس الاسم موجود من قبل");
      return;
    }
    setRecError("");
    setSavingGame(name);
    try {
      await putRecord({ tournamentName: name, winnerName: "", image: "" }, token);
      setNewGameName("");
      refreshRecords();
    } catch (e: any) {
      setRecError(e?.message || "تعذّر إضافة الكرت");
    } finally {
      setSavingGame(null);
    }
  }

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  function handleToggleSound() {
    const next = toggleSound();
    setSoundOn(next);
  }

  const pusherRef = useRef<PusherClient | null>(null);
  const chatChannelRef = useRef<PusherChannel | null>(null);
  const fromPusherRef = useRef(false);

  useEffect(() => {
    getState().then(data => setSt(data)).catch(() => {});
  }, []);

  // 🔄 مزامنة لحظية بين الأدمن والمساعد: أي تغيير يسويه أي واحد منهم (بأي
  // تبويب/جهاز) ينوصل فوراً للطرف الثاني عن طريق نفس قناة الـ SSE اللي
  // تستخدمها صفحة العرض المباشر. بدون هذا، كل واحد يشوف نسخة قديمة من
  // الحالة إلى أن يعمل تحديث يدوي للصفحة.
  const typingRef = useRef(false); // true أثناء ما الأدمن يكتب بخانة اسم لاعب (عشان ما نلخبط عليه وهو يكتب)
  useSSE((data) => {
    if (typingRef.current) return; // ما نطبّق تحديث خارجي وهو يكتب حالياً
    setSt(data);
  });

  const sync = useCallback(async (newSt: TournamentState) => {
    console.log("[Admin] Syncing state, phase:", newSt.phase, "players:", newSt.players.length);
    try {
      await postState(newSt, token);
      setSyncError("");
    } catch (err) {
      console.error("[Admin] Sync failed:", err);
      setSyncError("فشل حفظ الحالة");
    }
  }, [token]);

  useEffect(() => {
    if (fromPusherRef.current) {
      fromPusherRef.current = false;
      sync(st);
    }
  }, [st, sync]);

  const update = useCallback((newSt: TournamentState) => {
    console.log("[Admin] update() phase:", newSt.phase, "players:", newSt.players.length);
    setSt(newSt);
    sync(newSt);
  }, [sync]);

  useEffect(() => {
    connectToKickChat();
    return () => {
      if (chatChannelRef.current && pusherRef.current) {
        chatChannelRef.current.unbind_all();
        pusherRef.current.unsubscribe(chatChannelRef.current.name);
      }
    };
  }, [CH]);

  function connectToKickChat() {
    setChatStatus("connecting");
    if (chatChannelRef.current) {
      chatChannelRef.current.unbind_all();
      if (pusherRef.current) pusherRef.current.unsubscribe(chatChannelRef.current.name);
      chatChannelRef.current = null;
    }
    const meta = CHANNEL_META[CH];
    if (!meta) { setChatStatus("offline"); return; }
    try {
      if (!pusherRef.current) {
        pusherRef.current = new PusherLib("32cbd69e4b950bf97679", { cluster: "us2", forceTLS: true });
      }
      const pusher = pusherRef.current!;
      const channel = pusher.subscribe(`chatrooms.${meta.chatroomId}.v2`);
      chatChannelRef.current = channel;
      channel.bind("pusher:subscription_succeeded", () => setChatStatus("live"));
      channel.bind("pusher:subscription_error", () => setChatStatus("offline"));
      pusher.connection.bind("state_change", (states: any) => {
        if (states.current === "connected") setChatStatus("live");
        if (states.current === "failed" || states.current === "disconnected") setChatStatus("offline");
      });
      const handleChatMessage = (rawData: unknown) => {
        const payload = typeof rawData === "string" ? safeJsonParse(rawData) : rawData;
        const normalized = getNestedPayload(payload) as Record<string, unknown>;
        const content = normalizeText(
          (normalized?.content as unknown) ?? (normalized?.message as unknown) ?? (normalized?.text as unknown) ?? ""
        );
        const sender = (normalized?.sender as Record<string, unknown> | undefined) ??
          (normalized?.user as Record<string, unknown> | undefined) ?? (normalized as Record<string, unknown>);
        const user = normalizeText(
          (sender?.username as unknown) ?? (sender?.name as unknown) ?? (normalized?.username as unknown) ?? ""
        );
        if (!content || !user) return;

        // 🚪 أمر الانسحاب الذاتي: يخلي اللاعب يطلع نفسه من القائمة قبل بدء البطولة
        if (/!خروج|!leave/i.test(content)) {
          let didLeave = false;
          setSt(prev => {
            if (prev.phase !== "setup") return prev;
            if (!isUserAlreadyJoined(prev.players, user)) return prev;
            fromPusherRef.current = true;
            didLeave = true;
            return removeEntryFromState(prev, user);
          });
          if (didLeave) { /* لا داعي لجلب صورة، بس نسحب */ }
          return;
        }

        if (!/!دخول|!join/i.test(content)) return;

        let didAdd = false;
        setSt(prev => {
          if (prev.phase !== "setup") return prev;
          // 🚪 باب الانضمام مقفل افتراضياً: ما نقبل ولا !دخول إلا إذا الأدمن أو
          // المساعد ضغط زر "افتح باب الانضمام" فعلاً (joinDeadline محدد) وما
          // انتهت مهلته بعد. قبل هذا التعديل كان أي !دخول يُقبل طول الوقت لو
          // ما فيه joinDeadline أصلاً، وهذا كان يخالف المطلوب.
          if (!prev.joinDeadline || Date.now() > prev.joinDeadline) return prev;
          if (isUserAlreadyJoined(prev.players, user)) return prev;
          fromPusherRef.current = true;
          didAdd = true;
          return addEntryToState(prev, user);
        });
        if (didAdd) enrichEntryAvatar(user);
      };
      channel.bind("App\\Events\\ChatMessageEvent", handleChatMessage);
      channel.bind("ChatMessageEvent", handleChatMessage);
      channel.bind("App\\Events\\ChatMessageEventV2", handleChatMessage);
      pusher.connection.bind("error", () => setChatStatus("offline"));
    } catch (err) {
      setChatStatus("offline");
    }
  }

  // ✅ توحيد اسم المستخدم (يشيل الفراغات الزايدة ويطبّع الأحرف) عشان مقارنة الأسماء
  // تكون دقيقة 100% بدل الاعتماد على substring اللي كان يفشل أحياناً ويسمح
  // لنفس الشخص يدخل أكثر من مرة (خصوصاً لو فيه فراغات أو رموز غير مرئية بالاسم).
  function normalizeUsername(u: string): string {
    return (u || "").normalize("NFKC").trim().toLowerCase();
  }

  // ✅ يتحقق هل المستخدم موجود فعلاً بقائمة اللاعبين (يدعم وضع الفرق حيث كل خانة
  // فيها أكثر من اسم مفصولين بـ " N ") — مقارنة دقيقة (exact match) وليس substring.
  function isUserAlreadyJoined(players: string[], user: string): boolean {
    const target = normalizeUsername(user);
    if (!target) return false;
    return players.some((p) => {
      if (!p) return false;
      return p.split(" N ").some((m) => normalizeUsername(m) === target);
    });
  }

  function safeJsonParse(value: string) {
    try { return JSON.parse(value); } catch { return value; }
  }

  function getNestedPayload(value: unknown) {
    if (!value || typeof value !== "object") return value;
    const record = value as Record<string, unknown>;
    if (typeof record.data === "string") return getNestedPayload(safeJsonParse(record.data));
    if (record.data && typeof record.data === "object") return getNestedPayload(record.data);
    return record;
  }

  function normalizeText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  // ✅ إضافة لاعب — يملأ أول خانة فاضية ضمن الحجم المحدد
  // 🚪 يشيل لاعب معيّن بناءً على أمر !خروج — لو بفريق يشيله من فريقه فقط
  // (ويشيل الفريق كامل لو صار فاضي بعدها)، ولو فردي يفضي خانته بالكامل.
  function removeEntryFromState(prev: TournamentState, user: string): TournamentState {
    const target = normalizeUsername(user);
    const players = prev.players
      .map((p) => {
        if (!p) return p;
        const members = p.split(" N ").filter((m) => normalizeUsername(m) !== target);
        return members.join(" N ");
      })
      .filter((p) => p);
    const entryLog = prev.entryLog.filter((e) => normalizeUsername(e.user) !== target);
    const size = Math.max(players.length, 2);
    const bSize = p2(size);
    const byeN = bSize - size;
    return { ...prev, players, size, bSize, byeN, entryLog };
  }

  function addEntryToState(prev: TournamentState, user: string): TournamentState {
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
    const entry: EntryLogItem = { user, time: timeStr };
    let players = [...prev.players];
    let size = prev.size;
    let added = false;

    if (prev.isTeams) {
      for (let i = 0; i < size; i++) {
        const current = players[i] || "";
        const members = current ? current.split(" N ") : [];
        if (members.length < prev.teamSize) {
          members.push(user);
          players[i] = members.join(" N ");
          added = true;
          break;
        }
      }
      if (!added) { players.push(user); size = players.length; added = true; }
    } else {
      let inserted = false;
      for (let i = 0; i < size; i++) {
        if (!players[i]) { players[i] = user; inserted = true; added = true; break; }
      }
      if (!inserted) { players.push(user); size = players.length; added = true; }
    }

    if (!added) return prev;

    const bSize = p2(size);
    const byeN = bSize - size;
    return { ...prev, players, size, bSize, byeN, entryLog: [...prev.entryLog, entry] };
  }

  function handleEntry(user: string, currentSt: TournamentState, updater: typeof update) {
    if (currentSt.phase !== "setup") return;
    if (isUserAlreadyJoined(currentSt.players, user)) return;
    const newSt = addEntryToState(currentSt, user);
    updater(newSt);
    enrichEntryAvatar(user);
  }

  // 🖼️ توليد رابط صورة احتياطية (Fallback) بألوان الموقع (أخضر كيك + أزرق) في حال تعذّر جلب صورة كيك الحقيقية
  function fallbackAvatar(user: string): string {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user)}&backgroundType=gradientLinear&backgroundColor=53fc18,29b6f6&textColor=060d1a&fontWeight=800`;
  }

  // 🖼️ محاولة جلب صورة بروفايل اللاعب الحقيقية من كيك، ثم تحديث entryLog بها بمجرد توفرها
  // (بدون إعاقة إضافة اللاعب — الإضافة تتم فورًا، والصورة تُلحق لاحقًا فور وصولها)
  async function enrichEntryAvatar(user: string) {
    let avatar: string | null = null;
    try {
      const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(user)}`, { headers: { Accept: "application/json" } });
      if (r.ok) {
        const d = await r.json();
        avatar = d?.user?.profile_pic || null;
      }
    } catch {
      avatar = null;
    }
    if (!avatar) avatar = fallbackAvatar(user);
    setSt(prev => ({
      ...prev,
      entryLog: prev.entryLog.map(e => (e.user === user && !e.avatar ? { ...e, avatar } : e)),
    }));
  }

  async function kickCheck(manual = false) {
    if (!manual) setKLive(false);
    try {
      const r = await fetch(`https://kick.com/api/v2/channels/${CH}`, { headers: { Accept: "application/json" } });
      if (!r.ok) throw 0;
      const d = await r.json();
      const live = d?.livestream != null;
      setKLive(live);
    } catch {
      setKLive(true);
    }
  }

  useEffect(() => {
    kickCheck(true);
    const id = setInterval(() => kickCheck(), 90000);
    return () => clearInterval(id);
  }, [CH]);

  // 🔁 تبديل نظام الفرق (تشغيل/إلغاء) — الإصلاح: لما نلغي "الفرق" بعد ما كان
  // فيه لاعبين مجمّعين مع بعض بنفس الخانة (مثلاً "أحمد N هشام")، لازم نفرّط
  // كل خانة لخانات فردية عشان اللاعبين ما يضلوش عالقين مع بعض. قبل الإصلاح
  // كان بس يبدّل isTeams بدون ما يلمس players، فتضل الأسماء ملتصقة ببعضها.
  function toggleTeams(checked: boolean) {
    if (!checked) {
      const allMembers = st.players.flatMap((p) => (p ? p.split(" N ") : []));
      const size = Math.max(allMembers.length, 2);
      const bSize = p2(size);
      const byeN = bSize - size;
      update({ ...st, isTeams: false, players: allMembers, size, bSize, byeN });
    } else {
      update({ ...st, isTeams: true });
    }
  }

  function handleSizeChange(n: number) {
    const newSt = stSetSize(st, n);
    update(newSt);
  }

  // 🎲 يفرّط كل اللاعبين المنضمين حاليًا من فرقهم، ويرجّع يوزّعهم بفرق عشوائية
  // جديدة بنفس حجم الفريق (teamSize) — مفيد لما تحب تعيد تشكيل الفرق بعد ما
  // ينضم الكل بدل ما يضلوا مرتبين حسب ترتيب انضمامهم بالشات.
  function shuffleTeams() {
    if (!st.isTeams) return;
    const allMembers = st.players.flatMap(p => (p ? p.split(" N ") : []));
    if (allMembers.length < 2) {
      alert("⚠️ ما فيه لاعبين كفاية لعمل ترتيب عشوائي — لازم ينضم لاعبين اثنين على الأقل.");
      return;
    }
    const shuffled = [...allMembers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const teamSize = Math.max(1, st.teamSize);
    const newPlayers: string[] = [];
    for (let i = 0; i < shuffled.length; i += teamSize) {
      newPlayers.push(shuffled.slice(i, i + teamSize).join(" N "));
    }
    const size = Math.max(newPlayers.length, 2);
    const bSize = p2(size);
    const byeN = bSize - size;
    update({ ...st, players: newPlayers, size, bSize, byeN });
  }

  // ⏱️ يفتح باب الانضمام لمدة محددة بالدقائق — بعد ما تنتهي المهلة، أي !دخول جديد يتجاهله
  // الكود تلقائيًا (الشيك موجود بـ handleChatMessage)
  function openJoinWindow(durationMinutes: number) {
    const deadline = Date.now() + Math.max(1, durationMinutes) * 60 * 1000;
    update({ ...st, joinDeadline: deadline });
  }

  function cancelJoinWindow() {
    update({ ...st, joinDeadline: null });
  }

  function getJoinSecondsLeft(): number {
    if (!st.joinDeadline) return 0;
    return Math.max(0, Math.ceil((st.joinDeadline - Date.now()) / 1000));
  }

  function deletePlayer(idx: number) {
    const removed = st.players[idx];
    const players = [...st.players];
    players.splice(idx, 1);
    const size = Math.max(2, st.size - 1);
    const bSize = p2(size);
    const byeN = bSize - size;
    // ✅ نشيل اللاعب المحذوف من entryLog كمان، عشان يختفي فوراً من صفحة
    // البث المباشر (/live) وليس فقط من قائمة الأدمن (كانت entryLog تبقى كما
    // هي فتظل صفحة العرض تعرض اللاعب المحذوف وتحسبه بعدد المشاركين).
    const removedMembers = removed ? removed.split(" N ").map(normalizeUsername) : [];
    const entryLog = removedMembers.length
      ? st.entryLog.filter((e) => !removedMembers.includes(normalizeUsername(e.user)))
      : st.entryLog;
    update({ ...st, players, size, bSize, byeN, entryLog });
  }

  function updatePlayer(idx: number, value: string) {
    typingRef.current = true; // نوقف استقبال تحديثات SSE مؤقتاً عشان ما تلخبط الكتابة
    const players = [...st.players];
    players[idx] = value;
    setSt(prev => ({ ...prev, players }));
  }

  function handlePlayerBlur() {
    typingRef.current = false;
    sync(st);
  }

  // 🧠 يتحقق هل عدد اللاعبين الحقيقيين (المنضمين فعلاً) كافي للبدء — بيرجع
  // null لو كل شي تمام، أو رسالة واضحة توضح بالضبط كم لاعب ناقص.
  function getStartBlockReason(): string | null {
    const joined = st.players.filter(p => p).length;
    const MIN_PLAYERS = 2;
    if (joined === 0) {
      return "⚠️ ما انضم ولا لاعب لسا! خلي المشاهدين يكتبوا !دخول بالشات قبل ما تبدأ.";
    }
    if (joined < MIN_PLAYERS) {
      const missing = MIN_PLAYERS - joined;
      return `⚠️ اللاعبين غير كافيين! عندك ${joined} لاعب بس، ناقصك ${missing} لاعب على الأقل عشان تقدر تبدأ البطولة.`;
    }
    return null;
  }

  // ✅ بدء البطولة — يعمل مع أي عدد من اللاعبين (يحسب أقرب قوة لـ 2)
  function startTournament() {
    const blockReason = getStartBlockReason();
    if (blockReason) {
      // البانر الاحترافي تحت الزر بيوضّح السبب لحظيًا — ما في داعي لـ alert مزعج
      return;
    }
    const label = st.isTeams ? "فريق" : "لاعب";

    // العدد يُحسب تلقائياً بناءً على من انضم فعلاً من الشات
    const joined = st.players.filter(p => p).length;
    const size = Math.max(joined, 2);
    const bSize = p2(size);
    const byeN = bSize - size;

    const players = Array.from({ length: size }, (_, i) => st.players[i] || `${label} ${i + 1}`);
    const name = st.name;
    const base = { 
      ...st, 
      players, 
      size,
      bSize,
      byeN,
      name, 
      phase: "tournament" as const, 
      champion: "", 
      winHistory: [], 
      pickedMatchId: null,
      cur: 0,
    };
    console.log("[Admin] Starting tournament with", players.length, "players");
    const newSt = buildBracket(base);
    console.log("[Admin] Bracket built, rounds:", newSt.rounds?.length);
    update(newSt);
    playStart();
    setSlotA("—"); setSlotB("—");
    setSlotStateA("idle"); setSlotStateB("idle");
  }

  function resetTournament() {
    if (!confirm("تبدأ بطولة جديدة؟ بيتمسح كل شي")) return;
    const champion = st.champion || st.lastWinner;
    const wasFinished = champion && st.rounds.length;
    const finishState = (archiveId?: number) => {
      const newSt = {
        ...defaultState(),
        lastWinner: champion || st.lastWinner,
        lastGameType: st.gameType || st.lastGameType,
        lastTournamentName: st.name || st.lastTournamentName,
        gameType: st.gameType,
        name: st.name,
        pickedMatchId: null,
      };
      update(newSt);
      setSlotA("—"); setSlotB("—");
      setSlotStateA("idle"); setSlotStateB("idle");
    };
    if (wasFinished) {
      postArchive({
        name: st.name || st.lastTournamentName || "IK3MO",
        gameType: st.gameType || st.lastGameType || "بطولة عامة",
        champion,
        isTeams: st.isTeams,
        teamSize: st.teamSize,
        players: st.players,
        rounds: st.rounds,
        finishedAt: new Date().toISOString(),
      }, token).then((archive) => finishState(archive?.id));
    } else {
      finishState();
    }
  }

  function handleWin(rIdx: number, mIdx: number, side: "a" | "b") {
    const wasPicked = st.pickedMatchId === `${rIdx}-${mIdx}`;
    if (wasPicked) { setSlotA("—"); setSlotB("—"); setSlotStateA("idle"); setSlotStateB("idle"); }
    let newSt = doWin(st, rIdx, mIdx, side);
    if (wasPicked) newSt = { ...newSt, pickedMatchId: null };
    const lastRound = newSt.rounds[newSt.rounds.length - 1];
    const isChampion = lastRound?.length === 1 && !!lastRound[0].winner && lastRound[0].winner !== BYE;
    if (isChampion) playChampion(); else playWin();
    const { winHistory: _drop, ...snapshot } = st;
    newSt.winHistory = [...(st.winHistory || []), snapshot as HistorySnapshot].slice(-15);
    update(newSt);
  }

  function undoLastWin() {
    if (!st.winHistory || !st.winHistory.length) return;
    if (!confirm("تراجع عن آخر نتيجة فوز؟")) return;
    const remaining = [...st.winHistory];
    const prevSnapshot = remaining.pop()!;
    const restored: TournamentState = { ...prevSnapshot, winHistory: remaining, pickedMatchId: null };
    setSlotA("—"); setSlotB("—");
    setSlotStateA("idle"); setSlotStateB("idle");
    update(restored);
  }

  function pickRandomMatch() {
    if (pickRunning) return;
    const open = getOpenMatches(st);
    if (!open.length) { setSlotA("لا يوجد ماتشات"); setSlotB("—"); return; }
    setPickRunning(true);
    update({ ...st, pickedMatchId: null });
    setSlotStateA("rolling"); setSlotStateB("rolling");
    const names = open.map(o => [o.m.a!, o.m.b!]).flat();
    let ticks = 0;
    const total = 24 + Math.floor(Math.random() * 14);
    let delay = 55;
    const chosen = open[Math.floor(Math.random() * open.length)];
    function tick() {
      playTick();
      const rA = names[Math.floor(Math.random() * names.length)];
      let rB: string;
      do { rB = names[Math.floor(Math.random() * names.length)]; } while (rB === rA && names.length > 1);
      setSlotA(rA); setSlotB(rB);
      ticks++;
      if (ticks < total) {
        if (ticks > total * 0.55) delay = Math.min(delay * 1.2, 240);
        setTimeout(tick, delay);
      } else {
        setSlotA(chosen.m.a!); setSlotB(chosen.m.b!);
        setSlotStateA("locked"); setSlotStateB("locked");
        playLock();
        setTimeout(() => { update({ ...st, pickedMatchId: `${st.cur}-${chosen.i}` }); setPickRunning(false); }, 300);
      }
    }
    tick();
  }

  const titleText = "iK3MO";
  const label = st.isTeams ? "فريق" : "لاعب";
  const slotClassA = `pick-slot${slotStateA === "rolling" ? " rolling" : slotStateA === "locked" ? " locked-in" : ""}`;
  const slotClassB = `pick-slot${slotStateB === "rolling" ? " rolling" : slotStateB === "locked" ? " locked-in" : ""}`;

  return (
    <>
      <div id="bg" style={{ backgroundImage: `url(${bgImg})` }} />
      <div id="bg-grad" />

      <div className="shell">
        <div className="main">
          <div style={{ width: "100%", margin: "0 auto" }}>
            <header className="site-header" style={{ position: "relative" }}>
              <button className="btn btn-ghost" onClick={handleToggleSound} title={soundOn ? "كتم الصوت" : "تشغيل الصوت"}
                style={{ position: "absolute", top: 0, right: 0, padding: "6px 12px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
                {soundOn ? "🔊 الصوت" : "🔇 مكتوم"}
              </button>
              <div className="tag">IK3MO</div>
              <h1>{titleText}</h1>
              <p>اختر عدد اللاعبين، اكتب أسمائهم، وكل جولة اضغط على الفائز ليتأهل</p>
            </header>

            {syncError && (
              <div style={{ textAlign: "center", color: "#ff4444", marginBottom: "12px", fontSize: "0.85rem" }}>
                ⚠️ {syncError}
              </div>
            )}

            {/* ── إدارة المساعدين (الأدمن الرئيسي فقط) ── */}
            {role === "admin" && (
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "1.15rem" }}>🙋</span>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 900 }}>إدارة المساعدين</h3>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>— أنشئ حساب مساعد وحدد له بالضبط وش يقدر يسوي</span>
                </div>

                {/* إنشاء مساعد جديد */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", padding: "12px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
                  <input
                    type="text"
                    className="n-input"
                    style={{ flex: 1, minWidth: "160px" }}
                    placeholder="اسم المساعد (مثلاً: أخوي / مشرف الشات)"
                    value={helperName}
                    onChange={(e) => setHelperName(e.target.value)}
                    disabled={creatingHelper}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!newHelperPerms.tournament} onChange={(e) => setNewHelperPerms((p) => ({ ...p, tournament: e.target.checked }))} />
                    🏆 إدارة البطولة
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!newHelperPerms.records} onChange={(e) => setNewHelperPerms((p) => ({ ...p, records: e.target.checked }))} />
                    🗂️ سجل البطولات
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "9px 16px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                    disabled={creatingHelper || !helperName.trim()}
                    onClick={handleCreateHelper}
                  >
                    {creatingHelper ? "..." : "➕ إنشاء مساعد"}
                  </button>
                </div>
                {helperError && <div style={{ color: "#ff4444", fontSize: "0.82rem", marginTop: "8px" }}>⚠️ {helperError}</div>}

                {/* الكود يظهر مرة وحدة بعد الإنشاء عشان الأدمن يرسله للمساعد */}
                {revealedCode && (
                  <div style={{ marginTop: "10px", padding: "12px", borderRadius: "12px", background: "rgba(83,252,24,0.08)", border: "1px solid rgba(83,252,24,0.3)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem" }}>✅ تم إنشاء <b>{revealedCode.name}</b> — كود الدخول:</span>
                    <code style={{ fontWeight: 900, fontSize: "1.05rem", letterSpacing: "2px", color: "var(--kick,#53fc18)" }}>{revealedCode.code}</code>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: "0.75rem", padding: "5px 10px" }}
                      onClick={() => { navigator.clipboard?.writeText(revealedCode.code); }}
                    >📋 نسخ</button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: "0.75rem", padding: "5px 10px" }}
                      onClick={() => setRevealedCode(null)}
                    >✕ إخفاء</button>
                  </div>
                )}

                {/* قائمة المساعدين الحاليين */}
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {helpers.length === 0 && (
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center", padding: "10px 0" }}>
                      ما فيه مساعدين لسا.
                    </div>
                  )}
                  {helpers.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        flexWrap: "wrap",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "140px" }}>
                        <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,#14b8a6,#0f172a)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                          {h.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{h.name}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)", letterSpacing: "1px" }}>{h.code}</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginRight: "auto" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", cursor: "pointer" }}>
                          <input type="checkbox" style={{ width: "16px", height: "16px" }} checked={!!h.permissions?.tournament} onChange={() => handleToggleHelperPerm(h, "tournament")} />
                          🏆 البطولة
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", cursor: "pointer" }}>
                          <input type="checkbox" style={{ width: "16px", height: "16px" }} checked={!!h.permissions?.records} onChange={() => handleToggleHelperPerm(h, "records")} />
                          🗂️ السجل
                        </label>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: "0.78rem", padding: "6px 10px", color: "#f87171", borderColor: "rgba(248,113,113,0.4)" }}
                        onClick={() => handleDeleteHelper(h)}
                        title="حذف المساعد نهائياً"
                      >🗑️ حذف</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── سجل البطولات: تعديل صورة كل لعبة (كروت ديناميكية يضيف/يحذف منها الأدمن) ── */}
            {!canRecords ? (
              <div className="card" style={{ textAlign: "center", padding: "28px 16px", opacity: 0.85 }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>🔒</div>
                <div style={{ fontWeight: 800, marginBottom: "4px" }}>ما عندك صلاحية "سجل البطولات"</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>اطلب من الأدمن الرئيسي يفعّلها لك من "إدارة المساعدين"</div>
              </div>
            ) : (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "1.15rem" }}>🏆</span>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 900 }}>سجل البطولات</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>— عدّل اسم الفائز والصورة لكل لعبة، تظهر مباشرة للمشاهدين</span>
              </div>
              {recError && <div style={{ color: "#ff4444", fontSize: "0.82rem", margin: "8px 0" }}>⚠️ {recError}</div>}

              {/* إضافة كرت جديد */}
              <div style={{ display: "flex", gap: "8px", margin: "10px 0 4px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  className="n-input"
                  style={{ flex: 1, minWidth: "180px", padding: "9px 12px" }}
                  placeholder="✏️ اسم اللعبة/الكرت الجديد"
                  value={newGameName}
                  disabled={savingGame !== null}
                  onChange={(e) => setNewGameName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddGame(); }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: "9px 16px", fontSize: "0.85rem", whiteSpace: "nowrap" }}
                  disabled={savingGame !== null || !newGameName.trim()}
                  onClick={handleAddGame}
                >➕ إضافة كرت</button>
              </div>

              <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", marginTop: "12px" }}>
                {records.length === 0 && (
                  <div style={{ fontSize: "0.85rem", color: "var(--muted)", gridColumn: "1 / -1", textAlign: "center", padding: "18px 0" }}>
                    ماكاين حتى كرت دابا — زيد اسم اللعبة فوق واضغط "➕ إضافة كرت".
                  </div>
                )}
                {records.map((rec) => {
                  const game = rec.tournamentName;
                  const busy = savingGame === game;
                  return (
                    <div key={rec.id} style={{ borderRadius: "16px", overflow: "hidden", background: "linear-gradient(160deg,rgba(41,182,246,0.12),rgba(0,20,45,0.55))", border: rec?.isHidden ? "1px dashed rgba(255,255,255,0.25)" : "1px solid var(--border)", display: "flex", flexDirection: "column", opacity: rec?.isHidden ? 0.55 : 1, position: "relative", transition: "opacity 0.2s ease" }}>
                      {rec?.isHidden && (
                        <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 2, background: "rgba(0,0,0,0.65)", color: "#fbbf24", fontSize: "0.7rem", fontWeight: 900, padding: "3px 9px", borderRadius: "999px", border: "1px solid rgba(251,191,36,0.4)" }}>
                        🙈 مخفي عن الزوار
                        </div>
                      )}
                      {/* اسم اللعبة فوق - قابل للتعديل */}
                      <input
                        type="text"
                        className="n-input"
                        style={{ padding: "11px 12px", textAlign: "center", fontWeight: 900, fontSize: "1rem", color: "#fff", background: "linear-gradient(135deg,rgba(41,182,246,0.22),rgba(41,182,246,0.06))", borderBottom: "1px solid var(--border)", border: "none" }}
                        value={gameNames[game] ?? (rec?.displayName || game)}
                        onChange={e => setGameNames(prev => ({ ...prev, [game]: e.target.value }))}
                        onBlur={() => handleGameNameBlur(game, gameNames[game] ?? (rec?.displayName || game), rec?.winnerName || "", rec?.image || "")}
                        placeholder={game}
                        disabled={busy}
                      />
                      {/* اسم الفائز */}
                      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
                        <input
                          type="text"
                          className="n-input"
                          style={{ width: "100%", paddingRight: "10px", textAlign: "center", fontSize: "0.85rem" }}
                          placeholder="👑 اسم الفائز"
                          value={winnerDrafts[game] ?? (rec?.winnerName || "")}
                          disabled={busy}
                          onChange={e => setWinnerDrafts(prev => ({ ...prev, [game]: e.target.value }))}
                          onBlur={() => handleWinnerBlur(game, rec?.image || "", rec?.winnerName || "")}
                        />
                      </div>
                      {/* الصورة الإضافية (image2) — تظهر بالمربع الأصفر في الصفحة العامة */}
                      <div style={{ padding: "8px 10px 0", fontSize: "0.72rem", fontWeight: 700, color: "#ffd27d", textAlign: "center" }}>🖼️ الصورة الإضافية</div>
                      <div style={{ width: "100%", aspectRatio: "16/7", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", margin: "4px 0" }}>
                        {rec?.image2 ? <img src={rec.image2} alt={`${game} إضافية`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "1.8rem", opacity: 0.4 }}>➕</span>}
                        {busy && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.8rem", fontWeight: 700 }}>...جارِ الحفظ</div>}
                      </div>
                      <div style={{ display: "flex", gap: "8px", padding: "0 12px 6px" }}>
                        <label className="btn btn-primary" style={{ flex: 1, textAlign: "center", cursor: busy ? "default" : "pointer", fontSize: "0.75rem", padding: "6px 8px", opacity: busy ? 0.6 : 1 }}>
                          {rec?.image2 ? "✏️ تغيير الإضافية" : "🖼️ إضافة إضافية"}
                          <input type="file" accept="image/*" disabled={busy} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleGameImage2(game, f, winnerDrafts[game] ?? (rec?.winnerName || ""), rec?.image || ""); e.currentTarget.value = ""; }} />
                        </label>
                        {rec?.image2 && (
                          <button className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "6px 10px" }} disabled={busy} onClick={() => handleClearGameImage2(game, winnerDrafts[game] ?? (rec?.winnerName || ""), rec?.image || "")} title="حذف الصورة الإضافية">🗑️</button>
                        )}
                      </div>

                      {/* صورة البطولة (image) — تظهر بالمربع الأخضر في الصفحة العامة */}
                      <div style={{ padding: "4px 10px 0", fontSize: "0.72rem", fontWeight: 700, color: "#8ef0a0", textAlign: "center" }}>🏆 صورة البطولة</div>
                      <div style={{ width: "100%", aspectRatio: "4/3", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative", marginTop: "4px" }}>
                        {rec?.image ? <img src={rec.image} alt={game} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "2.6rem", opacity: 0.4 }}>🏆</span>}
                        {busy && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "0.85rem", fontWeight: 700 }}>...جارِ الحفظ</div>}
                      </div>
                      {/* أزرار التعديل */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <label className="btn btn-primary" style={{ flex: 1, textAlign: "center", cursor: busy ? "default" : "pointer", fontSize: "0.8rem", padding: "7px 8px", opacity: busy ? 0.6 : 1 }}>
                            {rec?.image ? "✏️ تغيير الصورة" : "🖼️ إضافة صورة"}
                            <input type="file" accept="image/*" disabled={busy} style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleGameImage(game, f, winnerDrafts[game] ?? (rec?.winnerName || "")); e.currentTarget.value = ""; }} />
                          </label>
                          {rec && (rec.image || rec.image2 || rec.winnerName) && (
                            <button className="btn btn-ghost" style={{ fontSize: "0.8rem", padding: "7px 10px" }} disabled={busy} onClick={() => handleClearGame(rec)} title="تفريغ اللعبة (يبقى الكرت)">🧹</button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "0.78rem", padding: "7px 8px", fontWeight: 800, color: "#f87171", borderColor: "rgba(248,113,113,0.4)" }}
                          disabled={busy}
                          onClick={() => handleDeleteGameCard(rec)}
                          title="حذف الكرت نهائيًا من الأدمن والزوار"
                        >❌ حذف الكرت نهائيًا</button>
                        {rec && (rec.image || rec.winnerName) && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{
                              fontSize: "0.78rem",
                              padding: "7px 8px",
                              fontWeight: 800,
                              color: rec.isHidden ? "#4ade80" : "#fbbf24",
                              borderColor: rec.isHidden ? "rgba(74,222,128,0.35)" : "rgba(251,191,36,0.35)",
                            }}
                            disabled={busy}
                            onClick={() => toggleGameVisibility(rec)}
                            title={rec.isHidden ? "إظهار الكرت للزوار مرة ثانية" : "إخفاء الكرت عن الزوار (بدون حذف)"}
                          >
                            {rec.isHidden ? "👁️ إظهار الكرت" : "🙈 إخفاء الكرت"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: "0.75rem", padding: "6px 8px", whiteSpace: "nowrap" }}
                          disabled={busy}
                          onClick={() => handleGenerateGameImage(game)}
                          title="يولّد صورة تلقائية من البراكيت الحالي + الفائز ويحفظها لهذي اللعبة"
                        >🎨 صورة البطولة الحالية</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {!canTournament && (
              <div className="card" style={{ textAlign: "center", padding: "28px 16px", opacity: 0.85 }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "8px" }}>🔒</div>
                <div style={{ fontWeight: 800, marginBottom: "4px" }}>ما عندك صلاحية إدارة البطولة</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>اطلب من الأدمن الرئيسي يفعّلها لك من "إدارة المساعدين"</div>
              </div>
            )}

            {/* SETUP SCREEN */}
            {canTournament && st.phase === "setup" && (
              <div className="card">
                <div className="size-row">
                  <label>اسم البطولة:</label>
                  <input type="text" className="n-input" style={{ maxWidth: "300px" }} placeholder="IK3MO" value={st.name} onChange={e => setSt(prev => ({ ...prev, name: e.target.value }))} onBlur={() => sync(st)} />
                </div>

                <div className="info-note">
                  <span>📌 اللاعبون ينضمون تلقائياً من الشات · العدد الحالي: <b>{st.players.filter(p => p).length}</b></span>
                </div>

                {/* ⏱️ نافذة الانضمام المؤقتة — بدل ما يضل باب الانضمام مفتوح للأبد */}
                <div className="size-row" style={{ alignItems: "center" }}>
                  <label>⏱️ نافذة الانضمام:</label>
                  {st.joinDeadline ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span
                        style={{
                          fontWeight: 900,
                          fontSize: "1.15rem",
                          color: getJoinSecondsLeft() <= 10 ? "#ef4444" : "var(--blue)",
                          minWidth: "58px",
                        }}
                      >
                        {getJoinSecondsLeft() > 0
                          ? `${String(Math.floor(getJoinSecondsLeft() / 60)).padStart(2, "0")}:${String(getJoinSecondsLeft() % 60).padStart(2, "0")}`
                          : "⛔ انتهى"}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {getJoinSecondsLeft() > 0 ? "الانضمام مفتوح — أي !دخول جديد بعد الوقت ما بينضاف" : "باب الانضمام مقفل الآن"}
                      </span>
                      <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={cancelJoinWindow}>✕ إلغاء المهلة</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="number"
                        className="n-input"
                        style={{ maxWidth: "90px" }}
                        min={1}
                        max={60}
                        value={joinDurationInput}
                        onChange={e => setJoinDurationInput(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>دقيقة</span>
                      <button className="btn btn-primary" style={{ padding: "6px 14px", fontSize: "0.85rem" }} onClick={() => openJoinWindow(joinDurationInput)}>
                        🕐 افتح باب الانضمام
                      </button>
                    </div>
                  )}
                </div>

                <div className="toggle-row">
                  <label style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--muted)" }}>نظام الفرق (Teams):</label>
                  <label className="switch">
                    <input type="checkbox" checked={st.isTeams} onChange={e => toggleTeams(e.target.checked)} />
                    <span className="slider" />
                  </label>
                  <div className={`team-size-control${st.isTeams ? " show" : ""}`}>
                    <label>عدد اللاعبين/فريق:</label>
                    <input type="number" className="team-size-input" value={st.teamSize} min="1" max="10" onChange={e => update({ ...st, teamSize: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })} />
                  </div>
                  {st.isTeams && (
                    <button className="btn btn-ghost" onClick={shuffleTeams} title="يفرّط اللاعبين ويرتبهم بفرق عشوائية جديدة">
                      🎲 ترتيب عشوائي للفرق
                    </button>
                  )}
                </div>

                {/* عرض اللاعبين — في وضع "غير محدود" ما نعرض إلا خانات اللاعبين اللي انضموا فعلاً
                    (تُنشأ تلقائياً بمجرد ما حد يكتب أمر الانضمام بالشات)، بدون أي خانة فارغة زايدة. */}
                <div className="names-grid">
                  {st.players
                    .map((p, i) => ({ i, p }))
                    .filter((x) => x.p)
                    .map(({ i, p }) => (
                    <div key={i} className="n-wrapper">
                      <input
                        type="text"
                        className="n-input"
                        placeholder={`${label} ${i + 1}${st.isTeams && st.teamSize > 1 ? ` (${st.teamSize} لاعبين)` : ""}`}
                        value={p}
                        onChange={e => updatePlayer(i, e.target.value)}
                        onBlur={handlePlayerBlur}
                      />
                      <button className="btn-del" title="حذف" onClick={() => deletePlayer(i)}>✕</button>
                    </div>
                  ))}
                  {st.players.filter(Boolean).length === 0 && (
                    <div className="info-note" style={{ gridColumn: "1 / -1" }}>
                      ⏳ بانتظار انضمام اللاعبين من الشات...
                    </div>
                  )}
                </div>

                <div className="action-row">
                  <button className="btn btn-ghost" onClick={() => { update({ ...st, players: [], entryLog: [] }); }}>🧹 تفريغ</button>
                  <button
                    className={`btn btn-primary${getStartBlockReason() ? " btn-disabled" : ""}`}
                    onClick={startTournament}
                    title={getStartBlockReason() || ""}
                  >
                    🚀 ابدأ البطولة
                  </button>
                </div>

                {/* 🔔 بانر احترافي يظهر تحت زر البدء مباشرة لما العدد غير كافي —
                    بيتحدّث لحظيًا مع كل انضمام جديد من الشات (بدل alert مزعج) */}
                {getStartBlockReason() && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      background: "rgba(255,193,7,0.10)",
                      border: "1px solid rgba(255,193,7,0.35)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, color: "#ffc107" }}>
                      <span>⚠️</span>
                      <span>{getStartBlockReason()}</span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="viewer-badge-dot" style={{ position: "static" }} />
                      متابعة لحظية: <b style={{ color: "var(--blue)" }}>{st.players.filter(p => p).length}</b> {st.isTeams ? "فريق" : "لاعب"} منضم الآن — بانتظار البقية من الشات...
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TOURNAMENT SCREEN */}
            {canTournament && st.phase === "tournament" && (
              <div>
                <div className="toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", gap: "20px" }}>
                  <div className="toolbar-info" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px" }}>
                    <button className="btn btn-ghost" onClick={resetTournament} style={{ padding: "6px 14px", fontSize: "0.85rem" }}>↺ بطولة جديدة</button>
                    <button className="btn btn-ghost" onClick={undoLastWin} disabled={!st.winHistory?.length} title={st.winHistory?.length ? "تراجع عن آخر نتيجة فوز" : "ما فيه نتيجة نتراجع عنها"} style={{ padding: "6px 14px", fontSize: "0.85rem", opacity: st.winHistory?.length ? 1 : 0.4, cursor: st.winHistory?.length ? "pointer" : "not-allowed" }}>↩️ تراجع</button>
                  </div>
                  <div className="toolbar-info" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
                    <span style={{ color: "var(--gold)", fontWeight: 900, fontSize: "1.4rem", whiteSpace: "nowrap", textShadow: "0 0 12px rgba(255,215,0,0.6)" }}>
                      {st.name ? `🏆 ${st.name}` : ""}
                    </span>
                  </div>
                  <div className="toolbar-info" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>{st.isTeams ? "الفرق:" : "اللاعبون:"}</span> <b>{st.players.length}</b>
                    {st.byeN > 0 && <span style={{ color: "var(--blue)" }}>(بايب: {st.byeN})</span>}
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>الجولة الحالية:</span> <b>{st.cur + 1}</b>
                  </div>
                </div>

                <div className="pick-bar">
                  <span className="pick-bar-label">🎲 ماتش عشوائي:</span>
                  <div className="pick-result">
                    <div className={slotClassA}>{slotA}</div>
                    <div className="pick-vs">VS</div>
                    <div className={slotClassB}>{slotB}</div>
                  </div>
                  <button className="btn-pick" onClick={pickRandomMatch} disabled={pickRunning}>🎰 اختر!</button>
                </div>

                <BracketDisplay st={st} isAdmin={true} pickedMatchId={st.pickedMatchId ?? null} onWin={handleWin} />

                {/* ✅ لما تنتهي البطولة (يتحدد البطل) يظهر زر واضح يرجع لصفحة الأدمن الرئيسية (شاشة الإعداد) */}
                {st.champion && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: "24px" }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "12px 28px", fontSize: "0.95rem" }}
                      onClick={resetTournament}
                    >
                      🏠 رجوع للوحة الرئيسية
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button className={`sidebar-toggle${!sidebarHidden ? " sb-active" : ""}`} onClick={() => setSidebarHidden(h => !h)} title={sidebarHidden ? "إظهار الشات" : "إخفاء الشات"}>
          <span>💬</span>
          <span style={{ fontSize: "0.82rem", fontFamily: "Cairo, sans-serif", fontWeight: 700 }}>{sidebarHidden ? "الشات" : "إخفاء"}</span>
        </button>

        <div className={`sidebar${sidebarHidden ? " sidebar-hidden" : ""}`} id="sidebar-container">
          <div className="sidebar-head">
            <div className="kick-badge"><img src={iconImg} alt="IK3MO" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
            <div className="sidebar-title">IK3MO</div>
            <div className={`live-pill${chatStatus === "live" ? " pill-live" : chatStatus === "connecting" ? " pill-checking" : " pill-offline"}`}>
              {chatStatus === "live" ? "🟢 مباشر" : chatStatus === "connecting" ? "🟡 يتحقق..." : "⚫ أوفلاين"}
            </div>
          </div>
          <div className="chat-body">
            <div className="chat-frame-container" style={{ position: "relative" }}>
              {kLive ? (
                <iframe src={`https://kick.com/popout/${CH}/chat`} allow="autoplay;fullscreen" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" style={{ display: "block" }} />
              ) : (
                <div className="chat-offline">
                  <div className="ico">📡</div>
                  <p>جاري التحقق من بث <b>{CH.toUpperCase()}</b> على Kick.<br />الشات يظهر تلقائياً عند البث.</p>
                  <button className="btn-check" onClick={() => kickCheck(true)}>🔄 تحقق الآن</button>
                </div>
              )}
            </div>
            <div className="entry-log-container">
              <div className="entry-log-head">
                <span>👥 {st.isTeams ? "الفرق المسجلة" : "المسجلين من الشات"}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span id="chat-status" style={{ fontSize: "0.6rem", color: "var(--muted)" }}>{chatStatus === "live" ? "🟢 متصل" : "🔴 غير متصل"}</span>
                  <span style={{ color: "var(--kick)" }}>{st.entryLog.length}</span>
                </div>
              </div>
              <div className="entry-log-list">
                {[...st.entryLog].reverse().map((e, i) => (
                  <div key={i} className="entry-item">
                    {e.avatar ? (
                      <img className="avatar" src={e.avatar} alt={e.user} referrerPolicy="no-referrer" />
                    ) : (
                      <div className="status-dot" />
                    )}
                    <div className="user">{e.user}</div>
                    <div className="time">{e.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
            <button className="btn btn-ghost" style={{ flex: 1, padding: "8px", fontSize: "0.78rem" }} onClick={onLogout}>🚪 خروج</button>
          </div>
        </div>
      </div>

    </>
  );
}

interface PusherClient {
  subscribe(channel: string): PusherChannel;
  unsubscribe(channel: string): void;
  connection: { bind(event: string, fn: (...args: unknown[]) => void): void };
}
interface PusherChannel {
  name: string;
  bind(event: string, fn: (...args: unknown[]) => void): void;
  bind_global?(fn: (event: string, data: unknown) => void): void;
  unbind_all(): void;
}
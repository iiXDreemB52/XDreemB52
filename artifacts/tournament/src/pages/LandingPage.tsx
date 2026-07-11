import { useEffect, useMemo, useState } from "react";
import bgImg from "@assets/تصميم بدون عنوان.png";
import { getRecords, useSSE } from "@/lib/api";
import { type TournamentRecord } from "@/lib/types";

export default function LandingPage() {
  const [records, setRecords] = useState<TournamentRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    getRecords().then(setRecords).catch(() => {});
  }, []);

  // تحديث لحظي: أي تعديل من الأدمن (يستدعي broadcast بالخادم) يوصل عبر SSE،
  // فنعيد جلب السجل فوراً بدون ما يحتاج الزائر يحدّث الصفحة يدويًّا.
  useSSE(() => {
    getRecords().then(setRecords).catch(() => {});
  });

  // الكروت ديناميكية: كل سجل غير مخفي = كرت واحد، وكرت محذوف من الأدمن
  // يختفي كامل من هنا تلقائيًا (بدون خانة فاضية مكانه).
  const slots = useMemo(() => {
    return records
      .filter((r) => !r.isHidden)
      .map((r) => ({
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

      `}</style>

      <div className="lp-page">
        <div className="lp-bg" />

        {/* ===== الهيدر: أيقونات السوشل + زر IKEMO + زر مشاهدة البطولة ===== */}
        <nav className="lp-nav">
          <div className="lp-nav-social">
            <a className="lp-nav-icon" href="https://discord.gg/ArYbJ9McA" target="_blank" rel="noopener noreferrer" aria-label="ديسكورد">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a14.6 14.6 0 0 1 4.3 1.7 16.5 16.5 0 0 0-14.9 0 14 14 0 0 1 4.3-1.7L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 9 .3 13.6.6 18a20 20 0 0 0 6 3l1-1.6a12.7 12.7 0 0 1-1.9-.9l.5-.4a14.2 14.2 0 0 0 12 0l.5.4a12.7 12.7 0 0 1-1.9.9l1 1.6a20 20 0 0 0 6-3c.4-5-.7-9.6-3.5-13.6ZM8.7 15.2c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z"/></svg>
            </a>
            <a className="lp-nav-icon" href="https://kick.com/ik3mo" target="_blank" rel="noopener noreferrer" aria-label="كيك">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h5v6.3L12 2h6l-6.6 8L18.5 22h-6.2l-4-6-1.3 1.5V22H2V2Z"/></svg>
            </a>
            <span className="lp-nav-sep" />
            <a className="lp-watch-btn" href="/live" aria-label="مشاهدة البطولة">
              <span className="lp-watch-dot" />
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
    </>
  );
}

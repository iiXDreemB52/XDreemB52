import { useEffect, useMemo, useState } from "react";
import flameLeft from "@assets/flame-left.png";
import flameRight from "@assets/flame-right.png";
import { getRecords, useSSE } from "@/lib/api";
import { type TournamentRecord } from "@/lib/types";

export default function LandingPage() {
  const [records, setRecords] = useState<TournamentRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    getRecords().then(setRecords).catch(() => {});
  }, []);

  useSSE(() => {
    getRecords().then(setRecords).catch(() => {});
  });

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
        *{box-sizing:border-box;margin:0;padding:0}

        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes enterDown{from{opacity:0;transform:translateY(-22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes enterUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes enterScale{0%{opacity:0;transform:scale(.6) rotate(-6deg)}60%{transform:scale(1.07) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes enterCard{from{opacity:0;transform:translateY(32px) scale(.93)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes flameIn{from{opacity:0;transform:scaleY(.7) translateY(30px)}to{opacity:1;transform:scaleY(1) translateY(0)}}
        @keyframes glowPulse{0%,100%{filter:drop-shadow(0 0 18px rgba(255,140,0,.7))}50%{filter:drop-shadow(0 0 36px rgba(255,200,0,.95))}}
        @keyframes fuseFlicker{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.25)}}
        @keyframes raySlide{from{opacity:0;transform:translateX(-60px) skewX(-18deg)}to{opacity:.18;transform:translateX(0) skewX(-18deg)}}
        @keyframes sheenSweep{0%{transform:translateX(-120%) skewX(-20deg)}100%{transform:translateX(220%) skewX(-20deg)}}
        @keyframes trophyFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-5px) rotate(2deg)}}
        @keyframes rgbName{
          0%{color:#ff4500;text-shadow:0 0 10px rgba(255,69,0,.8)}
          33%{color:#ffd700;text-shadow:0 0 10px rgba(255,215,0,.8)}
          66%{color:#ff8c00;text-shadow:0 0 10px rgba(255,140,0,.8)}
          100%{color:#ff4500;text-shadow:0 0 10px rgba(255,69,0,.8)}
        }

        .lp-root{
          min-height:100vh;width:100%;
          font-family:Cairo,Tajawal,sans-serif;
          display:flex;flex-direction:column;
          overflow-x:hidden;
          background:#2a0008;
        }

        /* ===== HERO ===== */
        .lp-hero{
          position:relative;
          width:100%;
          padding-bottom:38%;
          min-height:340px;
          background:linear-gradient(160deg,#FFD700 0%,#FFA500 30%,#FF6A00 65%,#E63200 100%);
          overflow:hidden;
          flex-shrink:0;
        }

        /* شعاعات الضوء المائلة */
        .lp-rays{
          position:absolute;inset:0;pointer-events:none;z-index:1;
          overflow:hidden;
        }
        .lp-ray{
          position:absolute;top:-20%;
          width:7%;height:180%;
          background:rgba(255,255,255,.22);
          transform:skewX(-18deg);
          animation:raySlide .9s ease-out both;
        }
        .lp-ray:nth-child(1){left:8%;animation-delay:.05s}
        .lp-ray:nth-child(2){left:16%;width:3%;background:rgba(255,255,255,.13);animation-delay:.1s}
        .lp-ray:nth-child(3){left:26%;width:9%;animation-delay:.15s}
        .lp-ray:nth-child(4){left:40%;width:4%;background:rgba(255,255,255,.12);animation-delay:.2s}
        .lp-ray:nth-child(5){left:56%;width:8%;animation-delay:.12s}
        .lp-ray:nth-child(6){left:68%;width:3%;background:rgba(255,255,255,.13);animation-delay:.18s}
        .lp-ray:nth-child(7){left:78%;width:10%;animation-delay:.08s}
        .lp-ray:nth-child(8){left:90%;width:5%;background:rgba(255,255,255,.1);animation-delay:.22s}

        /* لوحتان جانبيتان */
        .lp-panel{
          position:absolute;top:8%;bottom:10%;
          width:16%;
          background:rgba(255,120,0,.22);
          border:1.5px solid rgba(255,200,80,.25);
          z-index:2;
          border-radius:4px;
        }
        .lp-panel-l{left:2%}
        .lp-panel-r{right:2%}
        .lp-panel::before{
          content:"";position:absolute;inset:6px;
          border:1px solid rgba(255,210,100,.15);border-radius:2px;
        }

        /* اللهب */
        .lp-flame{
          position:absolute;bottom:0;z-index:3;
          width:22%;max-width:220px;
          animation:flameIn .8s cubic-bezier(.22,1,.36,1) .4s both;
          pointer-events:none;
        }
        .lp-flame-l{left:0;transform-origin:bottom left}
        .lp-flame-r{right:0;transform-origin:bottom right}

        /* محتوى الهيرو */
        .lp-hero-content{
          position:absolute;inset:0;z-index:4;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:10px;padding:20px;
        }

        /* شعار القنبلة */
        .lp-bomb-wrap{
          animation:enterScale .9s cubic-bezier(.22,1,.36,1) .1s both;
        }
        .lp-bomb-svg{
          width:clamp(90px,14vw,160px);height:auto;
          animation:glowPulse 2.8s ease-in-out infinite;
          filter:drop-shadow(0 0 22px rgba(255,120,0,.85));
        }

        /* اسم الموقع */
        .lp-sitename{
          font-size:clamp(2rem,6vw,5rem);
          font-weight:900;
          color:#3D0006;
          letter-spacing:.5px;
          text-shadow:0 2px 0 rgba(255,200,80,.5), 0 4px 12px rgba(0,0,0,.25);
          animation:enterDown .7s cubic-bezier(.22,1,.36,1) .25s both;
          line-height:1;
        }

        /* السطر الفرعي */
        .lp-subtitle{
          font-size:clamp(.75rem,2vw,1.1rem);
          font-weight:700;
          color:#5a0010;
          display:flex;align-items:center;gap:10px;
          animation:enterDown .7s cubic-bezier(.22,1,.36,1) .35s both;
          white-space:nowrap;
        }
        .lp-subtitle-deco{
          display:inline-block;
          width:clamp(16px,3vw,32px);height:2px;
          background:linear-gradient(90deg,transparent,#7a1020);
        }
        .lp-subtitle-deco-r{background:linear-gradient(90deg,#7a1020,transparent)}

        /* ===== شريط التنقل ===== */
        .lp-nav{
          position:absolute;top:0;left:0;right:0;z-index:6;
          display:flex;align-items:center;justify-content:space-between;
          padding:14px 20px;
          animation:fadeIn .6s ease both;
        }
        .lp-nav-social{display:flex;align-items:center;gap:14px}
        .lp-nav-icon{
          width:34px;height:34px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          color:#3D0006;opacity:.85;
          transition:opacity .2s, transform .2s;
        }
        .lp-nav-icon:hover{opacity:1;transform:translateY(-2px)}
        .lp-watch-btn{
          display:flex;align-items:center;gap:8px;
          padding:8px 20px;border-radius:999px;
          background:linear-gradient(135deg,#FF6A00,#C43200);
          color:#fff;font-weight:800;font-size:.85rem;
          text-decoration:none;border:1px solid rgba(255,255,255,.25);
          box-shadow:0 4px 16px rgba(180,50,0,.4);
          transition:transform .2s, box-shadow .2s, filter .2s;
        }
        .lp-watch-btn:hover{transform:translateY(-2px);filter:brightness(1.08);box-shadow:0 8px 22px rgba(180,50,0,.55)}
        .lp-watch-dot{width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 8px #fff;animation:fuseFlicker 1.4s ease-in-out infinite;flex-shrink:0}

        /* ===== قسم الكروت ===== */
        .lp-cards-section{
          flex:1;
          background:linear-gradient(180deg,#2a0008 0%,#1a0005 100%);
          padding:40px 20px 60px;
          display:flex;flex-direction:column;align-items:center;
        }
        .lp-cards-title{
          font-size:clamp(1rem,2.5vw,1.4rem);
          font-weight:900;color:#FF6A00;
          letter-spacing:1px;
          margin-bottom:28px;
          text-shadow:0 0 12px rgba(255,106,0,.5);
          animation:enterDown .7s cubic-bezier(.22,1,.36,1) .5s both;
        }
        .lp-grid{
          width:100%;max-width:1400px;
          display:flex;flex-wrap:wrap;justify-content:center;
          gap:16px;
        }
        .lp-card-wrap{
          flex:0 1 220px;opacity:0;
          animation:enterCard .7s cubic-bezier(.22,1,.36,1) forwards;
          animation-delay:calc(.6s + var(--card-i,0) * .09s);
        }
        @media(max-width:900px){.lp-card-wrap{flex-basis:calc(33.333% - 11px)}}
        @media(max-width:520px){.lp-card-wrap{flex-basis:calc(50% - 8px)}}

        .lp-card-head{
          text-align:center;font-weight:900;
          font-size:clamp(1rem,2.4vw,1.35rem);
          color:#FFB347;letter-spacing:.3px;
          margin-bottom:8px;
          text-shadow:0 0 8px rgba(255,140,0,.4);
        }
        .lp-card{
          background:linear-gradient(180deg,rgba(60,5,15,.9),rgba(30,2,8,.95));
          border:1px solid rgba(255,106,0,.25);
          border-radius:18px;overflow:hidden;
          box-shadow:0 12px 30px rgba(0,0,0,.5);
          transition:transform .2s, box-shadow .2s, border-color .2s;
          display:flex;flex-direction:column;min-height:270px;width:100%;
          position:relative;
          background-size:cover;background-position:center;
        }
        .lp-card::before{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:0;
          background:linear-gradient(180deg,rgba(40,3,10,.35) 0%,rgba(20,1,5,.55) 45%,rgba(10,0,3,.92) 100%);
        }
        .lp-card::after{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:1;
          background:linear-gradient(100deg,transparent 40%,rgba(255,140,0,.12) 50%,transparent 60%);
          transform:translateX(-120%) skewX(-20deg);
          animation:sheenSweep 1.1s ease-out forwards;
          animation-delay:calc(1.05s + var(--card-i,0) * .09s);
        }
        .lp-card:hover{transform:translateY(-4px) scale(1.07);box-shadow:0 20px 44px rgba(255,106,0,.2);border-color:rgba(255,140,0,.6);z-index:5}

        .lp-card-spotlight{
          position:relative;z-index:2;
          flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:12px;padding:32px 14px 20px;
        }
        .lp-card-winner-group{display:flex;flex-direction:column;align-items:center;gap:2px}
        .lp-card-hint{color:rgba(255,180,100,.5);font-size:.7rem;font-weight:700;letter-spacing:.3px}
        .lp-card-winner{
          text-align:center;font-weight:900;
          font-size:clamp(.95rem,2.1vw,1.25rem);
          display:flex;align-items:center;justify-content:center;
        }
        .lp-card-winner.is-empty{color:rgba(255,255,255,.3);font-weight:700;font-size:.75rem}
        .lp-trophy{font-size:1.5rem;line-height:1;animation:trophyFloat 2.6s ease-in-out infinite}
        .rgb-name{
          font-weight:900;
          animation:rgbName 3s ease-in-out infinite;
        }

        /* مودال الصورة */
        .image-modal{position:fixed;inset:0;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);animation:fadeIn .3s ease-out}
        .image-modal-content{position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center}
        .image-modal-img{width:100%;height:100%;object-fit:contain;border-radius:12px;box-shadow:0 25px 50px rgba(0,0,0,.8)}
        .image-modal-close{position:absolute;top:20px;right:20px;background:rgba(255,255,255,.1);border:none;color:#fff;width:44px;height:44px;border-radius:50%;font-size:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;z-index:1001}
        .image-modal-close:hover{background:rgba(255,255,255,.2);transform:scale(1.1)}
      `}</style>

      <div className="lp-root">

        {/* ===== HERO ===== */}
        <div className="lp-hero">

          {/* شعاعات الضوء */}
          <div className="lp-rays">
            <div className="lp-ray" />
            <div className="lp-ray" />
            <div className="lp-ray" />
            <div className="lp-ray" />
            <div className="lp-ray" />
            <div className="lp-ray" />
            <div className="lp-ray" />
            <div className="lp-ray" />
          </div>

          {/* لوحتان جانبيتان */}
          <div className="lp-panel lp-panel-l" />
          <div className="lp-panel lp-panel-r" />

          {/* لهب */}
          <img className="lp-flame lp-flame-l" src={flameLeft} alt="" />
          <img className="lp-flame lp-flame-r" src={flameRight} alt="" />

          {/* شريط التنقل */}
          <nav className="lp-nav">
            <div className="lp-nav-social">
              <a className="lp-nav-icon" href="https://discord.gg/ArYbJ9McA" target="_blank" rel="noopener noreferrer" aria-label="ديسكورد">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a14.6 14.6 0 0 1 4.3 1.7 16.5 16.5 0 0 0-14.9 0 14 14 0 0 1 4.3-1.7L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 9 .3 13.6.6 18a20 20 0 0 0 6 3l1-1.6a12.7 12.7 0 0 1-1.9-.9l.5-.4a14.2 14.2 0 0 0 12 0l.5.4a12.7 12.7 0 0 1-1.9.9l1 1.6a20 20 0 0 0 6-3c.4-5-.7-9.6-3.5-13.6ZM8.7 15.2c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z"/></svg>
              </a>
              <a className="lp-nav-icon" href="https://kick.com/ik3mo" target="_blank" rel="noopener noreferrer" aria-label="كيك">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2 2h5v6.3L12 2h6l-6.6 8L18.5 22h-6.2l-4-6-1.3 1.5V22H2V2Z"/></svg>
              </a>
            </div>
            <a className="lp-watch-btn" href="/live">
              <span className="lp-watch-dot" />
              مشاهدة البطولة
            </a>
          </nav>

          {/* الشعار + الاسم + السطر الفرعي */}
          <div className="lp-hero-content">
            <div className="lp-bomb-wrap">
              {/* شعار القنبلة — SVG */}
              <svg className="lp-bomb-svg" viewBox="0 0 160 170" xmlns="http://www.w3.org/2000/svg">
                {/* هالة التوهج */}
                <radialGradient id="bombGlow" cx="50%" cy="55%" r="45%">
                  <stop offset="0%" stopColor="#FF8C00" stopOpacity=".7"/>
                  <stop offset="100%" stopColor="#FF4500" stopOpacity="0"/>
                </radialGradient>
                <ellipse cx="80" cy="100" rx="62" ry="58" fill="url(#bombGlow)"/>

                {/* الفتيل */}
                <path d="M80 42 Q92 22 106 18 Q118 14 116 26 Q114 36 102 34 Q90 32 84 44"
                  stroke="#8B4513" strokeWidth="4" fill="none" strokeLinecap="round"/>
                {/* شرارة */}
                <circle cx="116" cy="26" r="5" fill="#FFD700">
                  <animate attributeName="r" values="4;7;4" dur=".8s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="1;.5;1" dur=".8s" repeatCount="indefinite"/>
                </circle>
                <circle cx="116" cy="26" r="3" fill="#fff">
                  <animate attributeName="r" values="2;4;2" dur=".8s" repeatCount="indefinite"/>
                </circle>

                {/* جسم القنبلة */}
                <linearGradient id="bombBody" x1="30%" y1="20%" x2="70%" y2="90%">
                  <stop offset="0%" stopColor="#3a3a3a"/>
                  <stop offset="100%" stopColor="#111"/>
                </linearGradient>
                <circle cx="80" cy="105" r="52" fill="url(#bombBody)"/>
                <circle cx="80" cy="105" r="52" fill="none" stroke="#555" strokeWidth="2.5"/>

                {/* لمعة علوية */}
                <ellipse cx="63" cy="82" rx="18" ry="11" fill="rgba(255,255,255,.12)" transform="rotate(-30 63 82)"/>

                {/* حاجب أيسر (غاضب) */}
                <line x1="52" y1="88" x2="72" y2="96" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                {/* حاجب أيمن */}
                <line x1="108" y1="88" x2="88" y2="96" stroke="white" strokeWidth="5" strokeLinecap="round"/>

                {/* عين يسرى × */}
                <line x1="57" y1="101" x2="69" y2="113" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
                <line x1="69" y1="101" x2="57" y2="113" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
                {/* عين يمنى × */}
                <line x1="91" y1="101" x2="103" y2="113" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
                <line x1="103" y1="101" x2="91" y2="113" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>

                {/* فم غاضب */}
                <path d="M62 126 Q80 118 98 126" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
                {/* أنياب */}
                <rect x="71" y="122" width="6" height="9" rx="2" fill="white"/>
                <rect x="83" y="122" width="6" height="9" rx="2" fill="white"/>
              </svg>
            </div>

            <h1 className="lp-sitename">XDreemB52</h1>

            <p className="lp-subtitle">
              <span className="lp-subtitle-deco" />
              ساحة الأبطال منتظرة.. من سيكون البطل القادم؟
              <span className="lp-subtitle-deco lp-subtitle-deco-r" />
            </p>
          </div>
        </div>

        {/* ===== قسم الكروت ===== */}
        <div className="lp-cards-section">
          {slots.length > 0 && (
            <h2 className="lp-cards-title">🏆 أبطال البطولات</h2>
          )}

          <div className="lp-grid">
            {slots.map((slot, i) => (
              <div key={i} className="lp-card-wrap" style={{ ["--card-i" as any]: i }}>
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
                        {slot.winner
                          ? <span className="rgb-name">{slot.winner}</span>
                          : slot.empty ? "" : "— لا يوجد فائز —"}
                      </div>
                    </div>
                    {slot.image && <div className="lp-card-hint">اضغط لعرض الصورة</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {selectedImage && (
        <div className="image-modal" onClick={() => setSelectedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img className="image-modal-img" src={selectedImage} alt="Tournament" />
            <button className="image-modal-close" onClick={() => setSelectedImage(null)}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}

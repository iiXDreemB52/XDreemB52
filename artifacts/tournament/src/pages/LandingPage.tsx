import { useEffect, useMemo, useState } from "react";
import flameLeft  from "@assets/flame-left.png";
import flameRight from "@assets/flame-right.png";
import bombLogo   from "@assets/kemo1_1.icon_1782771567876.png";
import { getRecords, useSSE } from "@/lib/api";
import { type TournamentRecord } from "@/lib/types";

/* زخرفة البرق على جانبي السطر الفرعي */
function Lightning({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="44" height="16"
      viewBox="0 0 44 16"
      style={{ flexShrink: 0, transform: flip ? "scaleX(-1)" : "none" }}
    >
      <line x1="0"  y1="8" x2="10" y2="8" stroke="#8B2200" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="12" y1="8" x2="44" y2="8" stroke="#8B2200" strokeWidth="1.8" strokeLinecap="round"/>
      {/* رأس السهم */}
      <path d="M10 3 L16 8 L10 13 Z" fill="#8B2200"/>
      {/* خط أسفل */}
      <line x1="0" y1="11" x2="44" y2="11" stroke="rgba(180,60,0,.3)" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

export default function LandingPage() {
  const [records, setRecords]         = useState<TournamentRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => { getRecords().then(setRecords).catch(() => {}); }, []);
  useSSE(() => { getRecords().then(setRecords).catch(() => {}); });

  const slots = useMemo(
    () =>
      records
        .filter((r) => !r.isHidden)
        .map((r) => ({
          name:   r.displayName || r.tournamentName,
          winner: r.winnerName  || "",
          image:  r.image       || "",
          image2: r.image2      || "",
        })),
    [records],
  );

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── animations ── */
        @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn   { 0%{opacity:0;transform:scale(.5)} 65%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
        @keyframes cardIn    { from{opacity:0;transform:translateY(26px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sheen     { 0%{transform:translateX(-130%) skewX(-22deg)} 100%{transform:translateX(230%) skewX(-22deg)} }
        @keyframes rayIn     { from{opacity:0} to{opacity:1} }
        @keyframes rgbName   { 0%{color:#FF4500} 33%{color:#FFD700} 66%{color:#FF8C00} 100%{color:#FF4500} }
        @keyframes bobTrophy { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes logoPulse { 0%,100%{filter:drop-shadow(0 0 18px rgba(255,120,0,.7))} 50%{filter:drop-shadow(0 0 38px rgba(255,200,0,.95))} }

        /* ── root ── */
        .lp {
          min-height: 100vh;
          width: 100%;
          font-family: Cairo, Tajawal, 'Noto Sans Arabic', sans-serif;
          display: flex;
          flex-direction: column;
          overflow-x: hidden;
          background: #1a0004;
          direction: rtl;
        }

        /* ════════════════════════════════
           HERO
        ════════════════════════════════ */
        .hero {
          position: relative;
          width: 100%;
          min-height: min(50vw, 460px);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        /* خلفية متدرجة */
        .hero__bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            168deg,
            #FFD700 0%,
            #FFC000 18%,
            #FF8C00 52%,
            #E05000 80%,
            #C03000 100%
          );
        }

        /* شعاعات الضوء */
        .hero__rays {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .ray {
          position: absolute;
          top: -15%;
          height: 140%;
          background: rgba(255,255,255,.13);
          transform: skewX(-18deg);
          animation: rayIn .6s ease-out both;
        }
        .ray:nth-child(1)  { left:  5%; width: 4%;   animation-delay:.04s }
        .ray:nth-child(2)  { left: 11%; width: 2%;   background:rgba(255,255,255,.07); animation-delay:.07s }
        .ray:nth-child(3)  { left: 19%; width: 7%;   animation-delay:.10s }
        .ray:nth-child(4)  { left: 30%; width: 2.5%; background:rgba(255,255,255,.09); animation-delay:.13s }
        .ray:nth-child(5)  { left: 50%; width: 5%;   animation-delay:.08s }
        .ray:nth-child(6)  { left: 60%; width: 2%;   background:rgba(255,255,255,.08); animation-delay:.12s }
        .ray:nth-child(7)  { left: 70%; width: 7%;   animation-delay:.06s }
        .ray:nth-child(8)  { left: 82%; width: 2.5%; background:rgba(255,255,255,.07); animation-delay:.16s }
        .ray:nth-child(9)  { left: 90%; width: 6%;   animation-delay:.03s }

        /* لوحات جانبية شبه شفافة */
        .hero__panels {
          position: absolute;
          inset: 8% 0 12%;
          display: flex;
          justify-content: space-between;
          padding: 0 1.5%;
          pointer-events: none;
          z-index: 2;
        }
        .panels__left  { display: flex; gap: clamp(5px,1vw,10px); }
        .panels__right { display: flex; gap: clamp(5px,1vw,10px); }
        .panel {
          width: clamp(28px,5.5vw,62px);
          background: rgba(255,155,0,.18);
          border: 1.5px solid rgba(255,210,80,.2);
          border-radius: 4px;
        }

        /* اللهب */
        .hero__flame {
          position: absolute;
          bottom: 0;
          width: clamp(88px,15vw,190px);
          z-index: 3;
          pointer-events: none;
          animation: fadeIn .8s ease .3s both;
        }
        .hero__flame--left  { left: 0; }
        .hero__flame--right { right: 0; }

        /* محتوى الهيرو */
        .hero__content {
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px,1.4vw,14px);
          padding: 20px 16px 28px;
          animation: fadeIn .5s ease both;
        }

        /* شعار القنبلة — نقص 28% من الأسفل لقطع نص الصورة */
        .hero__logo-wrap {
          width: clamp(110px,17vw,200px);
          overflow: hidden;
          /* نُظهر فقط 72% العلوية (الجزء الذي فيه الرسم فقط) */
          height: calc(clamp(110px,17vw,200px) * 0.72);
          animation: scaleIn .85s cubic-bezier(.22,1,.36,1) .1s both, logoPulse 3s ease-in-out 1.2s infinite;
          flex-shrink: 0;
        }
        .hero__logo {
          width: 100%;
          height: auto;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
          /* اضبط mix-blend-mode لدمج الخلفية البرتقالية مع الهيرو */
          mix-blend-mode: multiply;
        }

        /* اسم الموقع */
        .hero__name {
          font-size: clamp(2rem,7vw,5.5rem);
          font-weight: 900;
          color: #3a0008;
          letter-spacing: 1px;
          line-height: 1;
          text-shadow:
            0 1px 0 rgba(255,215,80,.45),
            0 3px 12px rgba(0,0,0,.18);
          animation: slideDown .65s cubic-bezier(.22,1,.36,1) .22s both;
        }

        /* سطر فرعي */
        .hero__sub {
          display: flex;
          align-items: center;
          gap: 10px;
          animation: slideDown .65s cubic-bezier(.22,1,.36,1) .34s both;
        }
        .hero__sub-text {
          font-size: clamp(.78rem,1.9vw,1.05rem);
          font-weight: 700;
          color: #5a0010;
          white-space: nowrap;
        }

        /* شريط تنقل */
        .nav {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 6;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          animation: fadeIn .5s ease .05s both;
          direction: ltr;
        }
        .nav__icons { display: flex; gap: 12px; }
        .nav__icon {
          width: 36px; height: 36px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #3a0008; opacity: .8;
          text-decoration: none;
          transition: opacity .2s, transform .2s;
        }
        .nav__icon:hover { opacity: 1; transform: translateY(-2px); }
        .nav__watch {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #FF6A00, #B83200);
          color: #fff;
          font-weight: 800; font-size: .85rem;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,.22);
          box-shadow: 0 4px 16px rgba(160,40,0,.45);
          transition: transform .2s, box-shadow .2s, filter .2s;
          font-family: Cairo, sans-serif;
          direction: rtl;
        }
        .nav__watch:hover { transform: translateY(-2px); filter: brightness(1.1); box-shadow: 0 8px 24px rgba(160,40,0,.6); }
        .nav__dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 8px #fff;
          flex-shrink: 0;
          animation: fadeIn .3s ease .5s both;
        }

        /* ════════════════════════════════
           CARDS SECTION
        ════════════════════════════════ */
        .cards {
          flex: 1;
          background: linear-gradient(175deg, #3a0008 0%, #260005 30%, #180003 70%, #0e0002 100%);
          padding: 40px 20px 60px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cards__title {
          font-size: clamp(.95rem,2.4vw,1.35rem);
          font-weight: 900;
          color: #FF6A00;
          letter-spacing: 1px;
          margin-bottom: 28px;
          text-shadow: 0 0 14px rgba(255,106,0,.5);
          animation: slideDown .7s cubic-bezier(.22,1,.36,1) .5s both;
        }
        .cards__grid {
          width: 100%; max-width: 1380px;
          display: flex; flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
        }

        .card-wrap {
          flex: 0 1 210px;
          opacity: 0;
          animation: cardIn .7s cubic-bezier(.22,1,.36,1) forwards;
          animation-delay: calc(.6s + var(--i, 0) * .09s);
        }
        @media (max-width: 880px) { .card-wrap { flex-basis: calc(33.33% - 11px); } }
        @media (max-width: 520px) { .card-wrap { flex-basis: calc(50% - 8px); } }

        .card__label {
          text-align: center;
          font-weight: 900;
          font-size: clamp(.88rem,2.1vw,1.18rem);
          color: #FFB347;
          margin-bottom: 7px;
          text-shadow: 0 0 8px rgba(255,140,0,.35);
        }
        .card {
          background: linear-gradient(165deg, rgba(55,5,14,.95), rgba(24,2,6,.98));
          border: 1px solid rgba(255,100,0,.22);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 12px 32px rgba(0,0,0,.55);
          min-height: 255px; width: 100%;
          display: flex; flex-direction: column;
          position: relative;
          background-size: cover; background-position: center;
          transition: transform .22s, box-shadow .22s, border-color .22s;
        }
        .card:hover {
          transform: translateY(-5px) scale(1.06);
          box-shadow: 0 22px 48px rgba(255,106,0,.22);
          border-color: rgba(255,140,0,.55);
          z-index: 5;
        }
        .card::before {
          content: "";
          position: absolute; inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(35,2,8,.3) 0%, rgba(15,0,4,.5) 45%, rgba(8,0,2,.92) 100%);
        }
        .card::after {
          content: "";
          position: absolute; inset: 0;
          pointer-events: none; z-index: 1;
          background: linear-gradient(105deg, transparent 40%, rgba(255,140,0,.1) 50%, transparent 60%);
          transform: translateX(-130%) skewX(-22deg);
          animation: sheen 1s ease-out forwards;
          animation-delay: calc(1s + var(--i, 0) * .09s);
        }
        .card__body {
          position: relative; z-index: 2;
          flex: 1;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; padding: 26px 12px 18px;
        }
        .card__trophy { font-size: 1.55rem; animation: bobTrophy 2.6s ease-in-out infinite; }
        .card__winner { font-weight: 900; font-size: clamp(.9rem,1.9vw,1.15rem); text-align: center; }
        .card__winner--empty { color: rgba(255,255,255,.27); font-weight: 600; font-size: .75rem; }
        .card__hint { color: rgba(255,180,100,.42); font-size: .67rem; font-weight: 700; letter-spacing: .2px; }
        .rgb { animation: rgbName 3s ease-in-out infinite; }

        /* modal */
        .modal { position:fixed; inset:0; background:rgba(0,0,0,.94); display:flex; align-items:center; justify-content:center; z-index:1000; backdrop-filter:blur(5px); animation:fadeIn .25s ease; }
        .modal__inner { position:relative; max-width:90vw; max-height:90vh; display:flex; align-items:center; justify-content:center; }
        .modal__img { max-width:100%; max-height:90vh; object-fit:contain; border-radius:10px; box-shadow:0 20px 50px rgba(0,0,0,.8); }
        .modal__close { position:absolute; top:-16px; right:-16px; background:rgba(255,255,255,.12); border:none; color:#fff; width:40px; height:40px; border-radius:50%; font-size:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s, transform .2s; }
        .modal__close:hover { background:rgba(255,255,255,.22); transform:scale(1.1); }
      `}</style>

      <div className="lp">

        {/* ═══ HERO ═══ */}
        <div className="hero">
          <div className="hero__bg" />

          {/* شعاعات الضوء */}
          <div className="hero__rays">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="ray" />)}
          </div>

          {/* اللوحات الجانبية */}
          <div className="hero__panels">
            <div className="panels__left">
              <div className="panel" />
              <div className="panel" />
            </div>
            <div className="panels__right">
              <div className="panel" />
            </div>
          </div>

          {/* اللهب */}
          <img className="hero__flame hero__flame--left"  src={flameLeft}  alt="" />
          <img className="hero__flame hero__flame--right" src={flameRight} alt="" />

          {/* شريط التنقل */}
          <nav className="nav">
            <div className="nav__icons">
              <a className="nav__icon" href="https://discord.gg/ArYbJ9McA" target="_blank" rel="noopener noreferrer" aria-label="ديسكورد">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a14.6 14.6 0 0 1 4.3 1.7 16.5 16.5 0 0 0-14.9 0 14 14 0 0 1 4.3-1.7L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 9 .3 13.6.6 18a20 20 0 0 0 6 3l1-1.6a12.7 12.7 0 0 1-1.9-.9l.5-.4a14.2 14.2 0 0 0 12 0l.5.4a12.7 12.7 0 0 1-1.9.9l1 1.6a20 20 0 0 0 6-3c.4-5-.7-9.6-3.5-13.6ZM8.7 15.2c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z"/>
                </svg>
              </a>
              <a className="nav__icon" href="https://kick.com/ik3mo" target="_blank" rel="noopener noreferrer" aria-label="كيك">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 2h5v6.3L12 2h6l-6.6 8L18.5 22h-6.2l-4-6-1.3 1.5V22H2V2Z"/>
                </svg>
              </a>
            </div>
            <a className="nav__watch" href="/live">
              <span className="nav__dot" />
              مشاهدة البطولة
            </a>
          </nav>

          {/* الشعار + الاسم + العنوان الفرعي */}
          <div className="hero__content">
            <div className="hero__logo-wrap">
              <img className="hero__logo" src={bombLogo} alt="XDreemB52 Logo" />
            </div>
            <h1 className="hero__name">XDreemB52</h1>
            <div className="hero__sub">
              <Lightning />
              <span className="hero__sub-text">ساحة الأبطال منتظرة.. من سيكون البطل القادم؟</span>
              <Lightning flip />
            </div>
          </div>
        </div>

        {/* ═══ قسم الكروت ═══ */}
        <div className="cards">
          {slots.length > 0 && <h2 className="cards__title">🏆 أبطال البطولات</h2>}
          <div className="cards__grid">
            {slots.map((slot, i) => (
              <div key={i} className="card-wrap" style={{ ["--i" as any]: i }}>
                <div className="card__label">{slot.name || "—"}</div>
                <div
                  className="card"
                  style={{
                    cursor: slot.image ? "pointer" : "default",
                    ...(slot.image2 ? { backgroundImage: `url(${slot.image2})` } : {}),
                  }}
                  onClick={() => slot.image && setSelectedImage(slot.image)}
                >
                  <div className="card__body">
                    {slot.winner && <span className="card__trophy">🏆</span>}
                    <div className={`card__winner${slot.winner ? "" : " card__winner--empty"}`}>
                      {slot.winner ? <span className="rgb">{slot.winner}</span> : "— لا يوجد فائز —"}
                    </div>
                    {slot.image && <span className="card__hint">اضغط لعرض الصورة</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* مودال الصورة */}
      {selectedImage && (
        <div className="modal" onClick={() => setSelectedImage(null)}>
          <div className="modal__inner" onClick={(e) => e.stopPropagation()}>
            <img className="modal__img" src={selectedImage} alt="بطولة" />
            <button className="modal__close" onClick={() => setSelectedImage(null)}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}

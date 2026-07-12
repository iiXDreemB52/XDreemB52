import { useEffect, useMemo, useState } from "react";

// الأصول الجديدة
import heroBg    from "@assets/image_1783877889862.png";
import flameImg  from "@assets/{64348214-982E-42FF-A844-8C07F8096007}_1783877846358.png";
import bombLogo  from "@assets/image-0_1783877865511.png";
import titleImg  from "@assets/{6DCA218D-AAED-4493-B8C3-6AB24C769880}_1783877858889.png";

import { getRecords, useSSE } from "@/lib/api";
import { type TournamentRecord } from "@/lib/types";

/* زخرفة البرق على جانبي السطر الفرعي */
function Lightning({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="48" height="16"
      viewBox="0 0 48 16"
      style={{ flexShrink: 0, transform: flip ? "scaleX(-1)" : "none" }}
    >
      <line x1="0" y1="6"  x2="44" y2="6"  stroke="#7a1800" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="0" y1="10" x2="44" y2="10" stroke="#7a1800" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M30 1 L38 8 L30 15 L33 8 Z" fill="#CC3300"/>
      <path d="M22 3 L30 8 L22 13 L25 8 Z" fill="#FF5500" opacity=".7"/>
    </svg>
  );
}

export default function LandingPage() {
  const [records, setRecords]             = useState<TournamentRecord[]>([]);
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
        @keyframes slideDown { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn   { 0%{opacity:0;transform:scale(.45)} 65%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
        @keyframes cardIn    { from{opacity:0;transform:translateY(26px)} to{opacity:1;transform:translateY(0)} }
        @keyframes sheen     { 0%{transform:translateX(-130%) skewX(-22deg)} 100%{transform:translateX(230%) skewX(-22deg)} }
        @keyframes rgbName   { 0%{color:#FF4500} 33%{color:#FFD700} 66%{color:#FF8C00} 100%{color:#FF4500} }
        @keyframes bobTrophy { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes logoPulse { 0%,100%{filter:drop-shadow(0 0 20px rgba(255,130,0,.85))} 50%{filter:drop-shadow(0 0 42px rgba(255,210,0,1))} }
        @keyframes flameIn   { from{opacity:0;transform:scaleX(var(--fx,1)) translateY(12px)} to{opacity:1;transform:scaleX(var(--fx,1)) translateY(0)} }

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
          min-height: min(46vw, 440px);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        /* خلفية الصورة الحقيقية */
        .hero__bg-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          z-index: 0;
          pointer-events: none;
          user-select: none;
        }

        /* شعاعات الضوء خفيفة فوق الصورة */
        .hero__rays {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }
        .ray {
          position: absolute;
          top: -15%;
          height: 140%;
          background: rgba(255,255,255,.09);
          transform: skewX(-18deg);
        }
        .ray:nth-child(1)  { left: 22%; width: 3.5%; }
        .ray:nth-child(2)  { left: 29%; width: 1.8%; background:rgba(255,255,255,.06); }
        .ray:nth-child(3)  { left: 38%; width: 6%;   }
        .ray:nth-child(4)  { left: 50%; width: 2%;   background:rgba(255,255,255,.07); }
        .ray:nth-child(5)  { left: 58%; width: 4.5%; }
        .ray:nth-child(6)  { left: 68%; width: 1.8%; background:rgba(255,255,255,.05); }
        .ray:nth-child(7)  { left: 75%; width: 5.5%; }

        /* لوحات جانبية شبه شفافة — مثل المرجع */
        .hero__panels {
          position: absolute;
          inset: 10% 0 10%;
          display: flex;
          justify-content: space-between;
          padding: 0 clamp(90px,13vw,180px);
          pointer-events: none;
          z-index: 2;
        }
        .panels__left  { display: flex; gap: clamp(6px,1.2vw,12px); }
        .panels__right { display: flex; gap: clamp(6px,1.2vw,12px); }
        .panel {
          width: clamp(30px,5.5vw,66px);
          background: rgba(255,160,0,.14);
          border: 1.5px solid rgba(255,220,80,.18);
          border-radius: 5px;
        }

        /* ظل داكن على أطراف الهيرو يجعل اللهب بارزاً */
        .hero::before, .hero::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0;
          width: clamp(90px,16vw,210px);
          z-index: 2;
          pointer-events: none;
        }
        .hero::before {
          left: 0;
          background: linear-gradient(90deg, rgba(120,20,0,.55) 0%, transparent 100%);
        }
        .hero::after {
          right: 0;
          background: linear-gradient(270deg, rgba(120,20,0,.55) 0%, transparent 100%);
        }

        /* اللهب — كلا الجانبين نفس الصورة */
        .hero__flame {
          position: absolute;
          bottom: 0;
          height: 105%;
          width: clamp(100px,16vw,210px);
          object-fit: cover;
          z-index: 3;
          pointer-events: none;
          animation: flameIn .9s ease .2s both;
          filter: saturate(1.25) contrast(1.1);
        }
        .hero__flame--left  {
          left: 0;
          object-position: left center;
        }
        .hero__flame--right {
          right: 0;
          transform: scaleX(-1);
          object-position: left center;
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
        }

        /* محتوى الهيرو */
        .hero__content {
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(4px,1.2vw,12px);
          padding: 20px 16px 30px;
          animation: fadeIn .5s ease both;
        }

        /* شعار القنبلة — خلفية سوداء تختفي بـ screen */
        .hero__logo-wrap {
          animation: scaleIn .85s cubic-bezier(.22,1,.36,1) .1s both;
          flex-shrink: 0;
        }
        .hero__logo {
          width: clamp(120px,17vw,200px);
          height: auto;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
          mix-blend-mode: screen;
          animation: logoPulse 3s ease-in-out 1.2s infinite;
        }

        /* شعار العنوان — صورة XDreemB52 الذهبية */
        .hero__title-img {
          width: clamp(160px,28vw,380px);
          height: auto;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
          /* إزالة الخلفية الداكنة بـ screen */
          mix-blend-mode: screen;
          animation: slideDown .65s cubic-bezier(.22,1,.36,1) .22s both;
          filter: drop-shadow(0 2px 8px rgba(255,180,0,.5));
        }

        /* سطر فرعي */
        .hero__sub {
          display: flex;
          align-items: center;
          gap: 8px;
          animation: slideDown .65s cubic-bezier(.22,1,.36,1) .34s both;
        }
        .hero__sub-text {
          font-size: clamp(.76rem,1.8vw,1rem);
          font-weight: 700;
          color: #4a0008;
          white-space: nowrap;
        }

        /* خط أحمر فاصل أسفل الهيرو */
        .hero__divider {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, transparent 0%, #CC2200 20%, #FF4400 50%, #CC2200 80%, transparent 100%);
          box-shadow: 0 0 12px rgba(255,60,0,.7), 0 0 24px rgba(255,60,0,.35);
          z-index: 6;
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

          {/* خلفية الصورة الحقيقية */}
          <img className="hero__bg-img" src={heroBg} alt="" aria-hidden="true" />

          {/* شعاعات ضوء خفيفة */}
          <div className="hero__rays">
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className="ray" />)}
          </div>

          {/* لوحات شفافة — يسار: 2، يمين: 1 */}
          <div className="hero__panels">
            <div className="panels__left">
              <div className="panel" />
              <div className="panel" />
            </div>
            <div className="panels__right">
              <div className="panel" />
            </div>
          </div>

          {/* اللهب — نفس الصورة، اليمين مرآة */}
          <img className="hero__flame hero__flame--left"  src={flameImg} alt="" aria-hidden="true" />
          <img className="hero__flame hero__flame--right" src={flameImg} alt="" aria-hidden="true" />

          {/* شريط تنقل */}
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

          {/* الشعار + العنوان الصورة + العنوان الفرعي */}
          <div className="hero__content">
            {/* شعار القنبلة — screen blend يزيل الخلفية السوداء */}
            <div className="hero__logo-wrap">
              <img className="hero__logo" src={bombLogo} alt="XDreemB52 Logo" />
            </div>

            {/* عنوان XDreemB52 كصورة ذهبية */}
            <img
              className="hero__title-img"
              src={titleImg}
              alt="XDreemB52"
            />

            {/* سطر فرعي */}
            <div className="hero__sub">
              <Lightning />
              <span className="hero__sub-text">ساحة الأبطال منتظرة.. من سيكون البطل القادم؟</span>
              <Lightning flip />
            </div>
          </div>

          {/* خط أحمر فاصل */}
          <div className="hero__divider" />
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

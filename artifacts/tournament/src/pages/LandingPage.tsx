import { useEffect, useMemo, useState } from "react";
import flameLeft from "@assets/flame-left.png";
import flameRight from "@assets/flame-right.png";
import { getRecords, useSSE } from "@/lib/api";
import { type TournamentRecord } from "@/lib/types";

/* ─── شعار القنبلة (SVG دقيق) ─── */
function BombLogo() {
  return (
    <svg
      viewBox="0 0 220 260"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "clamp(120px,18vw,200px)", height: "auto", filter: "drop-shadow(0 0 24px rgba(255,130,0,.8))" }}
    >
      <defs>
        {/* خلفية قطرة النار */}
        <radialGradient id="flameDropGrad" cx="48%" cy="62%" r="50%">
          <stop offset="0%" stopColor="#FFD000" />
          <stop offset="55%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#CC4400" />
        </radialGradient>

        {/* وجه القنبلة */}
        <radialGradient id="faceGrad" cx="40%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#2a1a30" />
          <stop offset="60%" stopColor="#160b1e" />
          <stop offset="100%" stopColor="#0a0612" />
        </radialGradient>

        {/* حلقة بنفسجية حول الوجه */}
        <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
          <stop offset="78%" stopColor="transparent" />
          <stop offset="85%" stopColor="#7a2892" />
          <stop offset="100%" stopColor="#4a0e60" />
        </radialGradient>

        {/* توهج العين */}
        <radialGradient id="eyeGlow" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#ff6666" />
          <stop offset="50%" stopColor="#cc0000" />
          <stop offset="100%" stopColor="#880000" />
        </radialGradient>

        {/* ظل تحت الشعار */}
        <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>

        <filter id="eyeBlur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
        </filter>
      </defs>

      {/* ظل ناعم تحت الشعار */}
      <ellipse cx="110" cy="250" rx="70" ry="12" fill="url(#shadowGrad)" />

      {/* ─── شكل قطرة النار ─── */}
      {/* توهج خارجي */}
      <path
        d="M110 14 C110 14, 172 78, 172 148 C172 195 145 228 110 228 C75 228 48 195 48 148 C48 78 110 14 110 14 Z"
        fill="rgba(255,140,0,.25)"
        transform="scale(1.08) translate(-8,-8)"
      />
      {/* القطرة الرئيسية */}
      <path
        d="M110 18 C110 18, 168 78, 168 146 C168 191 142 224 110 224 C78 224 52 191 52 146 C52 78 110 18 110 18 Z"
        fill="url(#flameDropGrad)"
      />
      {/* حافة لامعة للقطرة */}
      <path
        d="M110 18 C110 18, 168 78, 168 146 C168 191 142 224 110 224 C78 224 52 191 52 146 C52 78 110 18 110 18 Z"
        fill="none"
        stroke="rgba(255,220,80,.55)"
        strokeWidth="2.5"
      />
      {/* لمعة علوية داخل القطرة */}
      <path
        d="M98 32 C98 32, 82 68, 80 90 C79 102 86 108 92 100 C98 92 104 60 110 38 Z"
        fill="rgba(255,255,255,.18)"
      />

      {/* ─── الفتيلة / فيوز ─── */}
      {/* حبل الفتيلة */}
      <path
        d="M148 82 Q162 62 156 42 Q150 28 162 18"
        stroke="#7a5520"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* خطوط الفتيلة (إيهام الحبل) */}
      <path
        d="M148 82 Q162 62 156 42 Q150 28 162 18"
        stroke="rgba(255,200,80,.35)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="4 5"
      />
      {/* غطاء الفتيلة المعدني (مستطيل أحمر) */}
      <rect x="155" y="8" width="18" height="26" rx="5" ry="5" fill="#992200" transform="rotate(18,164,21)" />
      <rect x="157" y="10" width="14" height="10" rx="2" fill="#CC3300" transform="rotate(18,164,15)" />
      {/* خطوط على الغطاء */}
      <line x1="158" y1="20" x2="171" y2="17" stroke="rgba(255,100,0,.5)" strokeWidth="1.5" />
      <line x1="158" y1="24" x2="171" y2="21" stroke="rgba(255,100,0,.5)" strokeWidth="1.5" />
      {/* شرارة صغيرة */}
      <circle cx="162" cy="8" r="4.5" fill="#FFD700">
        <animate attributeName="r" values="3.5;6;3.5" dur="0.7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.5;1" dur="0.7s" repeatCount="indefinite" />
      </circle>
      <circle cx="162" cy="8" r="2.5" fill="white">
        <animate attributeName="r" values="2;3.5;2" dur="0.7s" repeatCount="indefinite" />
      </circle>

      {/* ─── وجه القنبلة ─── */}
      {/* توهج الحلقة البنفسجية */}
      <circle cx="110" cy="148" r="62" fill="rgba(140,40,180,.18)" />
      {/* الحلقة البنفسجية */}
      <circle cx="110" cy="148" r="55" fill="none" stroke="#7a2892" strokeWidth="7" />
      {/* داخل الحلقة - تدرج داكن */}
      <circle cx="110" cy="148" r="51.5" fill="url(#faceGrad)" />
      {/* لمعة داخل الوجه */}
      <ellipse cx="92" cy="128" rx="16" ry="10" fill="rgba(255,255,255,.07)" transform="rotate(-25,92,128)" />

      {/* ─── الحاجبان (غاضبان) ─── */}
      {/* حاجب أيسر - ينحدر بشدة للداخل */}
      <line x1="76" y1="120" x2="98" y2="132" stroke="white" strokeWidth="6" strokeLinecap="round" />
      {/* حاجب أيمن */}
      <line x1="144" y1="120" x2="122" y2="132" stroke="white" strokeWidth="6" strokeLinecap="round" />

      {/* ─── العينان ─── */}
      {/* توهج خارجي العين اليسرى */}
      <circle cx="92" cy="148" r="16" fill="rgba(200,0,0,.3)" filter="url(#eyeBlur)" />
      {/* العين اليسرى */}
      <circle cx="92" cy="148" r="12.5" fill="url(#eyeGlow)" />
      <circle cx="92" cy="148" r="12.5" fill="none" stroke="rgba(255,80,80,.6)" strokeWidth="1.5" />
      {/* حدقة العين اليسرى */}
      <circle cx="92" cy="149" r="6" fill="#400000" />
      {/* لمعة العين اليسرى */}
      <circle cx="87" cy="143" r="3.5" fill="rgba(255,255,255,.9)" />
      <circle cx="85" cy="141" r="1.5" fill="white" />

      {/* توهج خارجي العين اليمنى */}
      <circle cx="128" cy="148" r="16" fill="rgba(200,0,0,.3)" filter="url(#eyeBlur)" />
      {/* العين اليمنى */}
      <circle cx="128" cy="148" r="12.5" fill="url(#eyeGlow)" />
      <circle cx="128" cy="148" r="12.5" fill="none" stroke="rgba(255,80,80,.6)" strokeWidth="1.5" />
      {/* حدقة العين اليمنى */}
      <circle cx="128" cy="149" r="6" fill="#400000" />
      {/* لمعة العين اليمنى */}
      <circle cx="123" cy="143" r="3.5" fill="rgba(255,255,255,.9)" />
      <circle cx="121" cy="141" r="1.5" fill="white" />

      {/* ─── علامة الأنف / تعبير الغضب ─── */}
      <path d="M104 164 L110 158 L116 164" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── ديكورات البرق على جانبي العنوان الفرعي ─── */
function LightningDeco({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="40" height="14" viewBox="0 0 40 14" style={{ transform: flip ? "scaleX(-1)" : "none" }}>
      <path d="M0 7 L12 7 M14 7 L20 1 L22 7 L28 7 M30 7 L40 7" stroke="#CC4400" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 1 L22 7 L18 7 Z" fill="#CC4400" />
      <line x1="0" y1="10" x2="40" y2="10" stroke="rgba(200,80,0,.4)" strokeWidth="1" />
    </svg>
  );
}

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
      }));
  }, [records]);

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}

        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes scaleIn{0%{opacity:0;transform:scale(.55)}70%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
        @keyframes cardIn{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes flameEnter{from{opacity:0;transform:scaleY(.6) translateY(40px)}to{opacity:1;transform:scaleY(1) translateY(0)}}
        @keyframes rgbName{0%{color:#FF4500}33%{color:#FFD700}66%{color:#FF8C00}100%{color:#FF4500}}
        @keyframes trophyBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes sheen{0%{transform:translateX(-130%) skewX(-22deg)}100%{transform:translateX(230%) skewX(-22deg)}}
        @keyframes rayPop{from{opacity:0;transform:translateX(-30px) skewX(-18deg)}to{opacity:1;transform:skewX(-18deg)}}

        .lp-root{
          min-height:100vh;width:100%;
          font-family:Cairo,Tajawal,'Noto Sans Arabic',sans-serif;
          display:flex;flex-direction:column;
          overflow-x:hidden;
          background:#1a0006;
          direction:rtl;
        }

        /* ═══ HERO ═══ */
        .hero{
          position:relative;width:100%;
          min-height:min(52vw,480px);
          display:flex;align-items:center;justify-content:center;
          overflow:hidden;flex-shrink:0;
        }

        /* تدرج الخلفية — أصفر للأعلى، برتقالي للأسفل */
        .hero-bg{
          position:absolute;inset:0;
          background:linear-gradient(170deg,#FFD700 0%,#FFC200 20%,#FF8C00 55%,#DD4A00 85%,#C23000 100%);
        }

        /* شعاعات الضوء المائلة */
        .rays{position:absolute;inset:0;overflow:hidden;pointer-events:none}
        .ray{
          position:absolute;top:-10%;height:130%;
          background:rgba(255,255,255,.14);
          transform:skewX(-18deg);
          transform-origin:top center;
          animation:rayPop .7s ease-out both;
        }
        .ray:nth-child(1){left:6%;width:5%;animation-delay:.05s}
        .ray:nth-child(2){left:14%;width:2.5%;background:rgba(255,255,255,.08);animation-delay:.08s}
        .ray:nth-child(3){left:22%;width:7%;animation-delay:.11s}
        .ray:nth-child(4){left:34%;width:3%;background:rgba(255,255,255,.1);animation-delay:.14s}
        .ray:nth-child(5){left:52%;width:6%;animation-delay:.09s}
        .ray:nth-child(6){left:64%;width:2.5%;background:rgba(255,255,255,.09);animation-delay:.13s}
        .ray:nth-child(7){left:74%;width:7%;animation-delay:.07s}
        .ray:nth-child(8){left:87%;width:4%;background:rgba(255,255,255,.07);animation-delay:.17s}
        .ray:nth-child(9){left:93%;width:8%;animation-delay:.04s}

        /* لوحات جانبية */
        .panels{position:absolute;inset:0;pointer-events:none;display:flex;align-items:stretch}
        .panels-left,.panels-right{display:flex;gap:8px;align-items:stretch;padding:10px 12px}
        .panels-left{flex-direction:row}
        .panels-right{flex-direction:row-reverse}
        .panel-group{display:flex;gap:8px}
        .panel{
          width:clamp(30px,6vw,68px);
          background:rgba(255,165,0,.2);
          border:1.5px solid rgba(255,210,80,.22);
          border-radius:4px;
        }

        /* ─── اللهب على الجوانب ─── */
        .flame{
          position:absolute;bottom:0;z-index:4;
          width:clamp(100px,16vw,200px);
          pointer-events:none;
          animation:flameEnter .9s cubic-bezier(.22,1,.36,1) .35s both;
        }
        .flame-left{left:0;transform-origin:bottom left}
        .flame-right{right:0;transform-origin:bottom right}

        /* ─── المحتوى المركزي ─── */
        .hero-inner{
          position:relative;z-index:5;
          display:flex;flex-direction:column;align-items:center;
          gap:clamp(6px,1.5vw,14px);
          padding:24px 16px 32px;
          animation:fadeIn .5s ease both;
        }

        .logo-wrap{animation:scaleIn .85s cubic-bezier(.22,1,.36,1) .1s both}

        .site-name{
          font-size:clamp(2.2rem,7vw,5.5rem);
          font-weight:900;
          color:#3a0008;
          letter-spacing:1px;
          text-shadow:
            0 1px 0 rgba(255,210,80,.4),
            0 3px 10px rgba(0,0,0,.2);
          animation:slideDown .65s cubic-bezier(.22,1,.36,1) .25s both;
          line-height:1;
        }

        .subtitle-row{
          display:flex;align-items:center;gap:10px;
          animation:slideDown .65s cubic-bezier(.22,1,.36,1) .36s both;
        }
        .subtitle-text{
          font-size:clamp(.8rem,2vw,1.05rem);
          font-weight:700;
          color:#5a0010;
          white-space:nowrap;
        }

        /* ─── شريط تنقل ─── */
        .nav{
          position:absolute;top:0;left:0;right:0;z-index:6;
          display:flex;align-items:center;justify-content:space-between;
          padding:12px 18px;
          animation:fadeIn .5s ease .05s both;
          direction:ltr;
        }
        .nav-icons{display:flex;gap:12px}
        .nav-icon{
          width:36px;height:36px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          color:#3a0008;opacity:.8;
          transition:opacity .2s,transform .2s;
          text-decoration:none;
        }
        .nav-icon:hover{opacity:1;transform:translateY(-2px)}
        .watch-btn{
          display:flex;align-items:center;gap:8px;
          padding:8px 22px;border-radius:999px;
          background:linear-gradient(135deg,#FF6A00,#B83200);
          color:#fff;font-weight:800;font-size:.85rem;
          text-decoration:none;
          border:1px solid rgba(255,255,255,.22);
          box-shadow:0 4px 16px rgba(160,40,0,.45);
          transition:transform .2s,box-shadow .2s,filter .2s;
          font-family:Cairo,sans-serif;
          direction:rtl;
        }
        .watch-btn:hover{transform:translateY(-2px);filter:brightness(1.1);box-shadow:0 8px 24px rgba(160,40,0,.6)}
        .live-dot{
          width:8px;height:8px;border-radius:50%;background:#fff;
          box-shadow:0 0 8px #fff;flex-shrink:0;
          animation:rayPop .3s ease-out .5s both;
        }

        /* ─── قسم الكروت ─── */
        .cards-section{
          flex:1;
          background:linear-gradient(175deg,#3a0008 0%,#280005 30%,#1a0004 70%,#0f0002 100%);
          padding:40px 20px 60px;
          display:flex;flex-direction:column;align-items:center;
        }

        .cards-title{
          font-size:clamp(1rem,2.5vw,1.35rem);
          font-weight:900;color:#FF6A00;
          letter-spacing:1px;margin-bottom:28px;
          text-shadow:0 0 14px rgba(255,106,0,.5);
          animation:slideUp .7s cubic-bezier(.22,1,.36,1) .5s both;
        }

        .cards-grid{
          width:100%;max-width:1380px;
          display:flex;flex-wrap:wrap;justify-content:center;gap:16px;
        }

        .card-wrap{
          flex:0 1 210px;opacity:0;
          animation:cardIn .7s cubic-bezier(.22,1,.36,1) forwards;
          animation-delay:calc(.6s + var(--i,0)*.09s);
        }
        @media(max-width:880px){.card-wrap{flex-basis:calc(33.33% - 11px)}}
        @media(max-width:520px){.card-wrap{flex-basis:calc(50% - 8px)}}

        .card-label{
          text-align:center;font-weight:900;
          font-size:clamp(.9rem,2.2vw,1.2rem);
          color:#FFB347;margin-bottom:7px;
          text-shadow:0 0 8px rgba(255,140,0,.35);
        }
        .card{
          background:linear-gradient(165deg,rgba(55,5,14,.95),rgba(25,2,6,.98));
          border:1px solid rgba(255,100,0,.22);
          border-radius:16px;overflow:hidden;
          box-shadow:0 12px 32px rgba(0,0,0,.55);
          min-height:260px;width:100%;
          display:flex;flex-direction:column;
          position:relative;
          background-size:cover;background-position:center;
          transition:transform .22s,box-shadow .22s,border-color .22s;
        }
        .card:hover{transform:translateY(-5px) scale(1.06);box-shadow:0 22px 48px rgba(255,106,0,.2);border-color:rgba(255,140,0,.55);z-index:5}
        .card::before{
          content:"";position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(180deg,rgba(35,2,8,.3) 0%,rgba(15,0,4,.5) 45%,rgba(8,0,2,.92) 100%);
        }
        .card::after{
          content:"";position:absolute;inset:0;pointer-events:none;z-index:1;
          background:linear-gradient(105deg,transparent 40%,rgba(255,140,0,.1) 50%,transparent 60%);
          transform:translateX(-130%) skewX(-22deg);
          animation:sheen 1s ease-out forwards;
          animation-delay:calc(1s + var(--i,0)*.09s);
        }

        .card-body{
          position:relative;z-index:2;flex:1;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:10px;padding:28px 12px 18px;
        }
        .trophy{font-size:1.6rem;animation:trophyBob 2.6s ease-in-out infinite}
        .winner{font-weight:900;font-size:clamp(.95rem,2vw,1.2rem);text-align:center}
        .winner.empty{color:rgba(255,255,255,.28);font-weight:600;font-size:.75rem}
        .rgb{animation:rgbName 3s ease-in-out infinite}
        .img-hint{color:rgba(255,180,100,.45);font-size:.68rem;font-weight:700;letter-spacing:.2px}

        /* مودال الصورة */
        .modal{position:fixed;inset:0;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(5px);animation:fadeIn .25s ease}
        .modal-inner{position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center}
        .modal-img{max-width:100%;max-height:90vh;object-fit:contain;border-radius:10px;box-shadow:0 20px 50px rgba(0,0,0,.8)}
        .modal-close{position:absolute;top:-16px;right:-16px;background:rgba(255,255,255,.12);border:none;color:#fff;width:40px;height:40px;border-radius:50%;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,transform .2s}
        .modal-close:hover{background:rgba(255,255,255,.22);transform:scale(1.1)}
      `}</style>

      <div className="lp-root">

        {/* ═══ HERO ═══ */}
        <div className="hero">
          {/* خلفية متدرجة */}
          <div className="hero-bg" />

          {/* شعاعات الضوء */}
          <div className="rays">
            {Array.from({ length: 9 }).map((_, i) => <div key={i} className="ray" />)}
          </div>

          {/* لوحتان جانبيتان */}
          <div className="panels" style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", pointerEvents: "none", zIndex: 2 }}>
            {/* اليسار */}
            <div style={{ display: "flex", gap: 8, padding: "12px 14px", alignItems: "stretch" }}>
              <div className="panel" />
              <div className="panel" />
            </div>
            {/* المنتصف - فارغ */}
            <div />
            {/* اليمين */}
            <div style={{ display: "flex", gap: 8, padding: "12px 14px", alignItems: "stretch", justifyContent: "flex-end" }}>
              <div className="panel" />
            </div>
          </div>

          {/* اللهب على الجانبين */}
          <img className="flame flame-left" src={flameLeft} alt="" />
          <img className="flame flame-right" src={flameRight} alt="" />

          {/* شريط التنقل */}
          <nav className="nav">
            <div className="nav-icons">
              <a className="nav-icon" href="https://discord.gg/ArYbJ9McA" target="_blank" rel="noopener noreferrer" aria-label="ديسكورد">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.24.5a14.6 14.6 0 0 1 4.3 1.7 16.5 16.5 0 0 0-14.9 0 14 14 0 0 1 4.3-1.7L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 9 .3 13.6.6 18a20 20 0 0 0 6 3l1-1.6a12.7 12.7 0 0 1-1.9-.9l.5-.4a14.2 14.2 0 0 0 12 0l.5.4a12.7 12.7 0 0 1-1.9.9l1 1.6a20 20 0 0 0 6-3c.4-5-.7-9.6-3.5-13.6ZM8.7 15.2c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm6.6 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z" />
                </svg>
              </a>
              <a className="nav-icon" href="https://kick.com/ik3mo" target="_blank" rel="noopener noreferrer" aria-label="كيك">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 2h5v6.3L12 2h6l-6.6 8L18.5 22h-6.2l-4-6-1.3 1.5V22H2V2Z" />
                </svg>
              </a>
            </div>
            <a className="watch-btn" href="/live">
              <span className="live-dot" />
              مشاهدة البطولة
            </a>
          </nav>

          {/* المحتوى المركزي */}
          <div className="hero-inner">
            <div className="logo-wrap">
              <BombLogo />
            </div>

            <h1 className="site-name">XDreemB52</h1>

            <div className="subtitle-row">
              <LightningDeco />
              <span className="subtitle-text">ساحة الأبطال منتظرة.. من سيكون البطل القادم؟</span>
              <LightningDeco flip />
            </div>
          </div>
        </div>

        {/* ═══ قسم الكروت ═══ */}
        <div className="cards-section">
          {slots.length > 0 && (
            <h2 className="cards-title">🏆 أبطال البطولات</h2>
          )}
          <div className="cards-grid">
            {slots.map((slot, i) => (
              <div key={i} className="card-wrap" style={{ ["--i" as any]: i }}>
                <div className="card-label">{slot.name || "—"}</div>
                <div
                  className="card"
                  style={{
                    cursor: slot.image ? "pointer" : "default",
                    ...(slot.image2 ? { backgroundImage: `url(${slot.image2})` } : {}),
                  }}
                  onClick={() => slot.image && setSelectedImage(slot.image)}
                >
                  <div className="card-body">
                    {slot.winner && <span className="trophy">🏆</span>}
                    <div className={`winner${slot.winner ? "" : " empty"}`}>
                      {slot.winner
                        ? <span className="rgb">{slot.winner}</span>
                        : "— لا يوجد فائز —"}
                    </div>
                    {slot.image && <span className="img-hint">اضغط لعرض الصورة</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {selectedImage && (
        <div className="modal" onClick={() => setSelectedImage(null)}>
          <div className="modal-inner" onClick={(e) => e.stopPropagation()}>
            <img className="modal-img" src={selectedImage} alt="بطولة" />
            <button className="modal-close" onClick={() => setSelectedImage(null)}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}

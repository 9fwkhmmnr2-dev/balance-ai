"use client";

import { useState } from "react";

const starters = [
  { icon: "◷", title: "¿Cómo vienen mis finanzas?", detail: "Una mirada general a tu situación" },
  { icon: "↗", title: "¿En qué estoy gastando más?", detail: "Encontrá patrones en tus movimientos" },
  { icon: "◎", title: "Quiero organizar mis objetivos", detail: "Pensá próximos pasos con claridad" }
];

export default function VeraView() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="vera-page">
      <style>{`
        .vera-page{--v:#a78bfa;--v2:#7c3aed;--ink:#09090d;--panel:#14121c;--line:rgba(196,181,253,.13);color:#f5f3fa;max-width:1120px;margin:0 auto;padding:12px 0 56px}
        .vera-hero{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:28px;background:radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.25),transparent 55%),linear-gradient(145deg,#171222,#0b0a10 72%);padding:34px 28px 30px;text-align:center}
        .vera-orbit{width:112px;height:112px;margin:0 auto 22px;border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 35% 28%,#c4b5fd,#8b5cf6 38%,#3b176f 72%,#171020);box-shadow:0 0 0 9px rgba(167,139,250,.07),0 0 55px rgba(139,92,246,.28),inset 0 2px 10px rgba(255,255,255,.28);animation:vera-breathe 4s ease-in-out infinite}
        .vera-orbit:before,.vera-orbit:after{content:"";position:absolute;inset:-12px;border:1px solid rgba(196,181,253,.22);border-radius:50%;animation:vera-pulse 4s ease-out infinite}
        .vera-orbit:after{animation-delay:2s}
        .vera-symbol{font:700 48px/1 Georgia,serif;color:#fff;text-shadow:0 2px 16px rgba(35,10,75,.5)}
        .vera-eyebrow{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#c4b5fd;font-weight:700}
        .vera-hero h1{font-size:clamp(32px,6vw,48px);letter-spacing:-1.8px;margin:12px 0 9px;font-weight:750}
        .vera-hero h1 span{color:#c4b5fd}
        .vera-sub{max-width:540px;margin:0 auto;color:#b8b2c5;font-size:15px;line-height:1.7}
        .vera-status{display:inline-flex;align-items:center;gap:8px;margin-top:22px;border:1px solid rgba(167,139,250,.23);background:rgba(139,92,246,.1);border-radius:30px;padding:8px 13px;color:#d8ccff;font-size:12px}
        .vera-dot{width:7px;height:7px;border-radius:50%;background:#a78bfa;box-shadow:0 0 12px #a78bfa}
        .vera-section{margin-top:28px}
        .vera-section h2{font-size:16px;letter-spacing:-.2px;margin:0 0 14px;color:#f3efff}
        .vera-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .vera-card{min-height:124px;text-align:left;border:1px solid var(--line);border-radius:18px;padding:17px;background:linear-gradient(145deg,rgba(30,24,43,.94),rgba(15,13,20,.96));color:#f5f3fa;cursor:pointer;transition:transform .2s,border-color .2s,background .2s}
        .vera-card:hover,.vera-card.is-selected{transform:translateY(-2px);border-color:rgba(196,181,253,.55);background:linear-gradient(145deg,rgba(54,37,79,.9),rgba(15,13,20,.98))}
        .vera-card-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:rgba(167,139,250,.13);color:#c4b5fd;font-size:19px;margin-bottom:13px}
        .vera-card strong{display:block;font-size:13px;margin-bottom:6px}
        .vera-card small{display:block;color:#aaa2b8;font-size:11px;line-height:1.5}
        .vera-note{margin-top:22px;border:1px solid var(--line);border-radius:18px;padding:17px 18px;background:rgba(20,18,28,.72);display:flex;gap:12px;align-items:flex-start}
        .vera-note-mark{color:#c4b5fd;font-size:18px}
        .vera-note p{font-size:12px;line-height:1.65;color:#aaa2b8;margin:0}
        .vera-note strong{color:#e9ddff}
        @keyframes vera-breathe{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.045);filter:brightness(1.12)}}
        @keyframes vera-pulse{0%{transform:scale(.92);opacity:.7}100%{transform:scale(1.2);opacity:0}}
        @media(max-width:700px){.vera-page{padding-top:2px}.vera-hero{padding:30px 19px 25px;border-radius:22px}.vera-orbit{width:96px;height:96px}.vera-symbol{font-size:42px}.vera-cards{grid-template-columns:1fr}.vera-card{min-height:unset;padding:15px}.vera-card-icon{float:left;margin:0 12px 0 0}.vera-card strong{padding-top:2px}.vera-card small{padding-top:4px}.vera-section{margin-top:24px}}
        @media(prefers-reduced-motion:reduce){.vera-orbit,.vera-orbit:before,.vera-orbit:after{animation:none}.vera-card{transition:none}}
      `}</style>
      <section className="vera-hero" aria-labelledby="vera-title">
        <div className="vera-orbit" aria-hidden="true"><span className="vera-symbol">V</span></div>
        <div className="vera-eyebrow">Tu compañera financiera</div>
        <h1 id="vera-title">Hola, soy <span>VERA.</span></h1>
        <p className="vera-sub">Estoy acá para ayudarte a entender tu dinero, descubrir oportunidades y tomar decisiones con más claridad. Vamos paso a paso.</p>
        <div className="vera-status"><span className="vera-dot" /> Preparando mi conexión inteligente</div>
      </section>
      <section className="vera-section" aria-labelledby="vera-start-title">
        <h2 id="vera-start-title">¿Por dónde empezamos?</h2>
        <div className="vera-cards">
          {starters.map((item, index) => (
            <button type="button" key={item.title} className={`vera-card ${selected === index ? "is-selected" : ""}`} onClick={() => setSelected(index)} aria-pressed={selected === index}>
              <span className="vera-card-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>
      </section>
      <div className="vera-note">
        <span className="vera-note-mark" aria-hidden="true">✦</span>
        <p><strong>Estoy preparándome para conocerte.</strong> En cuanto conectemos el motor de IA, vas a poder conversar conmigo y analizar tus datos financieros reales de forma privada y segura. Por ahora, estas opciones son una vista previa y todavía no envían consultas.</p>
      </div>
    </div>
  );
}

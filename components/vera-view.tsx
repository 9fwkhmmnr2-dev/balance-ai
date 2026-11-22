"use client";

import { FormEvent, useState } from "react";
import { supabase } from "../lib/supabase";

type ChatMessage = { role: "user" | "model"; content: string };
type Period = "daily" | "weekly" | "monthly" | "yearly";

const starters = [
  "¿Cómo vienen mis finanzas este mes?",
  "¿En qué estoy gastando más?",
  "Ayudame a entender mis gastos.",
];

const periodLabels: Record<Period, string> = {
  daily: "Hoy",
  weekly: "Últimos 7 días",
  monthly: "Este mes",
  yearly: "Este año",
};

export default function VeraView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function sendMessage(value: string) {
    const text = value.trim();
    if (!text || sending) return;

    setError("");
    setDraft("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setSending(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        throw new Error("Tu sesión no está disponible. Volvé a iniciar sesión.");
      }

      const response = await fetch("/api/vera/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: nextMessages.slice(-11).filter((message, index, list) => index > 0 || message.role === "user"),
          period,
        }),
      });
      const payload = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "No pude recibir una respuesta de VERA.");
      }
      setMessages((current) => [...current, { role: "model", content: payload.reply! }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude conectar con VERA.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  return (
    <div className="vera-page">
      <style>{`
        .vera-page{--v:#a78bfa;--v2:#7c3aed;--ink:#09090d;--panel:#14121c;--line:rgba(196,181,253,.15);color:#f5f3fa;max-width:1000px;margin:0 auto;padding:12px 0 48px}
        .vera-hero{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:26px;background:radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.25),transparent 55%),linear-gradient(145deg,#171222,#0b0a10 72%);padding:26px 24px;text-align:center}
        .vera-orbit{width:76px;height:76px;margin:0 auto 15px;border-radius:50%;display:grid;place-items:center;position:relative;background:radial-gradient(circle at 35% 28%,#c4b5fd,#8b5cf6 38%,#3b176f 72%,#171020);box-shadow:0 0 0 7px rgba(167,139,250,.07),0 0 40px rgba(139,92,246,.25),inset 0 2px 10px rgba(255,255,255,.28);animation:vera-breathe 4s ease-in-out infinite}
        .vera-orbit:before,.vera-orbit:after{content:"";position:absolute;inset:-9px;border:1px solid rgba(196,181,253,.22);border-radius:50%;animation:vera-pulse 4s ease-out infinite}
        .vera-orbit:after{animation-delay:2s}
        .vera-symbol{font:700 37px/1 Georgia,serif;color:white;text-shadow:0 2px 16px rgba(35,10,75,.5)}
        .vera-eyebrow{font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:#c4b5fd;font-weight:700}
        .vera-hero h1{font-size:clamp(28px,5vw,38px);letter-spacing:-1.4px;margin:9px 0 7px;font-weight:750}
        .vera-hero h1 span{color:#c4b5fd}
        .vera-sub{max-width:520px;margin:0 auto;color:#b8b2c5;font-size:13px;line-height:1.65}
        .vera-status{display:inline-flex;align-items:center;gap:8px;margin-top:15px;border:1px solid rgba(167,139,250,.23);background:rgba(139,92,246,.1);border-radius:30px;padding:7px 12px;color:#d8ccff;font-size:11px}
        .vera-dot{width:7px;height:7px;border-radius:50%;background:#a78bfa;box-shadow:0 0 12px #a78bfa}
        .vera-chat{margin-top:20px;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:linear-gradient(160deg,#15121e,#0d0c12)}
        .vera-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line)}
        .vera-chat-head strong{font-size:13px}.vera-chat-head small{display:block;color:#9e96ad;font-size:11px;margin-top:3px}
        .vera-period{background:#1c1728;border:1px solid rgba(196,181,253,.2);border-radius:9px;padding:8px;color:#ddd3f2;font-size:11px;max-width:150px}
        .vera-messages{display:flex;flex-direction:column;gap:13px;min-height:245px;max-height:470px;overflow-y:auto;padding:20px 17px}
        .vera-empty{margin:auto;text-align:center;max-width:430px;padding:12px}
        .vera-empty-mark{font-size:25px;color:#c4b5fd;margin-bottom:9px}
        .vera-empty strong{display:block;font-size:14px;color:#eee8f8;margin-bottom:6px}
        .vera-empty p{font-size:12px;line-height:1.6;color:#a9a1b4}
        .vera-bubble{max-width:84%;padding:12px 14px;border-radius:16px;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere}
        .vera-bubble.model{align-self:flex-start;background:#211a2d;border:1px solid rgba(196,181,253,.12);color:#eee9f6;border-top-left-radius:5px}
        .vera-bubble.user{align-self:flex-end;background:linear-gradient(135deg,#7040bd,#59319d);color:#fff;border-top-right-radius:5px}
        .vera-thinking{align-self:flex-start;color:#c4b5fd;font-size:12px;padding:5px 10px}
        .vera-starters{display:flex;flex-wrap:wrap;gap:7px;padding:0 17px 15px}
        .vera-starter{border:1px solid rgba(196,181,253,.2);background:#191522;color:#d8cafa;border-radius:20px;padding:8px 11px;font-size:11px;cursor:pointer}
        .vera-starter:disabled{opacity:.5;cursor:default}
        .vera-compose{padding:13px 15px 15px;border-top:1px solid var(--line);background:rgba(8,7,12,.45)}
        .vera-compose form{display:flex;align-items:flex-end;gap:9px}
        .vera-input{flex:1;min-width:0;resize:vertical;min-height:46px;max-height:120px;background:#171320;border:1px solid rgba(196,181,253,.2);border-radius:14px;padding:12px;color:#f5f3fa;font:inherit;font-size:13px;outline:none}
        .vera-input:focus{border-color:#a78bfa;box-shadow:0 0 0 3px rgba(167,139,250,.1)}
        .vera-send{width:46px;height:46px;flex-shrink:0;border:0;border-radius:14px;background:linear-gradient(145deg,#a78bfa,#7c3aed);color:white;font-size:20px;cursor:pointer}
        .vera-send:disabled{opacity:.45;cursor:default}
        .vera-error{padding:0 17px 13px;color:#f0b4c0;font-size:12px}
        .vera-privacy{margin:12px 3px 0;color:#898194;font-size:10px;line-height:1.6;text-align:center}
        @keyframes vera-breathe{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.045);filter:brightness(1.12)}}
        @keyframes vera-pulse{0%{transform:scale(.92);opacity:.7}100%{transform:scale(1.2);opacity:0}}
        @media(max-width:650px){.vera-page{padding-top:2px}.vera-hero{padding:24px 17px;border-radius:21px}.vera-chat{border-radius:18px}.vera-messages{min-height:220px;padding:16px 12px}.vera-bubble{max-width:92%}.vera-chat-head{padding:13px}.vera-starters{padding:0 12px 13px}.vera-compose{padding:11px}.vera-period{max-width:125px}}
        @media(prefers-reduced-motion:reduce){.vera-orbit,.vera-orbit:before,.vera-orbit:after{animation:none}}
      `}</style>

      <section className="vera-hero" aria-labelledby="vera-title">
        <div className="vera-orbit" aria-hidden="true"><span className="vera-symbol">V</span></div>
        <div className="vera-eyebrow">Tu compañera financiera</div>
        <h1 id="vera-title">Hola, soy <span>VERA.</span></h1>
        <p className="vera-sub">Estoy acá para ayudarte a entender tu dinero, descubrir oportunidades y tomar decisiones con más claridad.</p>
        <div className="vera-status"><span className="vera-dot" /> {sending ? "Estoy pensando tu respuesta" : "Lista para conversar"}</div>
      </section>

      <section className="vera-chat" aria-label="Conversación con VERA">
        <header className="vera-chat-head">
          <div><strong>Conversá con VERA</strong><small>Un espacio para entender mejor tus finanzas</small></div>
          <select className="vera-period" aria-label="Período de análisis" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </header>

        <div className="vera-messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="vera-empty">
              <div className="vera-empty-mark">✦</div>
              <strong>¿Qué te gustaría entender hoy?</strong>
              <p>Podés preguntarme por tus ingresos, gastos y categorías. Voy a usar los movimientos registrados del período que elijas.</p>
            </div>
          ) : messages.map((message, index) => (
            <div className={`vera-bubble ${message.role === "user" ? "user" : "model"}`} key={index}>{message.content}</div>
          ))}
          {sending && <div className="vera-thinking">VERA está pensando…</div>}
        </div>

        {messages.length === 0 && (
          <div className="vera-starters">
            {starters.map((starter) => <button className="vera-starter" key={starter} type="button" disabled={sending} onClick={() => void sendMessage(starter)}>{starter}</button>)}
          </div>
        )}

        {error && <div className="vera-error" role="alert">{error}</div>}

        <div className="vera-compose">
          <form onSubmit={handleSubmit}>
            <textarea className="vera-input" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribile a VERA…" aria-label="Mensaje para VERA" maxLength={3000} disabled={sending} />
            <button className="vera-send" type="submit" aria-label="Enviar mensaje" disabled={sending || !draft.trim()}>↑</button>
          </form>
          <p className="vera-privacy">VERA analiza los movimientos registrados en FINANCETRACK. No realiza operaciones ni modifica tus cuentas.</p>
        </div>
      </section>
    </div>
  );
}

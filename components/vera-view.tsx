"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ChatMessage = { role: "user" | "model"; content: string };
type Period = "daily" | "weekly" | "monthly" | "yearly";
type Conversation = { id: string; title: string; last_message_at: string; archived_at: string | null; created_at?: string };

const starters = ["¿Cómo vienen mis finanzas este mes?", "¿En qué estoy gastando más?", "Ayudame a entender mis gastos."];
const periodLabels: Record<Period, string> = { daily: "Hoy", weekly: "Últimos 7 días", monthly: "Este mes", yearly: "Este año" };

export default function VeraView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archived, setArchived] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const getToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (sessionError || !token) throw new Error("Tu sesión no está disponible. Volvé a iniciar sesión.");
    return token;
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = await getToken();
      const [activeResponse, archivedResponse] = await Promise.all([
        fetch("/api/vera/conversations", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/vera/conversations?archived=true", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);
      const activePayload = await activeResponse.json();
      const archivedPayload = await archivedResponse.json();
      if (!activeResponse.ok || !archivedResponse.ok) throw new Error(activePayload.error || archivedPayload.error || "No pude cargar el historial.");
      setConversations(activePayload.conversations ?? []);
      setArchived(archivedPayload.conversations ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude cargar el historial.");
    } finally {
      setHistoryLoading(false);
    }
  }, [getToken]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function saveConversation(nextMessages: ChatMessage[], id: string | null) {
    const token = await getToken();
    const response = await fetch("/api/vera/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, messages: nextMessages.slice(-100) }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.conversation?.id) throw new Error(payload.error || "No pude guardar esta conversación.");
    setConversationId(payload.conversation.id);
    await loadHistory();
  }

  async function openConversation(id: string) {
    if (sending) return;
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`/api/vera/conversations?id=${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.conversation) throw new Error(payload.error || "No pude abrir esa conversación.");
      setConversationId(payload.conversation.id);
      setMessages(payload.conversation.messages ?? []);
      setDraft("");
      setShowHistory(false);
      setShowArchived(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude abrir esa conversación.");
    }
  }

  function newConversation() {
    if (sending) return;
    setConversationId(null);
    setMessages([]);
    setDraft("");
    setError("");
    setShowHistory(false);
    setShowArchived(false);
  }

  async function changeArchive(id: string, action: "archive" | "restore") {
    try {
      const token = await getToken();
      const response = await fetch("/api/vera/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pude actualizar la conversación.");
      if (conversationId === id && action === "archive") newConversation();
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude actualizar la conversación.");
    }
  }

  async function deleteConversation(id: string) {
    if (!window.confirm("¿Eliminar definitivamente esta conversación?")) return;
    try {
      const token = await getToken();
      const response = await fetch("/api/vera/conversations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No pude eliminar la conversación.");
      if (conversationId === id) newConversation();
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pude eliminar la conversación.");
    }
  }

  async function sendMessage(value: string) {
    const text = value.trim();
    if (!text || sending) return;
    setError("");
    setDraft("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const accessToken = await getToken();
      const response = await fetch("/api/vera/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: nextMessages.slice(-11).filter((message, index) => index > 0 || message.role === "user"), period }),
      });
      const payload = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "No pude recibir una respuesta de VERA.");
      const completedMessages = [...nextMessages, { role: "model" as const, content: payload.reply }];
      setMessages(completedMessages);
      await saveConversation(completedMessages, conversationId);
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

  const visibleConversations = showArchived ? archived : conversations;

  return (
    <div className="vera-page">
      <style>{`
        .vera-page{--v:#a78bfa;--v2:#7c3aed;--ink:#09090d;--panel:#14121c;--line:rgba(196,181,253,.15);color:#f5f3fa;max-width:1000px;margin:0 auto;padding:12px 0 48px}
        .vera-shell{position:relative;overflow:hidden;border:1px solid rgba(167,139,250,.22);border-radius:26px;background:radial-gradient(ellipse at 50% -10%,rgba(124,58,237,.22),transparent 48%),linear-gradient(155deg,#171020,#0d0a14 58%,#09080e);box-shadow:0 22px 65px rgba(0,0,0,.22)}
        .vera-hero{position:relative;overflow:hidden;border:0;border-radius:0;background:transparent;padding:25px 24px 19px;text-align:center}
        .vera-orbit{width:76px;height:76px;margin:0 auto 15px;border-radius:50%;display:grid;place-items:center;position:relative;overflow:hidden;background:radial-gradient(circle at 30% 22%,#e1d5ff 0%,#b99aff 18%,#9561f5 43%,#672ac5 70%,#32105f 100%);border:1px solid rgba(235,225,255,.62);box-shadow:0 0 0 6px rgba(167,139,250,.08),0 0 35px rgba(139,92,246,.34),inset 0 2px 8px rgba(255,255,255,.35),inset 0 -7px 12px rgba(28,5,61,.35);animation:vera-breathe 3.8s ease-in-out infinite;transition:transform .35s,filter .35s}
        .vera-orbit:after{content:"";position:absolute;top:-45%;left:-65%;width:42%;height:190%;transform:rotate(28deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),rgba(255,255,255,.08),transparent);animation:vera-shine 5.8s ease-in-out infinite}
        .vera-orbit:before{content:"";position:absolute;inset:-8px;border:1px solid rgba(196,181,253,.22);border-radius:50%;animation:vera-pulse 4s ease-out infinite;pointer-events:none}
        .vera-orbit:active{transform:rotateY(12deg) rotateX(-6deg) scale(.97)}
        .vera-shell.is-thinking .vera-orbit{animation:vera-breathe 1.35s ease-in-out infinite}
        .vera-symbol{font:700 37px/1 Georgia,serif;color:white;text-shadow:0 2px 16px rgba(35,10,75,.5)}
        .vera-eyebrow{font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:#c4b5fd;font-weight:700}
        .vera-hero h1{font-size:clamp(28px,5vw,38px);letter-spacing:-1.4px;margin:9px 0 7px;font-weight:750}
        .vera-hero h1 span{color:#c4b5fd}
        .vera-sub{max-width:520px;margin:0 auto;color:#b8b2c5;font-size:13px;line-height:1.65}
        .vera-status{display:inline-flex;align-items:center;gap:8px;margin-top:15px;border:1px solid rgba(167,139,250,.23);background:rgba(139,92,246,.1);border-radius:30px;padding:7px 12px;color:#d8ccff;font-size:11px}
        .vera-dot{width:7px;height:7px;border-radius:50%;background:#a78bfa;box-shadow:0 0 12px #a78bfa}
        .vera-chat{margin-top:0;border:0;border-top:1px solid var(--line);border-radius:0;overflow:hidden;background:rgba(10,8,15,.22)}
        .vera-chat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line)}
        .vera-chat-head strong{font-size:13px}.vera-chat-head small{display:block;color:#9e96ad;font-size:11px;margin-top:3px}
        .vera-head-actions{display:flex;align-items:center;gap:8px}.vera-history-toggle,.vera-new-chat{border:1px solid rgba(196,181,253,.2);background:#1c1728;color:#e7dcff;border-radius:10px;padding:8px 10px;font-size:11px;cursor:pointer}.vera-history-toggle{display:flex;align-items:center;gap:6px}
        .vera-period{background:#1c1728;border:1px solid rgba(196,181,253,.2);border-radius:9px;padding:8px;color:#ddd3f2;font-size:11px;max-width:150px}
        .vera-messages{display:flex;flex-direction:column;gap:13px;min-height:245px;max-height:470px;overflow-y:auto;padding:20px 17px}
        .vera-empty{margin:auto;text-align:center;max-width:430px;padding:12px}
        .vera-empty-mark{font-size:25px;color:#c4b5fd;margin-bottom:9px}
        .vera-empty strong{display:block;font-size:14px;color:#eee8f8;margin-bottom:6px}
        .vera-empty p{font-size:12px;line-height:1.6;color:#a9a1b4}
        .vera-bubble{max-width:84%;padding:12px 14px;border-radius:16px;font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;animation:vera-message-in .34s cubic-bezier(.2,.8,.2,1) both}
        .vera-bubble.model{align-self:flex-start;background:#211a2d;border:1px solid rgba(196,181,253,.12);color:#eee9f6;border-top-left-radius:5px}
        .vera-bubble.user{align-self:flex-end;background:linear-gradient(135deg,#7040bd,#59319d);color:#fff;border-top-right-radius:5px}
        .vera-thinking{align-self:flex-start;display:flex;align-items:center;gap:8px;color:#c4b5fd;font-size:12px;padding:5px 10px;animation:vera-message-in .25s ease both}
        .vera-mini-coin{width:18px;height:18px;flex:0 0 18px;border-radius:50%;background:radial-gradient(circle at 30% 25%,#e1d5ff,#a879ff 42%,#5923a7 80%);box-shadow:0 0 12px rgba(167,139,250,.4);animation:vera-breathe 1.5s ease-in-out infinite}
        .vera-dots{display:inline-flex;gap:3px;align-items:center}.vera-dots i{width:4px;height:4px;border-radius:50%;background:#c8adff;animation:vera-dot-wave .9s ease-in-out infinite}.vera-dots i:nth-child(2){animation-delay:.14s}.vera-dots i:nth-child(3){animation-delay:.28s}
        .vera-starters{display:flex;flex-wrap:wrap;gap:7px;padding:0 17px 15px}
        .vera-starter{border:1px solid rgba(196,181,253,.2);background:#191522;color:#d8cafa;border-radius:20px;padding:8px 11px;font-size:11px;cursor:pointer}
        .vera-starter:disabled{opacity:.5;cursor:default}
        .vera-compose{padding:13px 15px 15px;border-top:1px solid var(--line);background:rgba(8,7,12,.45)}
        .vera-compose form{display:flex;align-items:flex-end;gap:9px}
        .vera-input{flex:1;min-width:0;resize:vertical;min-height:46px;max-height:120px;background:#171320;border:1px solid rgba(196,181,253,.2);border-radius:14px;padding:12px;color:#f5f3fa;font:inherit;font-size:13px;outline:none}
        .vera-input:focus{border-color:#a78bfa;box-shadow:0 0 0 3px rgba(167,139,250,.1)}
        .vera-send{width:46px;height:46px;flex-shrink:0;border:0;border-radius:14px;background:linear-gradient(145deg,#a78bfa,#7c3aed);color:white;font-size:20px;cursor:pointer}
        .vera-send:disabled{opacity:.38;cursor:default}.vera-send.ready{background:linear-gradient(145deg,#c3a7ff,#8648e8);box-shadow:0 0 17px rgba(139,92,246,.25)}.vera-send-arrow{display:block;transition:transform .2s}.vera-send:not(:disabled):hover .vera-send-arrow{transform:translate(2px,-2px)}
        .vera-error{padding:0 17px 13px;color:#f0b4c0;font-size:12px}
        .vera-privacy{margin:12px 3px 0;color:#898194;font-size:10px;line-height:1.6;text-align:center}
        .vera-drawer-backdrop{position:fixed;inset:0;z-index:80;background:rgba(4,3,8,.62);backdrop-filter:blur(5px);display:flex;justify-content:flex-start}
        .vera-drawer{width:min(340px,88vw);height:100%;overflow-y:auto;background:linear-gradient(165deg,#1a1425,#0d0b12 70%);border-right:1px solid rgba(196,181,253,.2);box-shadow:20px 0 60px rgba(0,0,0,.35);padding:20px 15px;animation:vera-drawer-in .22s ease both}
        .vera-drawer-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}.vera-drawer-top strong{font-size:16px}.vera-drawer-close{background:transparent;border:0;color:#cfc3e4;font-size:23px;cursor:pointer}
        .vera-drawer-new{width:100%;padding:11px;border:1px solid rgba(196,181,253,.25);border-radius:12px;background:linear-gradient(120deg,rgba(124,58,237,.28),rgba(76,29,149,.18));color:#f1eaff;font-size:12px;font-weight:650;cursor:pointer;margin-bottom:17px}
        .vera-drawer-tabs{display:flex;gap:6px;margin-bottom:13px}.vera-drawer-tab{flex:1;border:1px solid rgba(196,181,253,.15);border-radius:9px;padding:8px;background:#15111d;color:#a99dbb;font-size:11px;cursor:pointer}.vera-drawer-tab.active{background:rgba(124,58,237,.24);border-color:rgba(196,181,253,.35);color:#eee5ff}
        .vera-history-item{padding:10px;border:1px solid transparent;border-radius:11px;margin-bottom:6px;background:rgba(255,255,255,.025)}.vera-history-item.selected{border-color:rgba(167,139,250,.28);background:rgba(124,58,237,.12)}
        .vera-history-open{display:block;width:100%;text-align:left;background:transparent;border:0;color:#eee8f7;cursor:pointer;padding:0;font-size:12px;line-height:1.4}.vera-history-date{display:block;color:#8e849d;font-size:10px;margin-top:4px}
        .vera-history-actions{display:flex;gap:12px;margin-top:8px}.vera-history-action{border:0;background:transparent;color:#bba5e9;font-size:10px;padding:0;cursor:pointer}.vera-history-action.delete{color:#d99ba9}
        .vera-history-empty{padding:24px 10px;text-align:center;color:#968ba5;font-size:12px;line-height:1.6}
        @keyframes vera-breathe{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.04);filter:brightness(1.1)}}
        @keyframes vera-shine{0%,62%{left:-65%;opacity:0}70%{opacity:.9}88%,100%{left:130%;opacity:0}}
        @keyframes vera-dot-wave{0%,60%,100%{transform:translateY(0);opacity:.55}30%{transform:translateY(-4px);opacity:1}}
        @keyframes vera-message-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes vera-pulse{0%{transform:scale(.92);opacity:.7}100%{transform:scale(1.2);opacity:0}}
        @keyframes vera-drawer-in{from{transform:translateX(-18px);opacity:.6}to{transform:translateX(0);opacity:1}}
        @media(max-width:650px){.vera-page{padding-top:2px}.vera-hero{padding:23px 17px 17px;border-radius:0}.vera-chat{border-radius:0}.vera-messages{min-height:220px;padding:16px 12px}.vera-bubble{max-width:92%}.vera-chat-head{padding:11px;align-items:flex-start}.vera-chat-head small{max-width:145px}.vera-head-actions{gap:5px;flex-wrap:wrap;justify-content:flex-end}.vera-history-toggle,.vera-new-chat{padding:8px}.vera-starters{padding:0 12px 13px}.vera-compose{padding:11px}.vera-period{max-width:112px}}
        @media(prefers-reduced-motion:reduce){.vera-orbit,.vera-orbit:before,.vera-orbit:after,.vera-mini-coin,.vera-dots i,.vera-bubble,.vera-thinking,.vera-drawer{animation:none!important}}
      `}</style>

      {showHistory && <div className="vera-drawer-backdrop" onClick={() => setShowHistory(false)}>
        <aside className="vera-drawer" aria-label="Historial de conversaciones" onClick={(event) => event.stopPropagation()}>
          <div className="vera-drawer-top"><strong>Tu historial</strong><button className="vera-drawer-close" type="button" onClick={() => setShowHistory(false)} aria-label="Cerrar historial">×</button></div>
          <button className="vera-drawer-new" type="button" onClick={newConversation}>＋ Nueva conversación</button>
          <div className="vera-drawer-tabs">
            <button type="button" className={showArchived ? "vera-drawer-tab" : "vera-drawer-tab active"} onClick={() => setShowArchived(false)}>Recientes</button>
            <button type="button" className={showArchived ? "vera-drawer-tab active" : "vera-drawer-tab"} onClick={() => setShowArchived(true)}>Archivadas</button>
          </div>
          {historyLoading ? <div className="vera-history-empty">Cargando conversaciones…</div> : visibleConversations.length === 0 ? <div className="vera-history-empty">{showArchived ? "Todavía no hay conversaciones archivadas." : "Tus conversaciones aparecerán acá cuando charles con VERA."}</div> : visibleConversations.map((conversation) => (
            <div className={`vera-history-item${conversationId === conversation.id ? " selected" : ""}`} key={conversation.id}>
              <button className="vera-history-open" type="button" onClick={() => void openConversation(conversation.id)}>
                {conversation.title}<span className="vera-history-date">{new Date(conversation.last_message_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</span>
              </button>
              <div className="vera-history-actions">
                <button className="vera-history-action" type="button" onClick={() => void changeArchive(conversation.id, showArchived ? "restore" : "archive")}>{showArchived ? "Restaurar" : "Archivar"}</button>
                <button className="vera-history-action delete" type="button" onClick={() => void deleteConversation(conversation.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </aside>
      </div>}

      <section className={`vera-shell${sending ? " is-thinking" : ""}`} aria-label="Asistente financiera VERA">
        <header className="vera-hero" aria-labelledby="vera-title">
          <button className="vera-orbit" type="button" aria-label="Moneda de VERA"><span className="vera-symbol">V</span></button>
          <div className="vera-eyebrow">Tu compañera financiera</div>
          <h1 id="vera-title">Hola, soy <span>VERA.</span></h1>
          <p className="vera-sub">Estoy acá para ayudarte a entender tu dinero, descubrir oportunidades y tomar decisiones con más claridad.</p>
          <div className="vera-status"><span className="vera-dot" /> {sending ? "Estoy analizando tus datos" : "Acá estoy, lista para conversar"}</div>
        </header>
        <section className="vera-chat" aria-label="Conversación con VERA">
          <header className="vera-chat-head">
            <div><strong>{conversationId ? "Tu conversación" : "Conversá con VERA"}</strong><small>{conversationId ? "Podés retomarla cuando quieras" : "Un espacio para entender mejor tus finanzas"}</small></div>
            <div className="vera-head-actions">
              <button className="vera-history-toggle" type="button" onClick={() => { setShowHistory(true); void loadHistory(); }}>☰ Historial</button>
              <button className="vera-new-chat" type="button" onClick={newConversation}>＋</button>
              <select className="vera-period" aria-label="Período de análisis" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
                {Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </header>
          <div className="vera-messages" aria-live="polite">
            {messages.length === 0 ? <div className="vera-empty"><div className="vera-empty-mark">✦</div><strong>¿Qué te gustaría entender hoy?</strong><p>Podés preguntarme por tus ingresos, gastos y categorías. Voy a usar los movimientos registrados del período que elijas.</p></div> : messages.map((message, index) => <div className={`vera-bubble ${message.role === "user" ? "user" : "model"}`} key={index}>{message.content}</div>)}
            {sending && <div className="vera-thinking" role="status"><span className="vera-mini-coin" aria-hidden="true" /><span>VERA está pensando</span><span className="vera-dots" aria-hidden="true"><i /><i /><i /></span></div>}
          </div>
          {messages.length === 0 && <div className="vera-starters">{starters.map((starter) => <button className="vera-starter" key={starter} type="button" disabled={sending} onClick={() => void sendMessage(starter)}>{starter}</button>)}</div>}
          {error && <div className="vera-error" role="alert">{error}</div>}
          <div className="vera-compose"><form onSubmit={handleSubmit}><textarea className="vera-input" rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribile a VERA…" aria-label="Mensaje para VERA" maxLength={3000} disabled={sending} /><button className={`vera-send${draft.trim() ? " ready" : ""}`} type="submit" aria-label="Enviar mensaje" disabled={sending || !draft.trim()}><span className="vera-send-arrow">↑</span></button></form><p className="vera-privacy">VERA analiza los movimientos registrados en FINANCETRACK. No realiza operaciones ni modifica tus cuentas.</p></div>
        </section>
      </section>
    </div>
  );
}

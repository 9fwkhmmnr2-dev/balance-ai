"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mode = "purchase" | "decision" | "planning";
type Snapshot = { currency: string; movementsCount: number; monthlyIncome: number; monthlyExpenses: number; monthlyNet: number; topExpenses: Array<{category:string;monthlyAmount:number}> };

const field: React.CSSProperties = { width:"100%", padding:"12px", borderRadius:10, border:"1px solid rgba(200,169,107,.24)", background:"#111018", color:"#f5f0e5", fontSize:14, outline:"none" };
const labelStyle: React.CSSProperties = { display:"grid", gap:7, color:"#c8c0b1", fontSize:12, marginBottom:14 };
const button: React.CSSProperties = { border:0, borderRadius:11, padding:"12px 16px", background:"linear-gradient(135deg,#e0c58e,#b28b4e)", color:"#17130d", fontWeight:750, cursor:"pointer" };

export default function VeraGoldWorkspace({ mode, onClose, onSend }: { mode: Mode; onClose:()=>void; onSend:(text:string)=>void }) {
  const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [name,setName] = useState("");
  const [price,setPrice] = useState("");
  const [payment,setPayment] = useState("contado");
  const [months,setMonths] = useState("3");
  const [current,setCurrent] = useState("");
  const [proposed,setProposed] = useState("");
  const [monthlyImpact,setMonthlyImpact] = useState("");
  const [goal,setGoal] = useState("");
  const [goalAmount,setGoalAmount] = useState("");
  const [contribution,setContribution] = useState("");
  const [deadline,setDeadline] = useState("12");

  useEffect(()=>{ let active=true; (async()=>{try{const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Tu sesión venció. Volvé a iniciar sesión.");const response=await fetch("/api/vera/simulator",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"No pudimos cargar tus datos.");if(active)setSnapshot(payload);}catch(e){if(active)setError(e instanceof Error?e.message:"No pudimos cargar tus datos.");}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[]);

  const money=(v:number)=>{try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:snapshot?.currency||"ARS",maximumFractionDigits:0}).format(v);}catch{return `${snapshot?.currency||"ARS"} ${Math.round(v).toLocaleString("es-AR")}`;}};
  const numeric=(v:string)=>Number(v.replace(/\./g,"").replace(",","."));
  const parsedPrice=numeric(price);
  const parsedContribution=numeric(contribution);
  const preview=useMemo(()=>{if(!snapshot)return null;return {surplus:snapshot.monthlyNet,after: snapshot.monthlyNet-(Number.isFinite(parsedContribution)?parsedContribution:0)}},[snapshot,parsedContribution]);

  const title = mode==="purchase"?"Simular una compra":mode==="decision"?"Simular otra decisión":"Planificación personalizada";
  const description = mode==="purchase"?"Compará comprar ahora con esperar y ahorrar. No se asumen tasas, cuotas ni costos que no hayas informado.":mode==="decision"?"Describí la situación actual y el cambio que querés evaluar. VERA comparará ambos escenarios.":"Definí un objetivo y un aporte posible. VERA evaluará un camino realista según tus movimientos.";
  function submit(){
    if(!snapshot)return;
    let payload="";
    if(mode==="purchase"){
      if(!name.trim()||!Number.isFinite(parsedPrice)||parsedPrice<=0){setError("Completá el producto y un precio válido.");return;}
      payload=`ANÁLISIS GOLD — SIMULACIÓN DE COMPRA\nProducto: ${name.trim()}\nPrecio informado: ${money(parsedPrice)}\nModalidad elegida: ${payment==="contado"?"Contado":`Cuotas, ${months} meses (sin tasa ni importe de cuota informado)`}\nDatos registrados de referencia: ingreso mensual promedio ${money(snapshot.monthlyIncome)}, gastos mensuales promedio ${money(snapshot.monthlyExpenses)}, balance mensual promedio ${money(snapshot.monthlyNet)}; ${snapshot.movementsCount} movimientos analizados.\nCompará comprar ahora contra esperar y ahorrar. Calculá solo lo que permitan los datos; si faltan saldo líquido, ahorro disponible, importe de cuotas o tasa, indicá qué falta. Mostrá cambios en dinero y porcentaje y proyecciones 3, 6 y 12 meses. No inventes datos ni modifiques cuentas.`;
    } else if(mode==="decision"){
      if(!current.trim()||!proposed.trim()){setError("Describí la situación actual y la alternativa.");return;}
      payload=`ANÁLISIS GOLD — SIMULACIÓN DE DECISIÓN\nSituación actual: ${current.trim()}\nAlternativa propuesta: ${proposed.trim()}\nImpacto mensual estimado informado: ${monthlyImpact.trim()||"No informado"}\nReferencia de movimientos: ingreso mensual promedio ${money(snapshot.monthlyIncome)}, gastos mensuales promedio ${money(snapshot.monthlyExpenses)}, balance mensual promedio ${money(snapshot.monthlyNet)}; ${snapshot.movementsCount} movimientos.\nCompará escenario base y propuesto, cuantificá variaciones cuando sea posible y proyectá 3, 6 y 12 meses. Pedí aclaraciones si son necesarias; separá datos reales y supuestos. No registres cambios.`;
    } else {
      if(!goal.trim()||!Number.isFinite(numeric(goalAmount))||numeric(goalAmount)<=0||!Number.isFinite(parsedContribution)||parsedContribution<=0){setError("Completá el objetivo, el monto y un aporte mensual válido.");return;}
      payload=`ANÁLISIS GOLD — PLANIFICACIÓN PERSONALIZADA\nObjetivo: ${goal.trim()}\nMonto objetivo: ${money(numeric(goalAmount))}\nAporte mensual que considero posible: ${money(parsedContribution)}\nPlazo deseado: ${deadline} meses\nReferencia de movimientos: ingreso mensual promedio ${money(snapshot.monthlyIncome)}, gastos mensuales promedio ${money(snapshot.monthlyExpenses)}, balance mensual promedio ${money(snapshot.monthlyNet)}; ${snapshot.movementsCount} movimientos.\nEvaluá si el aporte parece sostenible, cuánto tiempo llevaría, qué margen quedaría y proponé hitos. No asumas que el balance promedio es ahorro disponible ni modifiques objetivos o cuentas.`;
    }
    onSend(payload);
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="vera-gold-workspace-title" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(5,4,9,.82)",backdropFilter:"blur(10px)",display:"grid",placeItems:"center",padding:14}} onClick={onClose}>
    <section onClick={e=>e.stopPropagation()} style={{width:"min(680px,100%)",maxHeight:"92dvh",overflowY:"auto",border:"1px solid rgba(200,169,107,.3)",borderRadius:20,background:"linear-gradient(150deg,#211b20,#100e14 65%)",padding:20,color:"#f4efe5",boxShadow:"0 24px 80px rgba(0,0,0,.55)"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><span style={{fontSize:10,letterSpacing:2,color:"#d9bd85",fontWeight:800}}>VERA GOLD · HERRAMIENTA INTERACTIVA</span><button onClick={onClose} aria-label="Cerrar" style={{background:"transparent",border:0,color:"#c9c0b3",fontSize:25,cursor:"pointer"}}>×</button></header>
      <h2 id="vera-gold-workspace-title" style={{fontSize:26,margin:"14px 0 7px"}}>{title}</h2><p style={{color:"#aaa19a",fontSize:13,lineHeight:1.6,margin:"0 0 18px"}}>{description}</p>
      {loading?<p style={{color:"#c9bdab"}}>Cargando tus datos financieros…</p>:error&& !snapshot?<p role="alert" style={{color:"#f2a7a7"}}>{error}</p>:snapshot&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:18}}>
          {[["Ingresos/mes",snapshot.monthlyIncome],["Gastos/mes",snapshot.monthlyExpenses],["Balance/mes",snapshot.monthlyNet]].map(([k,v])=><div key={String(k)} style={{padding:11,borderRadius:11,background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.07)"}}><span style={{display:"block",fontSize:10,color:"#a9a19a"}}>{k}</span><strong style={{display:"block",fontSize:13,marginTop:6}}>{money(Number(v))}</strong></div>)}
        </div>
        {mode==="purchase"?<>
          <label style={labelStyle}>¿Qué querés comprar?<input style={field} value={name} onChange={e=>setName(e.target.value)} placeholder="Ej.: heladera" maxLength={100}/></label>
          <label style={labelStyle}>Precio total<input style={field} value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal" placeholder="Ej.: 2000000"/></label>
          <label style={labelStyle}>Modalidad de pago<select style={field} value={payment} onChange={e=>setPayment(e.target.value)}><option value="contado">Al contado</option><option value="cuotas">En cuotas (sin calcular financiación desconocida)</option></select></label>
          {payment==="cuotas"&&<label style={labelStyle}>Cantidad de cuotas<input style={field} type="number" min="1" max="60" value={months} onChange={e=>setMonths(e.target.value)}/></label>}
        </>:mode==="decision"?<>
          <label style={labelStyle}>Situación actual<textarea style={{...field,minHeight:80,resize:"vertical"}} value={current} onChange={e=>setCurrent(e.target.value)} placeholder="¿Cómo estás hoy?"/></label>
          <label style={labelStyle}>Alternativa que querés evaluar<textarea style={{...field,minHeight:80,resize:"vertical"}} value={proposed} onChange={e=>setProposed(e.target.value)} placeholder="¿Qué cambiaría?"/></label>
          <label style={labelStyle}>Impacto mensual estimado (opcional)<input style={field} value={monthlyImpact} onChange={e=>setMonthlyImpact(e.target.value)} placeholder="Ej.: gastaría $50.000 menos"/></label>
        </>:<>
          <label style={labelStyle}>¿Qué objetivo querés alcanzar?<input style={field} value={goal} onChange={e=>setGoal(e.target.value)} placeholder="Ej.: fondo para estudiar" maxLength={100}/></label>
          <label style={labelStyle}>Monto objetivo<input style={field} value={goalAmount} onChange={e=>setGoalAmount(e.target.value)} inputMode="decimal" placeholder="Ej.: 500000"/></label>
          <label style={labelStyle}>Aporte mensual posible<input style={field} value={contribution} onChange={e=>setContribution(e.target.value)} inputMode="decimal" placeholder="Ej.: 30000"/></label>
          <label style={labelStyle}>Plazo deseado<select style={field} value={deadline} onChange={e=>setDeadline(e.target.value)}>{[3,6,9,12,18,24,36].map(n=><option key={n} value={n}>{n} meses</option>)}</select></label>
          {preview&&<p style={{fontSize:12,color:"#cbbd9f"}}>Tu balance mensual promedio registrado es {money(preview.surplus)}. Es una referencia, no equivale necesariamente a ahorro disponible.</p>}
        </>}
        {error&&<p role="alert" style={{color:"#f2a7a7",fontSize:12}}>{error}</p>}
        <p style={{fontSize:10,color:"#8f8982",lineHeight:1.6}}>Los datos se consultan en modo lectura. La simulación no crea movimientos, no cambia tus cuentas y no garantiza resultados futuros.</p>
        <button onClick={submit} style={{...button,width:"100%",marginTop:8}}>Enviar a VERA <span aria-hidden="true">→</span></button>
      </>}
    </section>
  </div>;
}

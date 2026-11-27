"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import CurrencyPicker from "./currency-picker";

type Mode = "actions" | "planning";
type Snapshot = { currency: string; movementsCount: number; monthlyIncome: number; monthlyExpenses: number; monthlyNet: number; topExpenses: Array<{category:string;monthlyAmount:number}> };

const field: CSSProperties = { width:"100%", padding:"12px", borderRadius:10, border:"1px solid rgba(200,169,107,.24)", background:"#111018", color:"#f5f0e5", fontSize:14, outline:"none" };
const labelStyle: React.CSSProperties = { display:"grid", gap:7, color:"#c8c0b1", fontSize:12, marginBottom:14 };
const button: React.CSSProperties = { border:0, borderRadius:11, padding:"12px 16px", background:"linear-gradient(135deg,#e0c58e,#b28b4e)", color:"#17130d", fontWeight:750, cursor:"pointer" };

export default function VeraGoldWorkspace({ mode, onClose, onSend }: { mode: Mode; onClose:()=>void; onSend:(text:string)=>void }) {
  const [actionType,setActionType] = useState<"purchase"|"decision">("purchase");
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
  const [amountCurrency,setAmountCurrency] = useState("ARS");
  const [quoteSource,setQuoteSource] = useState<"oficial"|"mep"|"blue">("mep");
  const [conversionRate,setConversionRate] = useState<number|null>(null);
  const [conversionInfo,setConversionInfo] = useState("");
  const [conversionError,setConversionError] = useState("");
  const [conversionLoading,setConversionLoading] = useState(false);

  useEffect(()=>{ let active=true; (async()=>{try{const {data}=await supabase.auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Tu sesión venció. Volvé a iniciar sesión.");const response=await fetch("/api/vera/simulator",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"No pudimos cargar tus datos.");if(active)setSnapshot(payload);}catch(e){if(active)setError(e instanceof Error?e.message:"No pudimos cargar tus datos.");}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[]);

  const money=(v:number,currency=snapshot?.currency||"ARS")=>{try{return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:2}).format(v);}catch{return `${currency} ${v.toLocaleString("es-AR",{maximumFractionDigits:2})}`;}};
  const numeric=(v:string)=>Number(v.replace(/\./g,"").replace(",","."));
  const parsedPrice=numeric(price);
  useEffect(()=>{if(snapshot)setAmountCurrency(snapshot.currency||"ARS");},[snapshot]);

  useEffect(()=>{
    if(!snapshot)return;
    const base=snapshot.currency||"ARS";let active=true;
    setConversionError("");setConversionInfo("");
    if(amountCurrency===base){setConversionRate(1);setConversionInfo("Misma moneda · sin conversión");setConversionLoading(false);return;}
    async function loadRate(){
      setConversionLoading(true);setConversionRate(null);
      try{
        let rate:number;let info:string;
        const localPair=(amountCurrency==="ARS"&&["USD","EUR"].includes(base))||(base==="ARS"&&["USD","EUR"].includes(amountCurrency));
        if(localPair){
          const response=await fetch("/api/currency-quotes",{cache:"no-store"});const data=await response.json();
          if(!response.ok)throw new Error(data.error||"No se pudo consultar la cotización local.");
          const id=amountCurrency==="EUR"||base==="EUR"?"euro":quoteSource;
          const quote=data.quotes?.find((item:{id:string})=>item.id===id);
          if(!quote||quote.stale)throw new Error("La cotización seleccionada no está actualizada; no se usará para comparar.");
          rate=amountCurrency==="ARS"?1/Number(quote.sell):Number(quote.sell);
          info="MonedAPI · "+quote.name+" · confirmado "+new Date(quote.lastScrapedAt).toLocaleString("es-AR");
          if(quote.marketClosed)info+=" · mercado cerrado, último valor confirmado";
        }else{
          const params=new URLSearchParams({base:amountCurrency,symbols:base});
          const response=await fetch("/api/global-currency-rates?"+params.toString(),{cache:"no-store"});const data=await response.json();
          if(!response.ok)throw new Error(data.error||"No se pudo consultar el tipo de cambio.");
          rate=Number(data.rates?.[base]);
          if(!Number.isFinite(rate)||rate<=0||data.stale?.[base]===true)throw new Error("No hay una cotización vigente para este par de monedas.");
          info="ExchangeRate.dev · "+(data.effective_at?.[base]||data.data_updated_at||data.timestamp||"fecha no informada")+" · referencia internacional";
        }
        if(active){setConversionRate(rate);setConversionInfo(info);}
      }catch(error){if(active){setConversionRate(null);setConversionError(error instanceof Error?error.message:"No se pudo obtener la cotización.");}}
      finally{if(active)setConversionLoading(false);}
    }
    void loadRate();return()=>{active=false;};
  },[snapshot,amountCurrency,quoteSource]);
  const parsedContribution=numeric(contribution);
  const preview=useMemo(()=>{if(!snapshot)return null;return {surplus:snapshot.monthlyNet,after: snapshot.monthlyNet-(Number.isFinite(parsedContribution)?parsedContribution:0)}},[snapshot,parsedContribution]);

  const title = mode==="actions"?"Simulador de acciones":"Planificación personalizada";
  const description = mode==="actions"?(actionType==="purchase"?"Evaluá una compra y compará contado, cuotas o esperar. No se inventan tasas ni costos no informados.":"Evaluá un pago, una cuota o un compromiso y compará cómo cambia tu situación financiera."):"Definí un objetivo y un aporte posible. VERA evaluará un camino realista según tus movimientos.";
  function submit(){
    if(!snapshot)return;
    let payload="";
    if(mode==="actions" && actionType==="purchase"){
      if(!name.trim()||!Number.isFinite(parsedPrice)||parsedPrice<=0){setError("Completá el producto y un precio válido.");return;}
      const convertedPrice=conversionRate===null?null:parsedPrice*conversionRate;
      payload=`ANÁLISIS GOLD — SIMULACIÓN DE COMPRA\nProducto: ${name.trim()}\nPrecio informado: ${money(parsedPrice,amountCurrency)}\nMoneda del precio: ${amountCurrency}\nEquivalencia estimada en moneda de referencia (${snapshot.currency}): ${convertedPrice===null?"No disponible":money(convertedPrice)}\nTipo de cambio aplicado: ${conversionRate===null?"No disponible":`1 ${amountCurrency} = ${conversionRate} ${snapshot.currency}`}\nFuente de conversión: ${conversionInfo||conversionError||"No disponible"}\nSi no hay equivalencia disponible, no compares importes nominales de monedas distintas; explicá qué cotización falta.\nModalidad elegida: ${payment==="contado"?"Contado":`Cuotas, ${months} meses (sin tasa ni importe de cuota informado)`}\nDatos registrados de referencia: ingreso mensual promedio ${money(snapshot.monthlyIncome)}, gastos mensuales promedio ${money(snapshot.monthlyExpenses)}, balance mensual promedio ${money(snapshot.monthlyNet)}; ${snapshot.movementsCount} movimientos analizados.\nCompará comprar ahora contra esperar y ahorrar. Calculá solo lo que permitan los datos; si faltan saldo líquido, ahorro disponible, importe de cuotas o tasa, indicá qué falta. Mostrá cambios en dinero y porcentaje y proyecciones 3, 6 y 12 meses. No inventes datos ni modifiques cuentas.`;
    } else if(mode==="actions" && actionType==="decision"){
      if(!current.trim()||!proposed.trim()){setError("Describí la situación actual y la alternativa.");return;}
      payload=`ANÁLISIS GOLD — SIMULACIÓN DE DECISIÓN\nSituación actual: ${current.trim()}\nAlternativa propuesta: ${proposed.trim()}\nMoneda de cualquier importe informado en los textos: ${amountCurrency}\nImpacto mensual estimado informado: ${monthlyImpact.trim()||"No informado"}\nReferencia de movimientos: ingreso mensual promedio ${money(snapshot.monthlyIncome)}, gastos mensuales promedio ${money(snapshot.monthlyExpenses)}, balance mensual promedio ${money(snapshot.monthlyNet)}; ${snapshot.movementsCount} movimientos.\nCompará escenario base y propuesto, cuantificá variaciones cuando sea posible y proyectá 3, 6 y 12 meses. Pedí aclaraciones si son necesarias; separá datos reales y supuestos. No registres cambios.`;
    } else {
      if(!goal.trim()||!Number.isFinite(numeric(goalAmount))||numeric(goalAmount)<=0||!Number.isFinite(parsedContribution)||parsedContribution<=0){setError("Completá el objetivo, el monto y un aporte mensual válido.");return;}
      const convertedGoal=conversionRate===null?null:numeric(goalAmount)*conversionRate;
      const convertedMonthly=conversionRate===null?null:parsedContribution*conversionRate;
      payload=`ANÁLISIS GOLD — PLANIFICACIÓN PERSONALIZADA\nObjetivo: ${goal.trim()}\nMonto objetivo: ${money(numeric(goalAmount),amountCurrency)}\nAporte mensual que considero posible: ${money(parsedContribution,amountCurrency)}\nMoneda de objetivo y aporte: ${amountCurrency}\nEquivalencia estimada del objetivo en moneda de referencia (${snapshot.currency}): ${convertedGoal===null?"No disponible":money(convertedGoal)}\nEquivalencia estimada del aporte mensual en moneda de referencia: ${convertedMonthly===null?"No disponible":money(convertedMonthly)}\nTipo de cambio aplicado: ${conversionRate===null?"No disponible":`1 ${amountCurrency} = ${conversionRate} ${snapshot.currency}`}\nFuente de conversión: ${conversionInfo||conversionError||"No disponible"}\nSi no hay equivalencia disponible, no compares importes nominales de monedas distintas; explicá qué cotización falta.\nPlazo deseado: ${deadline} meses\nReferencia de movimientos: ingreso mensual promedio ${money(snapshot.monthlyIncome)}, gastos mensuales promedio ${money(snapshot.monthlyExpenses)}, balance mensual promedio ${money(snapshot.monthlyNet)}; ${snapshot.movementsCount} movimientos.\nEvaluá si el aporte parece sostenible, cuánto tiempo llevaría, qué margen quedaría y proponé hitos. No asumas que el balance promedio es ahorro disponible ni modifiques objetivos o cuentas.`;
    }
    onSend(payload);
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="vera-gold-workspace-title" style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(5,4,9,.82)",backdropFilter:"blur(10px)",display:"grid",placeItems:"center",padding:14}} onClick={onClose}>
    <section onClick={e=>e.stopPropagation()} style={{width:"min(680px,100%)",maxHeight:"92dvh",overflowY:"auto",border:"1px solid rgba(200,169,107,.3)",borderRadius:20,background:"linear-gradient(150deg,#211b20,#100e14 65%)",padding:20,color:"#f4efe5",boxShadow:"0 24px 80px rgba(0,0,0,.55)"}}>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}><span style={{fontSize:10,letterSpacing:2,color:"#d9bd85",fontWeight:800}}>VERA GOLD · HERRAMIENTA INTERACTIVA</span><button onClick={onClose} aria-label="Cerrar" style={{background:"transparent",border:0,color:"#c9c0b3",fontSize:25,cursor:"pointer"}}>×</button></header>
      <h2 id="vera-gold-workspace-title" style={{fontSize:26,margin:"14px 0 7px"}}>{title}</h2><p style={{color:"#aaa19a",fontSize:13,lineHeight:1.6,margin:"0 0 18px"}}>{description}</p>
      {mode==="actions" && <div role="tablist" aria-label="Tipo de acción" style={{display:"flex",gap:8,margin:"16px 0",flexWrap:"wrap"}}>
        <button type="button" role="tab" aria-selected={actionType==="purchase"} onClick={()=>{setActionType("purchase");setError("");}} style={{...button,background:actionType==="purchase"?"linear-gradient(135deg,#e0c58e,#b28b4e)":"rgba(255,255,255,.08)",color:actionType==="purchase"?"#17130d":"#eee"}}>Simular compra</button>
        <button type="button" role="tab" aria-selected={actionType==="decision"} onClick={()=>{setActionType("decision");setError("");}} style={{...button,background:actionType==="decision"?"linear-gradient(135deg,#e0c58e,#b28b4e)":"rgba(255,255,255,.08)",color:actionType==="decision"?"#17130d":"#eee"}}>Simular pago / decisión</button>
      </div>}
      {loading?<p style={{color:"#c9bdab"}}>Cargando tus datos financieros…</p>:error&& !snapshot?<p role="alert" style={{color:"#f2a7a7"}}>{error}</p>:snapshot&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:18}}>
          {[["Ingresos/mes",snapshot.monthlyIncome],["Gastos/mes",snapshot.monthlyExpenses],["Balance/mes",snapshot.monthlyNet]].map(([k,v])=><div key={String(k)} style={{padding:11,borderRadius:11,background:"rgba(255,255,255,.045)",border:"1px solid rgba(255,255,255,.07)"}}><span style={{display:"block",fontSize:10,color:"#a9a19a"}}>{k}</span><strong style={{display:"block",fontSize:13,marginTop:6}}>{money(Number(v))}</strong></div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:10,alignItems:"end",marginBottom:14}}><label style={labelStyle}>Moneda de los importes<CurrencyPicker value={amountCurrency} onChange={setAmountCurrency} label="Elegir moneda para la simulación" allowFavorites={false}/></label>{((amountCurrency==="USD"&&snapshot.currency==="ARS")||(amountCurrency==="ARS"&&snapshot.currency==="USD"))&&<label style={labelStyle}>Referencia del dólar<select style={field} value={quoteSource} onChange={e=>setQuoteSource(e.target.value as typeof quoteSource)}><option value="mep">Dólar MEP</option><option value="oficial">Dólar oficial</option><option value="blue">Dólar blue</option></select></label>}</div>{amountCurrency!==snapshot.currency&&<p style={{fontSize:11,color:"#cbbd9f",margin:"-4px 0 14px"}}>{conversionLoading?"Consultando cotización…":conversionRate!==null?("1 "+amountCurrency+" = "+conversionRate.toLocaleString("es-AR",{maximumFractionDigits:6})+" "+snapshot.currency+" · "+conversionInfo):conversionError||"La equivalencia todavía no está disponible. VERA no comparará importes de monedas distintas como si fueran iguales."}</p>}
        {mode==="actions" && actionType==="purchase"?<>
          <label style={labelStyle}>¿Qué querés comprar?<input style={field} value={name} onChange={e=>setName(e.target.value)} placeholder="Ej.: heladera" maxLength={100}/></label>
          <label style={labelStyle}>Precio total<input style={field} value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal" placeholder="Ej.: 2000000"/></label>
          <label style={labelStyle}>Modalidad de pago<select style={field} value={payment} onChange={e=>setPayment(e.target.value)}><option value="contado">Al contado</option><option value="cuotas">En cuotas (sin calcular financiación desconocida)</option></select></label>
          {payment==="cuotas"&&<label style={labelStyle}>Cantidad de cuotas<input style={field} type="number" min="1" max="60" value={months} onChange={e=>setMonths(e.target.value)}/></label>}
        </>:mode==="actions" && actionType==="decision"?<>
          <label style={labelStyle}>Situación actual<textarea style={{...field,minHeight:80,resize:"vertical"}} value={current} onChange={e=>setCurrent(e.target.value)} placeholder="¿Cómo estás hoy?"/></label>
          <label style={labelStyle}>Alternativa que querés evaluar<textarea style={{...field,minHeight:80,resize:"vertical"}} value={proposed} onChange={e=>setProposed(e.target.value)} placeholder="¿Qué cambiaría?"/></label>
          <label style={labelStyle}>Impacto mensual estimado (opcional)<input style={field} value={monthlyImpact} onChange={e=>setMonthlyImpact(e.target.value)} placeholder={"Ej.: "+amountCurrency+" 50.000 menos"}/></label>
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

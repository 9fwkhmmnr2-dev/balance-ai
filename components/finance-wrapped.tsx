"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import FinanceTrackLoader from "./finance-track-loader";
import VeraIsotype from "./vera-isotype";
import "./finance-wrapped.css";

type Movement = { id:string; type:"income"|"expense"; amount:number; currency:string; movement_date:string; description:string; category:string|null };
type Period = "month"|"quarter"|"year";
type GoalSummary = { id:string; title:string; target_amount:number; currency:string; saved_amount:number; progress_percent:number; status:"active"|"paused"|"completed"; target_date:string|null };
const money=(n:number,c:string)=>{try{return new Intl.NumberFormat("es-AR",{style:"currency",currency:c,maximumFractionDigits:0}).format(n)}catch{return c+" "+Math.round(n).toLocaleString("es-AR")}};
const key=(d:Date)=>d.toLocaleDateString("en-CA",{timeZone:"America/Argentina/Buenos_Aires"});
function range(p:Period,offset:number){const n=new Date();const s=p==="month"?new Date(n.getFullYear(),n.getMonth()+offset,1):p==="quarter"?new Date(n.getFullYear(),Math.floor(n.getMonth()/3)*3+offset*3,1):new Date(n.getFullYear()+offset,0,1);const e=p==="month"?new Date(s.getFullYear(),s.getMonth()+1,0):p==="quarter"?new Date(s.getFullYear(),s.getMonth()+3,0):new Date(s.getFullYear(),11,31);return {s,e}}
function periodLabel(p:Period,s:Date){return p==="month"?s.toLocaleDateString("es-AR",{month:"long",year:"numeric"}):p==="quarter"?"T"+(Math.floor(s.getMonth()/3)+1)+" · "+s.getFullYear():String(s.getFullYear())}
const clean=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();

export default function FinanceWrapped(){
 const [rows, setRows] = useState<Movement[]>([]);
 const [goals, setGoals] = useState<GoalSummary[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [period, setPeriod] = useState<Period>("month");
 const [offset, setOffset] = useState(0);
 const [currency, setCurrency] = useState("ARS");
 const [slide, setSlide] = useState(0);
 const [vera, setVera] = useState(true);
 const [gold, setGold] = useState(false);
 const [arsRates, setArsRates] = useState<Record<string,number>>({ARS:1});
 useEffect(()=>{let active=true;(async()=>{try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Iniciá sesión para ver tu Wrapped.");const {data,error}=await supabase.from("movements").select("id,type,amount,currency,movement_date,description,category").eq("user_id",user.id).order("movement_date",{ascending:true});if(error)throw error;if(active)setRows((data??[]) as Movement[]);const {data:session}=await supabase.auth.getSession();const token=session.session?.access_token;if(token){const goalsResponse=await fetch("/api/financial-goals",{headers:{Authorization:"Bearer "+token},cache:"no-store"});if(goalsResponse.ok){const goalPayload=await goalsResponse.json();if(active)setGoals((goalPayload.goals??[]) as GoalSummary[])}const r=await fetch("/api/vera/entitlement",{headers:{Authorization:"Bearer "+token},cache:"no-store"});if(r.ok){const e=await r.json();if(active)setGold(Boolean(e.isGold))}}}catch(e){if(active)setError(e instanceof Error?e.message:"No pudimos preparar FINANCE WRAPPED.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[]);
 const currencies=useMemo(()=>Array.from(new Set(rows.map(x=>x.currency))).sort(),[rows]);
 useEffect(()=>{if(currencies.length&&!currencies.includes(currency))setCurrency(currencies[0])},[currencies,currency]);
 useEffect(()=>{let active=true;(async()=>{const symbols=currencies.filter(code=>code!=="ARS");if(!symbols.length){if(active)setArsRates({ARS:1});return}try{const {data:session}=await supabase.auth.getSession();const token=session.session?.access_token;if(!token)return;const response=await fetch("/api/vera/reference-rates?symbols="+encodeURIComponent(symbols.join(",")),{headers:{Authorization:"Bearer "+token},cache:"no-store"});if(!response.ok)return;const payload=await response.json();if(active&&payload.rates)setArsRates({ARS:1,...payload.rates})}catch{}})();return()=>{active=false}},[currencies]);
 const {s,e}=range(period,offset),label=periodLabel(period,s),start=key(s),end=key(e);
 const data=rows.filter(x=>x.currency===currency&&x.movement_date.slice(0,10)>=start&&x.movement_date.slice(0,10)<=end),expenses=data.filter(x=>x.type==="expense"),income=data.filter(x=>x.type==="income");
 const totalIn=income.reduce((a,x)=>a+Number(x.amount),0),totalOut=expenses.reduce((a,x)=>a+Number(x.amount),0),net=totalIn-totalOut,rate=totalIn?net/totalIn:0;
 const incomeCats=Object.entries(income.reduce<Record<string,number>>((a,x)=>{const k=x.category?.trim()||"Sin categoría";a[k]=(a[k]||0)+Number(x.amount);return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const cats=Object.entries(expenses.reduce<Record<string,number>>((a,x)=>{const k=x.category?.trim()||"Sin categoría";a[k]=(a[k]||0)+Number(x.amount);return a},{})).sort((a,b)=>b[1]-a[1]).slice(0,5);
 const shops=Object.entries(expenses.reduce<Record<string,{name:string,total:number,count:number}>>((a,x)=>{const n=(x.description||x.category||"Gasto").trim(),k=clean(n);if(!a[k])a[k]={name:n,total:0,count:0};a[k].total+=Number(x.amount);a[k].count++;return a},{})).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
 const days=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"],weekday=expenses.reduce<Record<string,number>>((a,x)=>{const d=days[new Date(x.movement_date.slice(0,10)+"T12:00:00").getDay()];a[d]=(a[d]||0)+Number(x.amount);return a},{}),peak=Object.entries(weekday).sort((a,b)=>b[1]-a[1])[0];
 const biggest=[...expenses].sort((a,b)=>Number(b.amount)-Number(a.amount))[0],smallThreshold=currency==="ARS"?30000:(arsRates[currency]?30000*arsRates[currency]:null),small=smallThreshold!==null?expenses.filter(x=>Number(x.amount)>0&&Number(x.amount)<smallThreshold):[],smallSum=small.reduce((a,x)=>a+Number(x.amount),0);
 const timedExpenses=expenses.filter(x=>/T\d{2}:\d{2}/.test(x.movement_date));
 const nightExpenses=timedExpenses.filter(x=>{const hour=Number(x.movement_date.slice(11,13));return hour>=20||hour<3});
 const nightShare=timedExpenses.length?nightExpenses.reduce((sum,x)=>sum+Number(x.amount),0)/timedExpenses.reduce((sum,x)=>sum+Number(x.amount),0):0;
 const hasEnoughData=data.length>=4&&income.length>=1&&expenses.length>=2;
 const isNightImpulse=timedExpenses.length>=4&&nightShare>=.6;
 const archetype=!hasEnoughData?"¡Todo un misterio!":isNightImpulse?"Impulso Nocturno":totalIn>0&&rate>=.25?"El Estratega":totalIn>0&&rate>=.1?"La Hormiga Ahorradora":"El Equilibrista";
 const archetypeDescriptions:Record<string,string>={
 "El Estratega":"Tus ingresos y gastos muestran un balance positivo. Tenés margen para planificar y avanzar con tus objetivos.",
 "Impulso Nocturno":"Una parte importante de tus gastos se concentra durante la noche. Revisar esas categorías puede ayudarte a decidir mejor.",
 "La Hormiga Ahorradora":"Tus registros muestran un balance positivo y avances sostenidos. La constancia puede acercarte a tus objetivos.",
 "El Equilibrista":"Tus ingresos y gastos están más ajustados. Revisar las categorías principales puede ayudarte a encontrar margen.",
 "¡Todo un misterio!":"Todavía faltan movimientos para reconocer un patrón. Con más registros, VERA podrá darte una lectura más precisa."
 };
 const archetypeText=archetypeDescriptions[archetype];
 const goalProgress=goals.filter(g=>g.status==="active"||g.status==="paused"||g.status==="completed").slice(0,6);
 const bestGoal=goalProgress.filter(g=>g.status==="active").sort((a,b)=>b.progress_percent-a.progress_percent)[0];
 const goalEncouragement=bestGoal?bestGoal.progress_percent>=75?"Estás muy cerca de "+bestGoal.title+". Sostené el ritmo.":bestGoal.progress_percent>=35?"Buen avance en "+bestGoal.title+". La constancia importa.":"Elegí un aporte pequeño y posible para "+bestGoal.title+".":goalProgress.length?"Tenés objetivos en seguimiento. Retomá el que más te importe.":"Creá un objetivo para empezar a medir tu progreso.";
 const incomeShare=totalIn>0?incomeCats.map(([name,value])=>({name,value,percent:Math.round(value/totalIn*100)})):[];
 const dates=new Set(expenses.map(x=>x.movement_date.slice(0,10)));let streak=0,longest=0;for(let d=new Date(s);d<=e&&d<=new Date();d.setDate(d.getDate()+1)){if(dates.has(key(d)))streak=0;else{streak++;longest=Math.max(longest,streak)}}
 const slides=[["FINANCE WRAPPED","Tu período, en perspectiva.","Una mirada a tus movimientos registrados."],["TU ARQUETIPO",archetype,archetypeText],["EL RESUMEN","Así se movió tu dinero.","Ingresos, gastos y resultado neto."],["TUS INGRESOS","¿De dónde vino el dinero?","Tus principales fuentes de ingresos."],["TUS TOP","¿A dónde fue tu dinero?","Las categorías con más gastos."],["TUS COMERCIOS","Los nombres que más se repitieron.","Tus descripciones más frecuentes."],["TU MOMENTO PICO",peak?"Tu día con más gastos fue el "+peak[0]+".":"Todavía no hay un día destacado.","Según los movimientos registrados."],["TUS RACHAS",longest+" días sin gastos registrados.","Una pausa en tus registros de gastos."],["TUS OBJETIVOS",goalProgress.length?goalProgress.length+" objetivos en seguimiento.":"Tus próximas metas pueden empezar acá.",goalEncouragement],["GASTOS HORMIGA",biggest?"Tu gasto más alto fue de "+money(Number(biggest.amount),currency):"Todavía no hay un gasto destacado.", smallThreshold!==null?(small.length?small.length+" compras por debajo del equivalente aproximado a $30.000 ARS sumaron "+money(smallSum,currency)+".":"No aparecen compras por debajo del equivalente aproximado a $30.000 ARS."):"No hay una cotización disponible para calcular el equivalente a $30.000 ARS."],["TU FINANCE WRAPPED","Tu progreso merece continuidad.","Seguí registrando tus movimientos y objetivos en FINANCE.TRACK."]];
 const current=slides[slide];
 async function share(){const text="Mi FINANCE WRAPPED · "+label+"\nIngresos: "+money(totalIn,currency)+" · Gastos: "+money(totalOut,currency)+" · Resultado neto: "+money(net,currency)+"\nArquetipo: "+archetype;if(navigator.share){try{await navigator.share({title:"Mi FINANCE WRAPPED",text})}catch{}}else if(navigator.clipboard)await navigator.clipboard.writeText(text)}
 if(loading)return <FinanceTrackLoader message="Preparando tu FINANCE WRAPPED"/>;
 if(error)return <main className="wrapped-page"><section className="wrapped-card">{error}</section></main>;
 return <main className="wrapped-page">
  <header className="wrapped-header"><a href="/" className="wrapped-return-link">← Volver a FINANCE.TRACK</a><div className="wrapped-controls"><select value={period} onChange={v=>{setPeriod(v.target.value as Period);setOffset(0);setSlide(0)}}><option value="month">Mes</option><option value="quarter">Trimestre</option><option value="year">Año</option></select><select value={currency} onChange={v=>setCurrency(v.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></div></header>
  <div className="wrapped-period-nav"><button onClick={()=>{setOffset(v=>v-1);setSlide(0)}}>Anterior</button><strong>{label}</strong><button disabled={offset>=0} onClick={()=>{setOffset(v=>Math.min(0,v+1));setSlide(0)}}>Actual</button></div>
  <section className="wrapped-stage"><div className="wrapped-progress">{slides.map((v,i)=><span key={v[0]} className={i<=slide?"done":""}/>)}</div>
   <div className="wrapped-story"><p className="wrapped-eyebrow">{current[0]}</p><h1>{current[1]}</h1><p className="wrapped-body">{current[2]}</p>
    {slide===0&&<div className="wrapped-cover-mark"><span>FINANCE</span><strong>WRAPPED</strong><small>{label}</small></div>}
    {slide===2&&<div className="wrapped-metrics"><article><small>Ingresos</small><strong>{money(totalIn,currency)}</strong></article><article><small>Gastos</small><strong>{money(totalOut,currency)}</strong></article><article><small>Resultado neto</small><strong>{money(net,currency)}</strong></article></div>}
    {slide===3&&<><div className="wrapped-highlight"><strong>{money(totalIn,currency)}</strong><span>{income.length} ingresos registrados en el período</span></div><div className="wrapped-bars">{incomeShare.length?incomeShare.map(item=><div key={item.name}><div><span>{item.name}</span><b>{item.percent}% · {money(item.value,currency)}</b></div><i><em style={{width:item.percent+"%"}}/></i></div>):<p>No hay ingresos registrados para este período y moneda.</p>}</div></>}
    {slide===1&&<div className="wrapped-archetype-explain"><div className="wrapped-highlight"><strong>{archetype}</strong><span>{totalIn?Math.round(rate*100)+"% de resultado neto sobre ingresos":"Sin base de ingresos"}</span></div><p>{archetypeText}</p></div>}
    {slide===4&&<div className="wrapped-bars">{cats.length?cats.map(([n,v],i)=><div key={n}><div><span>{n}</span><b>{money(v,currency)}</b></div><i><em style={{width:(v/cats[0][1]*100)+"%"}}/></i></div>):<p>Sin gastos categorizados en este período.</p>}</div>}
    {slide===5&&<div className="wrapped-bars">{shops.length?shops.map(([k,v])=><div key={k}><div><span>{v.name} · {v.count} registros</span><b>{money(v.total,currency)}</b></div><i><em style={{width:(v.total/shops[0][1].total*100)+"%"}}/></i></div>):<p>Faltan registros para encontrar comercios frecuentes.</p>}</div>}
    {slide===6&&<div className="wrapped-highlight"><strong>{peak?money(peak[1],currency):"—"}</strong><span>{peak?"Gastos registrados los "+peak[0]:"Sin datos suficientes"}</span></div>}
    {slide===7&&<div className="wrapped-highlight"><strong>{longest}</strong><span>días sin gastos registrados</span></div>}
    {slide===9&&<div className="wrapped-metrics"><article><small>Mayor gasto</small><strong>{biggest?money(Number(biggest.amount),currency):"—"}</strong></article><article><small>Gastos hormiga</small><strong>{money(smallSum,currency)}</strong></article><article><small>Compras menores</small><strong>{small.length}</strong></article></div>}
    {slide===10&&<div className="wrapped-share-card"><span>FINANCE.TRACK</span><strong>{archetype}</strong><p>Ingresos <b>{money(totalIn,currency)}</b></p><p>Gastos <b>{money(totalOut,currency)}</b></p><p>Resultado neto <b>{money(net,currency)}</b></p><small>{label} · FINANCE WRAPPED</small></div>}
   </div>
   {slide===8&&<div className="wrapped-goals-grid">{goalProgress.length?goalProgress.map(goal=><article key={goal.id}><div><strong>{goal.title}</strong><b>{goal.progress_percent.toLocaleString("es-AR")}%</b></div><i><em style={{width:Math.min(100,goal.progress_percent)+"%"}}/></i><small>{money(goal.saved_amount,goal.currency)} de {money(goal.target_amount,goal.currency)}{goal.target_date?" · Fecha objetivo "+new Date(goal.target_date+"T12:00:00").toLocaleDateString("es-AR"):""}</small><p>{goal.progress_percent>=75?"Estás cerca. Cada aporte confirmado cuenta.":goal.progress_percent>=35?"Buen avance. La constancia sostiene el progreso.":"Un paso a la vez: registrar tus aportes te permite ver el camino."}</p></article>):<p>Creá una meta en Objetivos y registrá aportes para ver tu progreso en próximos Wrapped.</p>}</div>}
   {vera&&<aside className={gold?"wrapped-vera wrapped-vera-gold":"wrapped-vera wrapped-vera-free"}><div className={gold?"wrapped-vera-icon gold":"wrapped-vera-icon"}><VeraIsotype/></div><p><b>VERA</b> {slide===1? "Tu arquetipo es una pista para reconocer hábitos, no una etiqueta.":slide===2?(net<0?"Revisá qué categoría está presionando más tu balance.":"Podés destinar parte de tu resultado a uno de tus objetivos."):slide===3?"Identificá tu fuente de ingresos principal y cómo sostenerla.":slide===4?"Elegí una categoría para revisar esta semana.":slide===5?"Compará tus comercios frecuentes antes de repetir una compra.":slide===6?"La constancia en los registros ayuda a detectar cambios.":slide===7?"Una pausa en los gastos registrados puede ser una oportunidad para revisar prioridades.":slide===8?goalEncouragement:slide===9?"Los gastos pequeños también suman: observá cuáles se repiten.":"Seguí registrando tus movimientos para tomar decisiones con más claridad."}</p></aside>}
   <div className="wrapped-nav"><button disabled={slide===0} onClick={()=>setSlide(v=>Math.max(0,v-1))}>Anterior</button><button disabled={slide===slides.length-1} onClick={()=>setSlide(v=>Math.min(slides.length-1,v+1))}>Siguiente</button></div>
  </section>
  <footer className="wrapped-footer"><button onClick={()=>setVera(v=>!v)}>{vera?"Ocultar opinión de VERA":"Mostrar opinión de VERA"}</button><button onClick={share}>Compartir resumen</button></footer>
  {data.length===0&&<p className="wrapped-note">No hay movimientos registrados para este período y moneda. Probá otro período o registrá movimientos.</p>}
 </main>
}

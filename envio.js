/* ===== v0.8.0 · Envío a Apps Script, ficha técnica y estado del envío =====
   Reglas:
   - No recalcula nada: usa el mismo objeto calc de calculate() y los mismos textos (goals, teach) que acaba de
     mostrar el reporte. Así el Sheets, la ficha y el correo coinciden con lo que vio la empresa.
   - Los códigos de empresa y de diagnóstico los genera Apps Script.
   - Con #demo en la dirección, o sin APPS_SCRIPT_URL, no se envía nada.
*/
(function(){
"use strict";
const VERSION_FORMULARIO="v0.8.7";
const VERSION_CALCULO="v0.7.3 · D5 con reescala provisional (x+25)×2";
const VERSION_RUTEO="Provisional · misma posición que el nivel";
const VERSION_AVISO="2026-11-18";
const LEVEL_NAME={N1:"Perla",N2:"Jade",N3:"Esmeralda",N4:"Rubí",N5:"Diamante"};
const ROUTE_NAME={R1:"Explora",R2:"Impulsa",R3:"Crece",R4:"Transforma",R5:"Trasciende"};
const NUM_Q={q1:1,q2:2,q3:3,q4:4,q5:5,q6:6,q7:7,q8:8,q9:9,q10:10,q11:11,q12:12,q13:13,q19:14,q14:15,q15:16,q16:17,q17:18,q18:19,q20:20,q32:21,q33:22,q34:23,q35:24,q21:25,q22:26,q23:27,q24:28,q25:29,q26:30,q27:31,q28:32,q29:33,q30:34,q31:35};

/* ---------- estilos del estado del envío ---------- */
const css=document.createElement("style");
css.textContent=`.envio-estado{margin:18px 0 6px;padding:14px 16px;border-radius:12px;font-size:15px;line-height:1.5;display:none}
.envio-estado.on{display:block}.envio-estado.cargando{background:#EEF4FF;color:#011755;border:1px solid #C9DAFF}
.envio-estado.ok{background:#ECFDF3;color:#05603A;border:1px solid #ABEFC6}.envio-estado.pendiente{background:#FFFAEB;color:#7A2E0E;border:1px solid #FEDF89}
.envio-estado.error{background:#FEF3F2;color:#912018;border:1px solid #FECDCA}.envio-estado button{margin-top:10px}
.envio-spin{display:inline-block;width:14px;height:14px;border:2px solid #9DB8F5;border-top-color:#0058DC;border-radius:50%;animation:envspin .8s linear infinite;vertical-align:-2px;margin-right:8px}
@keyframes envspin{to{transform:rotate(360deg)}}
#procModal{position:fixed;inset:0;z-index:10001;background:rgba(0,3,74,.55);display:none;align-items:center;justify-content:center;padding:16px}
#procModal .pc{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:28px 24px;text-align:center;box-shadow:0 10px 40px rgba(0,3,74,.35);color:#011755}
#procModal .ring{width:56px;height:56px;border:6px solid #DCE3EE;border-top-color:#0058DC;border-radius:50%;margin:4px auto 16px;animation:envspin .9s linear infinite}
#procModal h2{color:#00034A;font-size:21px;margin:0 0 8px}#procModal p{margin:0 0 6px;line-height:1.5}#procModal .det{font-size:12px;opacity:.7;margin-top:8px}
#procModal button{margin:12px 6px 0}@media print{.envio-estado{display:none!important}}`;
document.head.appendChild(css);

/* ---------- utilidades ---------- */
const r2=x=>x===null||x===undefined||x===""?"":Math.round(x*100)/100;
const fmt1=x=>x===null||x===undefined||x===""?"N/A":(Math.round(x*10)/10).toFixed(1);
const sg=x=>x===null||x===undefined?"N/A":(x>0?"+"+x:String(x));
const sinIdNivel=t=>String(t).replace(/\s*\(N[1-5]\)/g,"");
function canal(){const p=new URLSearchParams(location.search).get("canal")||"";const c=p.toLowerCase().replace(/[^a-z0-9_-]/g,"").slice(0,30);return c||"directo"}
function nuevoId(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2,12))}
/* v0.8.4 · en modo demostración, una casilla permite enviar de verdad (pruebas con datos de ejemplo) */
const demoReal=(()=>{const bar=document.getElementById("demoBar");if(!bar)return null;
  const l=document.createElement("label");l.style.cssText="display:inline-flex;align-items:center;gap:6px;margin-left:12px;font-weight:700;cursor:pointer";
  l.innerHTML='<input type="checkbox" id="demoEnviarReal"> Enviar de verdad (guarda en las hojas y manda el correo)';bar.appendChild(l);return l.querySelector("input")})();
const esDemo=()=>location.hash==="#demo"&&!(demoReal&&demoReal.checked);
let envioId=null,ultimoPayload=null,ultimoReporte=null,enviando=false,enviado=false;
window.envioReset=function(){envioId=null;ultimoPayload=null;ultimoReporte=null;enviando=false;enviado=false};

/* Requisitos de cada nivel, con las mismas condiciones que calculate() (r3, r4, r5). Solo para la ficha y el Sheets. */
function requisitos(calc,c01,c02,c03){
  const {processes:pr,functions:fn,purposes:pu,D4,real,automation}=calc;
  return [
    {nivel:"Jade",items:[["Adopción efectiva (M02 ≥ 40 y M04 > 0)",real]]},
    {nivel:"Esmeralda",items:[["Adopción efectiva",real],["≥ 1 proceso (P21): "+pr,pr>=1],["D4 ≥ 75: "+fmt1(D4),D4>=75]]},
    {nivel:"Rubí",items:[["Adopción efectiva",real],["≥ 3 procesos: "+pr,pr>=3],["≥ 3 funciones: "+fn,fn>=3],["≥ 3 propósitos: "+pu,pu>=3],["D4 = 100: "+fmt1(D4),D4===100]]},
    {nivel:"Diamante",items:[["Adopción efectiva",real],["≥ 6 procesos: "+pr,pr>=6],["≥ 6 funciones: "+fn,fn>=6],["≥ 6 propósitos: "+pu,pu>=6],["D4 = 100",D4===100],["Automatización con C03 = +10 o +25: "+(c03===null?"N/A":sg(c03)),automation&&(c03===10||c03===25)],["C01 ≥ +10: "+sg(real?c01:null),real&&c01>=10],["C02 ≥ 0: "+sg(real?c02:null),real&&c02>=0]]}
  ];
}

function construirPayload(responses,calc,rep){
  const real=calc.real;
  const c01=scoreC01(responses.q33),c02=scoreC02(responses.q34),c03=scoreC03(responses.q35),m09=scoreM09(responses.q20);
  const toD5=x=>(x+25)*2;
  const req=requisitos(calc,c01,c02,c03);
  const cumple=n=>req.find(r=>r.nivel===n).items.every(i=>i[1]);
  const nivel=LEVEL_NAME[calc.max],ruta=ROUTE_NAME[assignRoute(calc.max)];
  /* control de coherencia: los requisitos deben reproducir el nivel de calculate() */
  const esperado=cumple("Diamante")?"Diamante":cumple("Rubí")?"Rubí":cumple("Esmeralda")?"Esmeralda":real?"Jade":"Perla";
  if(esperado!==nivel)console.error("Inconsistencia de requisitos",esperado,nivel);
  const v=id=>(document.getElementById(id)?.value||"").trim();
  return {
    tipo:"diagnostico",envio_id:envioId,sitio_web:v("sitio_web"),
    version_formulario:VERSION_FORMULARIO,version_calculo:VERSION_CALCULO,version_ruteo:VERSION_RUTEO,canal:canal(),
    privado:{nombre_empresa:v("nombre_empresa"),nombre_respondente:v("nombre_respondente"),puesto:v("puesto_funcion"),
      correo:v("email"),telefono:v("telefono"),acepta_aviso:!!document.getElementById("consentimiento")?.checked,
      version_aviso:VERSION_AVISO,acepta_comunicaciones:!!document.getElementById("acepta_comunicaciones")?.checked},
    respuestas:responses,
    autocompletado_sin_ia:Object.values(aiLogicAutocompleted).some(Boolean),
    calculo:{
      M01:calc.m01,M08:calc.m08,M02:calc.m02,M04:calc.m04,M07B:calc.D4,
      M09:real?m09:"",C01_original:real?c01:"",C02_original:real?c02:"",C03_original:(real&&c03!==null)?c03:"",
      C01_D5:real?toD5(c01):"",C02_D5:real?toD5(c02):"",C03_D5:(real&&c03!==null)?toD5(c03):"",
      n_funciones:calc.functions,n_propositos:calc.purposes,n_procesos:calc.processes,
      puntaje_funciones:scoreCount(calc.functions),puntaje_propositos:scoreCount(calc.purposes),
      D1:r2(calc.D1),D2:r2(calc.D2),D3:r2(calc.D3),D4:r2(calc.D4),D5:calc.D5===null?"":r2(calc.D5),D5_bruto:calc.D5raw===null?"":r2(calc.D5raw),
      indice:r2(calc.index),formula_indice:real?"General":"Sin adopción efectiva",
      adopcion_efectiva:real?"Sí":"No",automatizacion:calc.automation?"Sí":"No"},
    reporte:{nivel,ruta,valor_mostrado:rep.idx,etiqueta_mostrada:rep.startPoint?"Punto de partida":"Índice",
      siguiente_nivel:rep.nextName||"",metas:rep.goals,temas:rep.teach.map(t=>t[0]),
      cumple_esmeralda:cumple("Esmeralda")?"Sí":"No",cumple_rubi:cumple("Rubí")?"Sí":"No",cumple_diamante:cumple("Diamante")?"Sí":"No",
      alertas:calc.alerts.map(sinIdNivel),brechas:calc.gaps.map(sinIdNivel)},
    _ficha:{req,c01,c02,c03,m09,real}
  };
}

/* ---------- v0.8.3 · ventana de proceso: el reporte se muestra solo después de guardar ---------- */
const pm=document.createElement("div");pm.id="procModal";pm.setAttribute("role","dialog");pm.setAttribute("aria-modal","true");pm.setAttribute("aria-live","polite");document.body.appendChild(pm);
let procTimer=null;
function procCargando(){
  const pasos=["Evaluando tus respuestas…","Calculando tu índice y tu nivel…","Preparando tu reporte personalizado…"];let i=0;
  pm.innerHTML='<div class="pc"><div class="ring" aria-hidden="true"></div><h2 id="procTxt">'+pasos[0]+'</h2><p>Esto toma solo unos segundos. No cierres esta página.</p></div>';
  pm.style.display="flex";clearInterval(procTimer);
  procTimer=setInterval(()=>{i=Math.min(i+1,pasos.length-1);const t=document.getElementById("procTxt");if(t)t.textContent=pasos[i]},2500);
}
function procCerrar(){clearInterval(procTimer);pm.style.display="none";pm.innerHTML=""}
function procError(det){
  clearInterval(procTimer);
  pm.innerHTML='<div class="pc"><div style="font-size:40px;line-height:1;margin-bottom:8px">⚠️</div><h2>No pudimos guardar tu diagnóstico</h2><p>Revisa tu conexión a internet e inténtalo de nuevo. Tus respuestas siguen en el formulario.</p><button type="button" class="primary" id="procReintentar">Reintentar</button><button type="button" class="secondary" id="procVolver">Volver al formulario</button><p class="det">Detalle técnico: '+det+'</p></div>';
  pm.style.display="flex";
  document.getElementById("procReintentar").addEventListener("click",()=>enviar(ultimoPayload,ultimoReporte));
  document.getElementById("procVolver").addEventListener("click",procCerrar);
  document.getElementById("procReintentar").focus();
}
function mostrarReporte(){
  const r=document.getElementById("result");if(r)r.style.display="block";
  const bar=document.getElementById("progressBar");if(bar)bar.style.display="none";
  if(r)r.scrollIntoView({behavior:"smooth",block:"start"});
}

function alertaCorreoEjemplo(){
  pm.innerHTML='<div class="pc"><div style="font-size:40px;line-height:1;margin-bottom:8px">✉️</div><h2>Cambia el correo de ejemplo</h2><p>El correo es de ejemplo y el diagnóstico no llegaría. Escribe un correo real y vuelve a pulsar «Ver mi diagnóstico».</p><button type="button" class="primary" id="procOk">Entendido</button></div>';
  pm.style.display="flex";document.getElementById("procOk").addEventListener("click",()=>{procCerrar();const e=document.getElementById("email");e?.scrollIntoView({behavior:"smooth",block:"center"});e?.focus({preventScroll:true})});
}

/* ---------- estado visible ---------- */
function estado(tipo,html){
  const el=document.getElementById("envioEstado");if(!el)return;
  el.className="envio-estado on "+tipo;el.innerHTML=html;
  /* v0.8.2: el PDF solo se ofrece cuando el diagnóstico ya quedó guardado (o en demostración) */
  const pa=document.querySelector(".report-actions");if(pa)pa.style.display=(tipo==="cargando"||tipo==="error")?"none":"";
  const b=el.querySelector("[data-reintentar]");if(b)b.addEventListener("click",()=>enviar(ultimoPayload,ultimoReporte));
}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

async function post(obj){
  const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),45000);
  try{
    const r=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(obj),redirect:"follow",signal:ctrl.signal});
    if(!r.ok)throw new Error("HTTP "+r.status);
    return await r.json();
  }finally{clearTimeout(t)}
}

window.enviarDiagnostico=function(responses,calc,rep){
  if(esDemo()){estado("pendiente","<b>Modo demostración:</b> este diagnóstico no se guardó ni se envió por correo.");return}
  if(!APPS_SCRIPT_URL){estado("pendiente","<b>Versión local:</b> no hay conexión configurada; el diagnóstico no se guardó.");return}
  if(enviado){estado("ok","Tu diagnóstico ya fue enviado. Para responder de nuevo, usa «Limpiar».");return}
  if(enviando)return;
  if(/@ejemplo\.com$/i.test((document.getElementById("email")?.value||"").trim())){
    const r=document.getElementById("result");if(r)r.style.display="none";
    alertaCorreoEjemplo();return}
  envioId=nuevoId();
  const p=construirPayload(responses,calc,rep);
  ultimoPayload=p;ultimoReporte={responses,calc,rep};
  const r=document.getElementById("result");if(r)r.style.display="none";
  enviar(p,ultimoReporte);
};

async function enviar(p,ctx){
  if(enviando||!p)return;enviando=true;
  const btn=document.getElementById("submitBtn");if(btn){btn.disabled=true;btn.textContent="Enviando…"}
  estado("cargando",'<span class="envio-spin" aria-hidden="true"></span>Guardando tu diagnóstico y enviándolo a tu correo…');
  procCargando();
  const {_ficha,...cuerpo}=p;
  try{
    const res=await post(cuerpo);
    if(!res||!res.ok){const er=new Error((res&&res.error)||"Respuesta inválida");er.servidor=true;throw er}
    enviado=true;
    if(btn){btn.disabled=true;btn.textContent="Diagnóstico enviado"}
    procCerrar();
    const correo=esc(p.privado.correo);
    const folio=`<br>Tu folio de diagnóstico: <b style="letter-spacing:.04em">${esc(res.codigo_diagnostico)}</b>. Guárdalo para consultar tu diagnóstico más adelante.`;
    if(res.correo==="enviado")estado("ok",`<b>¡Listo!</b> Te enviamos tu diagnóstico a <b>${correo}</b>.${folio} <br>📩 Si no lo ves en unos minutos, búscalo también en <b>Promociones</b> o en <b>Spam</b>, y muévelo a tu bandeja <b>Principal</b> para que no te pierdas nuestros avisos.`);
    else estado("pendiente",`<b>Tu diagnóstico quedó guardado.</b> El correo a <b>${correo}</b> saldrá en las próximas horas. Mientras tanto, puedes guardar este reporte en PDF.${folio}`);
    mostrarReporte();
    /* ficha técnica: se dibuja con los códigos que devolvió el servidor y se sube aparte */
    try{
      const png=await dibujarFicha(p,res);
      try{await post({tipo:"ficha",codigo_diagnostico:res.codigo_diagnostico,ficha_token:res.ficha_token,png})}
      catch(e){await new Promise(r=>setTimeout(r,2000));await post({tipo:"ficha",codigo_diagnostico:res.codigo_diagnostico,ficha_token:res.ficha_token,png})}
    }catch(e){console.error("Ficha técnica no enviada",e)}
  }catch(e){
    console.error(e);
    if(btn){btn.disabled=false;btn.textContent="Ver mi diagnóstico"}
    const det=esc((e&&e.name==="AbortError")?"Tiempo de espera agotado":(e&&e.message)||"Error desconocido");
    procError(det);
    estado("error",'<b>No pudimos guardar tu diagnóstico.</b> Revisa tu conexión a internet e inténtalo de nuevo. Tus respuestas siguen en el formulario.<br><button type="button" class="primary" data-reintentar>Reintentar envío</button><br><span style="font-size:12px;opacity:.75">Detalle técnico: '+det+'</span>');
  }finally{enviando=false}
}

/* ---------- ficha técnica (PNG) ---------- */
function cargarImg(src){return new Promise(res=>{if(!src)return res(null);const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src})}
window.dibujarFicha=async function(p,res){
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready}catch(e){}
  const W=1240,M=56,FONT='"Atkinson Hyperlegible Next","Atkinson Hyperlegible",Arial,sans-serif';
  const cv=document.createElement("canvas");cv.width=W;cv.height=3200;const g=cv.getContext("2d");
  const C={navy:"#00034A",ink:"#011755",blue:"#0058DC",light:"#4FB3FF",muted:"#5B6B86",line:"#DCE3EE",bg:"#F3F6FB",ok:"#067647",bad:"#B42318",na:"#98A2B3"};
  g.fillStyle="#fff";g.fillRect(0,0,W,cv.height);
  const f=(sz,w)=>{g.font=`${w||400} ${sz}px ${FONT}`};
  const txt=(t,x,y,sz,col,w,align)=>{f(sz,w);g.fillStyle=col||C.ink;g.textAlign=align||"left";g.textBaseline="alphabetic";g.fillText(String(t),x,y);g.textAlign="left"};
  const wrap=(t,x,y,maxW,sz,col,w,lh)=>{f(sz,w);g.fillStyle=col||C.ink;const words=String(t).split(/\s+/);let line="",yy=y;lh=lh||Math.round(sz*1.32);
    for(const wd of words){const test=line?line+" "+wd:wd;if(g.measureText(test).width>maxW&&line){g.fillText(line,x,yy);yy+=lh;line=wd}else line=test}
    if(line){g.fillText(line,x,yy);yy+=lh}return yy};
  const rr=(x,y,w,h,r,fill,stroke)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke()}};
  const section=(t,y)=>{txt(t.toUpperCase(),M,y,17,C.blue,700);g.fillStyle=C.line;g.fillRect(M,y+10,W-2*M,2);return y+34};
  const k=p.calculo,rp=p.reporte,fx=p._ficha,r=p.respuestas;

  /* encabezado */
  g.fillStyle=C.navy;g.fillRect(0,0,W,150);
  txt("FICHA TÉCNICA INTERNA",M,62,30,"#fff",700);
  txt("Diagnóstico mAIpyme · uso interno, no se entrega a la empresa",M,96,17,"#BFD3FF");
  txt("Formulario "+p.version_formulario+" · Canal: "+p.canal,M,124,15,"#BFD3FF");
  txt(res.codigo_diagnostico,W-M,66,34,"#fff",700,"right");
  txt("Empresa: "+res.codigo_empresa+(res.num_diagnostico_empresa>1?" · diagnóstico n.º "+res.num_diagnostico_empresa:""),W-M,98,17,"#BFD3FF",400,"right");
  txt(res.fecha_hora+" (Ciudad de México)",W-M,124,15,"#BFD3FF",400,"right");

  /* resultado */
  let y=172;const bw=(W-2*M-40)/3,bh=156;
  rr(M,y,bw,bh,14,C.bg);txt("ÍNDICE",M+22,y+36,15,C.muted,700);
  txt(Number(k.indice).toFixed(2),M+22,y+98,56,C.navy,700);
  txt(k.formula_indice==="General"?"Fórmula general (D1–D5)":"Fórmula sin adopción efectiva",M+22,y+132,15,C.muted);
  const x2=M+bw+20;rr(x2,y,bw,bh,14,C.bg);txt("NIVEL",x2+22,y+36,15,C.muted,700);
  const gem=await cargarImg(typeof GEMS!=="undefined"?GEMS[Object.keys(LEVEL_NAME).find(n=>LEVEL_NAME[n]===rp.nivel)]:"");
  if(gem)g.drawImage(gem,x2+22,y+52,78,78);
  txt(rp.nivel,x2+(gem?112:22),y+100,40,C.navy,700);
  txt("Mostrado: "+rp.valor_mostrado+" ("+rp.etiqueta_mostrada.toLowerCase()+")",x2+22,y+142,15,C.muted);
  const x3=x2+bw+20;rr(x3,y,bw,bh,14,C.bg);txt("RUTA",x3+22,y+36,15,C.muted,700);
  txt(rp.ruta,x3+22,y+100,40,C.navy,700);
  wrap("Regla provisional: misma posición que el nivel",x3+22,y+132,bw-44,15,C.muted);
  y+=bh+36;

  /* dimensiones */
  y=section("Dimensiones",y);
  const dims=[["D1 · Conocimiento y criterio",k.D1,.15],["D2 · Adopción y recurrencia",k.D2,.15],["D3 · Amplitud y diversidad",k.D3,.25],["D4 · Profundidad e integración",k.D4,.20],["D5 · Calidad, responsabilidad y evaluación",k.D5,.25]];
  const real=k.adopcion_efectiva==="Sí";
  dims.forEach(([n,val,w],i)=>{
    const na=val===""||val===null;const wEff=real?w:(i===0||i===4?0:w/.60);
    txt(n,M,y+20,17,C.ink,600);
    const bx=M+430,bwid=430;rr(bx,y+4,bwid,20,10,"#E8EDF5");
    if(!na&&val>0)rr(bx,y+4,Math.max(20,bwid*val/100),20,10,C.blue);
    txt(na?"N/A":Number(val).toFixed(2),bx+bwid+18,y+21,18,C.navy,700);
    txt(wEff?`× ${(wEff*100).toFixed(wEff===w?0:1)}% = ${na?"—":(val*wEff).toFixed(2)}`:(i===0?"Dato diagnóstico, no suma":"No aplica"),W-M,y+21,15,C.muted,400,"right");
    y+=35;
  });
  y=wrap(real?"Índice = 0.15·D1 + 0.15·D2 + 0.25·D3 + 0.20·D4 + 0.25·D5":"Sin adopción efectiva: Índice = (0.15·D2 + 0.25·D3 + 0.20·D4) / 0.60. D1 se reporta como punto de partida; D5 no aplica.",M,y+8,W-2*M,15,C.muted)+18;

  /* variables */
  y=section("Variables y conteos",y);
  const vars=[["M01 · Conocimiento (P13)",k.M01],["M08 · Identificar oportunidades (P14)",k.M08],["M02 · Uso actual (P15)",k.M02],["M04 · Frecuencia (P17)",k.M04],
    ["M07-B · Integración (P19)",k.M07B],["M09 · Evaluación de beneficios (P20)",k.M09===""?"N/A":k.M09],
    ["C01 · Validación (P22)",k.C01_original===""?"N/A":`${sg(k.C01_original)} → ${k.C01_D5}`],["C02 · Protección (P23)",k.C02_original===""?"N/A":`${sg(k.C02_original)} → ${k.C02_D5}`],
    ["C03 · Supervisión (P24)",k.C03_original===""?"N/A (sin automatización)":`${sg(k.C03_original)} → ${k.C03_D5}`],
    ["Funciones (P16)",`${k.n_funciones} → ${k.puntaje_funciones}`],["Propósitos (P18)",`${k.n_propositos} → ${k.puntaje_propositos}`],["Procesos (P21)",`${k.n_procesos} (elegibilidad)`]];
  const colW=(W-2*M-30)/2;
  vars.forEach(([n,val],i)=>{const cx=M+(i%2)*(colW+30),cy=y+Math.floor(i/2)*30;txt(n,cx,cy+20,16,C.ink);txt(String(val),cx+colW,cy+20,16,C.navy,700,"right")});
  y+=Math.ceil(vars.length/2)*30+8;
  y=wrap("C0x → valor en D5 con la reescala provisional (x + 25) × 2. La elegibilidad usa el valor original. Escala de conteo D3: 0=0, 1=10, 2=25, 3=40, 4=55, 5=70, 6–8=85, 9+=100.",M,y,W-2*M,14,C.muted)+18;

  /* elegibilidad */
  y=section("Requisitos de nivel",y);
  const ew=(W-2*M-36)/4;let maxY=y;
  fx.req.forEach((blk,i)=>{const ex=M+i*(ew+12);const all=blk.items.every(t=>t[1]);
    txt(blk.nivel+(all?" ✓":""),ex,y+18,18,all?C.ok:C.navy,700);let yy=y+46;
    blk.items.forEach(([t,okk])=>{txt(okk?"✓":"✗",ex,yy,16,okk?C.ok:C.bad,700);yy=wrap(t,ex+22,yy,ew-26,14,C.ink)+4});
    maxY=Math.max(maxY,yy)});
  y=maxY+16;

  /* lo que vio la empresa */
  y=section("Lo que vio la empresa",y);
  txt(rp.siguiente_nivel?"Metas para el nivel "+rp.siguiente_nivel+":":"Sin meta siguiente (nivel máximo).",M,y+4,16,C.ink,700);y+=30;
  (rp.metas.length?rp.metas:["—"]).forEach(m=>{y=wrap("✦ "+m,M+10,y,W-2*M-10,15,C.ink)});
  y+=6;txt("Temas «Lo que vas a dominar»: "+(rp.temas.length?rp.temas.join(" · "):"—"),M,y,15,C.ink);y+=30;

  /* alertas */
  y=section("Alertas internas",y);
  (rp.alertas.length?rp.alertas:["Sin alertas"]).forEach(a=>{y=wrap("⚠ "+a,M,y,W-2*M,14,rp.alertas.length?C.bad:C.muted)});
  y+=12;

  /* contexto */
  y=section("Contexto del negocio",y);
  const J=a=>Array.isArray(a)?(a.length?a.join(" · "):"—"):(a||"—");
  const ctx=[["Giro",r.q1+" / "+(r.q2||"—")],["Personas",r.q3],["Alcaldía",r.q4],["Antigüedad",r.q5],["Sucursales",r.q6],["Puesto",p.privado.puesto],
    ["Digitalización (P9)",r.q9],["Capacidad tecnológica (P12)",r.q12],["Áreas de mejora (P25)",J(r.q21)],["Problemas (P26)",J(r.q22)],["Actividades (P27)",J(r.q23)],
    ["Resultado deseado (P28)",J(r.q24)],["Interés (P29)",r.q25],["Aprender (P30)",r.q26],["Primera acción (P31)",r.q27],["Invertir en capacitación (P32)",r.q28],
    ["Tiempo semanal (P33)",r.q29],["Gasto en software (P34)",r.q30],["Barreras (P35)",J(r.q31)]];
  const cW=(W-2*M-36)/2,lab=210;let yL=y,yR=y;
  ctx.forEach(([a,b],i)=>{const left=i<Math.ceil(ctx.length/2);const cx=left?M:M+cW+36;let cy=left?yL:yR;
    f(13,700);g.fillStyle=C.muted;g.fillText(a,cx,cy);cy=wrap(String(b||"—"),cx+lab,cy,cW-lab,13,C.ink,400,17)+5;
    if(left)yL=cy;else yR=cy});
  y=Math.max(yL,yR)+8;

  /* pie */
  g.fillStyle=C.line;g.fillRect(M,y,W-2*M,2);y+=26;
  y=wrap(`Cálculo ${p.version_calculo} · Ruteo ${p.version_ruteo}. Los umbrales numéricos del índice por nivel aún no están definidos: el nivel depende solo de los requisitos. La reescala de C01–C03 y la regla de ruteo son provisionales, pendientes de validación metodológica.`,M,y,W-2*M,13,C.muted)+10;

  const H=Math.max(1754,Math.ceil(y+12));const out=document.createElement("canvas");out.width=W;out.height=H;
  const o=out.getContext("2d");o.fillStyle="#fff";o.fillRect(0,0,W,H);o.drawImage(cv,0,0);
  return out.toDataURL("image/png");
};

/* ---------- v0.8.1 · Invitación única a marcar la casilla de avisos ----------
   Se muestra una sola vez, solo si el formulario está completo y la casilla opcional está sin marcar.
   "No, gracias" envía igual, sin marcarla. Nunca se marca sin que la persona lo elija. */
let avisosPreguntado=false;
const fm=document.getElementById("diagnostico"),am=document.getElementById("avisosModal"),opt=document.getElementById("acepta_comunicaciones");
if(fm&&am&&opt){
  const masc=document.querySelector("img.mascot");const mi=document.getElementById("avisosMascot");if(masc&&mi)mi.src=masc.src;else if(mi)mi.remove();
  const cerrar=()=>{am.style.display="none"};
  const enviarYa=()=>{avisosPreguntado=true;cerrar();if(fm.requestSubmit)fm.requestSubmit(document.getElementById("submitBtn"));else document.getElementById("submitBtn").click()};
  document.getElementById("avisosSi").addEventListener("click",()=>{opt.checked=true;enviarYa()});
  document.getElementById("avisosNo").addEventListener("click",enviarYa);
  am.addEventListener("keydown",e=>{if(e.key==="Escape")cerrar()});
  fm.addEventListener("submit",e=>{
    if(avisosPreguntado||opt.checked||enviado||esDemo())return;
    if(!validate().ok)return; /* si falta algo, primero se corrige el formulario */
    e.preventDefault();e.stopImmediatePropagation();
    am.style.display="flex";document.getElementById("avisosSi").focus();
  },true);
  const prevReset=window.envioReset;window.envioReset=function(){prevReset();avisosPreguntado=false};
}

/* ---------- v0.8.2 · Aviso de Privacidad y Términos en ventana, con botón Regresar ---------- */
const lm=document.getElementById("legalModal"),lf=document.getElementById("legalFrame"),lt=document.getElementById("legalModalTitle");
if(lm&&lf){
  const cerrarLegal=()=>{lm.style.display="none";lf.src="about:blank";document.body.style.overflow=""};
  document.addEventListener("click",e=>{
    const a=e.target.closest&&e.target.closest('a[href$="aviso-de-privacidad.html"],a[href$="terminos.html"]');if(!a)return;
    e.preventDefault();
    lt.textContent=/terminos/.test(a.getAttribute("href"))?"Términos y Condiciones":"Aviso de Privacidad";
    lf.src=a.getAttribute("href");lm.style.display="flex";document.body.style.overflow="hidden";
    document.getElementById("legalCerrar").focus();
  });
  document.getElementById("legalCerrar").addEventListener("click",cerrarLegal);
  lm.addEventListener("click",e=>{if(e.target===lm)cerrarLegal()});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&lm.style.display==="flex")cerrarLegal()});
}
})();

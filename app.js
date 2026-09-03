const employees=["Adam Juda","Michal Mourek","Martin Strejček","Ladislav Čihák"];
const hours=[6,7,8,9,10,11,12,13,14];
let readings=[];

const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const today=()=>new Date().toISOString().slice(0,10);
const burnoutText=v=>{
 if(v==null) return "Zatím se měříme...";
 if(v<3) return "Jsem čerstvý, dneska to půjde.";
 if(v<5) return "Začínám chápat, proč tu máme kafe.";
 if(v<7) return "Potřebuju pauzu. A možná změnit kariéru.";
 if(v<9) return "Jsem fyzicky přítomen, mentálně na dovolené.";
 if(v<10) return "Systém zaměstnanec.exe přestává odpovídat.";
 return "☠️ Systém zaměstnanec.exe přestal odpovídat.";
};
function val(emp,date,h){return readings.find(x=>x.employee===emp&&x.date===date&&x.hour===h)?.value}
async function load(){
 const date=$("date").value;
 const r=await fetch("/api/readings?from=2020-01-01&to=2999-12-31");
 readings=await r.json();
 render(date);
}
async function setVal(emp,date,h,v){
 await fetch("/api/readings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({employee:emp,date,hour:h,value:v})});
 await load();
}
function render(date){
 let html="<thead><tr><th>Zaměstnanec</th>"+hours.map(h=>`<th>${pad(h)}:00</th>`).join("")+"</tr></thead><tbody>";
 employees.forEach(emp=>{
   html+=`<tr><td class="name">${emp}</td>`;
   hours.forEach(h=>{
     const v=val(emp,date,h); const cur=(new Date().getHours()===h&&date===today())?" current":"";
     html+=`<td><button class="cell${cur}${v==null?" empty":""}" data-v="${v||""}" onclick="choose('${emp.replace(/'/g,"\\'")}','${date}',${h})">${v??"—"}</button></td>`;
   }); html+="</tr>";
 });
 $("meter").innerHTML=html;
 const vals=employees.flatMap(e=>hours.map(h=>val(e,date,h))).filter(v=>v!=null);
 const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
 $("teamScore").textContent=avg?avg.toFixed(1)+"/10":"—";
 $("teamText").textContent=burnoutText(avg);
 const current=new Date().getHours();
 $("currentHour").textContent=hours.includes(current)?pad(current)+":00":"Mimo pracovní dobu";
 const cv=hours.includes(current)?employees.map(e=>val(e,date,current)).filter(Boolean):[];
 $("hourText").textContent=cv.length?burnoutText(cv.reduce((a,b)=>a+b,0)/cv.length):"Zadejte hodnoty.";
 let avgs=employees.map(e=>{let a=hours.map(h=>val(e,date,h)).filter(v=>v!=null);return {e,avg:a.length?a.reduce((x,y)=>x+y,0)/a.length:null}}).filter(x=>x.avg!=null).sort((a,b)=>b.avg-a.avg);
 $("winner").textContent=avgs[0]?.e||"—";
 drawChart(date);
 renderYear();
}
async function choose(emp,date,h){
 let old=val(emp,date,h);
 let input=prompt(`${emp} • ${pad(h)}:00\nMíra vyhoření 1–10${old?` (aktuálně ${old})`:""}\n\n1 = úplná pohoda\n10 = zaměstnanec.exe přestal odpovídat`,old??"");
 if(input===null)return;
 let v=Math.round(Number(input));
 if(!Number.isInteger(v)||v<1||v>10){alert("Zadej číslo od 1 do 10.");return}
 setVal(emp,date,h,v);
}
function drawChart(date){
 const c=$("chart"),ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=330;
 c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const av=hours.map(hr=>{let a=employees.map(e=>val(e,date,hr)).filter(v=>v!=null);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null});
 const padL=45,padR=20,padT=20,padB=40, pw=w-padL-padR, ph=h-padT-padB;
 ctx.strokeStyle="#ddd";ctx.fillStyle="#777";ctx.font="12px system-ui";
 for(let y=1;y<=10;y+=1){let yy=padT+ph-(y-1)/9*ph;ctx.beginPath();ctx.moveTo(padL,yy);ctx.lineTo(w-padR,yy);ctx.stroke();ctx.fillText(y,padL-25,yy+4)}
 ctx.strokeStyle="#111";ctx.lineWidth=3;ctx.beginPath();let started=false;
 av.forEach((v,i)=>{if(v==null){started=false;return}let x=padL+i*(pw/(hours.length-1)),y=padT+ph-(v-1)/9*ph;if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)});ctx.stroke();
 ctx.fillStyle="#111";hours.forEach((hr,i)=>{let x=padL+i*(pw/(hours.length-1));ctx.fillText(pad(hr)+":00",x-15,h-12)});
}
function renderYear(){
 const year=Number($("year").value);
 const rows=readings.filter(x=>x.date.startsWith(year+"-"));
 const stats=employees.map(e=>{let a=rows.filter(x=>x.employee===e).map(x=>x.value);return{e,n:a.length,avg:a.length?a.reduce((x,y)=>x+y,0)/a.length:null}}).filter(x=>x.avg!=null).sort((a,b)=>b.avg-a.avg);
 $("leaderboard").innerHTML=stats.length?stats.map((x,i)=>`<div class="rank ${i===0?"first":""}"><strong>${["🥇","🥈","🥉","4️⃣"][i]||""}</strong><span>${x.e}<small style="display:block;color:#888">${x.n} měření</small></span><span class="avg">${x.avg.toFixed(2)} / 10</span></div>`).join(""):`<div class="muted">Pro rok ${year} zatím nejsou data.</div>`;
}
$("date").value=today();
$("date").addEventListener("change",load);
$("todayBtn").onclick=()=>{$("date").value=today();load()};
for(let y=new Date().getFullYear();y>=2026;y--) $("year").innerHTML+=`<option>${y}</option>`;
$("year").addEventListener("change",renderYear);
load();

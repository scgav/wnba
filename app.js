const TOTAL=PLAYERS.length;
const grid=document.getElementById("grid");
const countEl=document.getElementById("count");
const barFill=document.getElementById("barFill");
const remainingNamesEl=document.getElementById("remainingNames");
const remainingCountEl=document.getElementById("remainingCount");
const unguessedTab=document.getElementById("unguessedTab");
const guessedTab=document.getElementById("guessedTab");
const unguessedCountEl=document.getElementById("unguessedCount");
const guessedCountEl=document.getElementById("guessedCount");

const selections=new Map();
let submitted=false;
let cards=[];
let activeView="unguessed";

function norm(s){
 return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
}
function shuffle(a){
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
 return a;
}
function lastNameSort(a,b){
 const ap=a.name.trim().split(/\s+/),bp=b.name.trim().split(/\s+/);
 return ap[ap.length-1].localeCompare(bp[bp.length-1])||a.name.localeCompare(b.name);
}
const board=shuffle([...PLAYERS]);

async function resolveImages(){
 const images={};
 try{
   const r=await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/athletes?limit=400");
   if(!r.ok) throw new Error("player directory unavailable");
   const d=await r.json();
   const rows=d.athletes||d.items||[];
   rows.forEach(x=>{
     const a=x.athlete||x;
     const name=a.displayName||a.fullName;
     const url=a.headshot?.href || (a.id?`https://a.espncdn.com/i/headshots/wnba/players/full/${a.id}.png`:null);
     if(name&&url) images[norm(name)]=url;
   });
 }catch(e){console.warn("Player image directory request failed.",e)}
 return images;
}

function usedElsewhere(cardId){
 return new Set([...selections.entries()].filter(([id])=>id!==cardId).map(([,name])=>name));
}
function matches(query,name){
 const q=norm(query); if(!q)return true;
 const n=norm(name); return q.split(" ").every(part=>n.includes(part));
}
function updateRemaining(){
 const used=new Set(selections.values());
 const remaining=PLAYERS.filter(p=>!used.has(p.name)).sort(lastNameSort);
 remainingCountEl.textContent=remaining.length;
 remainingNamesEl.innerHTML="";
 if(!remaining.length){
   const d=document.createElement("div");d.className="remainingEmpty";d.textContent="Every name has been assigned.";remainingNamesEl.appendChild(d);return;
 }
 remaining.forEach(p=>{const d=document.createElement("div");d.className="remainingName";d.textContent=p.name;remainingNamesEl.appendChild(d)});
}
function updateView(){
 const guessed=selections.size,unguessed=TOTAL-guessed;
 guessedCountEl.textContent=guessed;unguessedCountEl.textContent=unguessed;
 cards.forEach(({card,player})=>{
   const isGuessed=selections.has(player.id);
   const show=activeView==="guessed"?isGuessed:!isGuessed;
   card.classList.toggle("viewHidden",!show);
 });
 const u=activeView==="unguessed";
 unguessedTab.classList.toggle("active",u);guessedTab.classList.toggle("active",!u);
 unguessedTab.setAttribute("aria-selected",String(u));guessedTab.setAttribute("aria-selected",String(!u));
}
function updateProgress(){
 const n=selections.size;countEl.textContent=n;barFill.style.width=(n/TOTAL*100)+"%";updateRemaining();updateView();
}
function renderMenu(card,input,menu,player){
 if(submitted)return;
 const used=usedElsewhere(player.id);
 const options=PLAYERS.filter(p=>!used.has(p.name)&&matches(input.value,p.name)).sort(lastNameSort).slice(0,12);
 menu.innerHTML="";
 if(!options.length){const d=document.createElement("div");d.className="empty";d.textContent="No available names match.";menu.appendChild(d);menu.classList.add("open");return}
 options.forEach(p=>{
   const d=document.createElement("div");d.className="option";d.textContent=p.name;d.setAttribute("role","option");
   d.addEventListener("mousedown",e=>{e.preventDefault();choose(card,input,menu,player,p.name)});
   menu.appendChild(d);
 });
 menu.classList.add("open");
}
function choose(card,input,menu,player,name){
 selections.set(player.id,name);input.value=name;input.dataset.selected=name;card.classList.add("matched");menu.classList.remove("open");updateProgress();
}
function clearChoice(card,input,menu,player){
 selections.delete(player.id);input.value="";input.dataset.selected="";card.classList.remove("matched");menu.classList.remove("open");updateProgress();
}
function makeCard(player,index,images){
 const card=document.createElement("article");card.className="card";card.dataset.id=player.id;
 card.innerHTML=`<div class="photoWrap"><div class="rank">FACE ${index+1}</div><img hidden alt="WNBA player headshot"></div>
 <div class="answer"><input autocomplete="off" spellcheck="false" aria-label="Name this WNBA player" placeholder="Type a player name…">
 <button type="button" class="clear" aria-label="Clear answer">×</button><div class="menu" role="listbox"></div></div><div class="feedback"></div>`;
 const img=card.querySelector("img"),input=card.querySelector("input"),menu=card.querySelector(".menu"),clear=card.querySelector(".clear");
 const src=images[norm(player.name)];
 if(src){img.src=src;img.onload=()=>{img.hidden=false};img.onerror=()=>{img.hidden=true}}
 input.addEventListener("focus",()=>renderMenu(card,input,menu,player));
 input.addEventListener("input",()=>{
   if(input.dataset.selected&&input.value!==input.dataset.selected){
     selections.delete(player.id);input.dataset.selected="";card.classList.remove("matched");updateProgress();
   }
   renderMenu(card,input,menu,player);
 });
 input.addEventListener("keydown",e=>{
   const opts=[...menu.querySelectorAll(".option")];let active=opts.findIndex(x=>x.classList.contains("active"));
   if(e.key==="ArrowDown"){e.preventDefault();active=Math.min(active+1,opts.length-1);opts.forEach(x=>x.classList.remove("active"));opts[active]?.classList.add("active");opts[active]?.scrollIntoView({block:"nearest"})}
   if(e.key==="ArrowUp"){e.preventDefault();active=Math.max(active-1,0);opts.forEach(x=>x.classList.remove("active"));opts[active]?.classList.add("active");opts[active]?.scrollIntoView({block:"nearest"})}
   if(e.key==="Enter"&&opts.length){e.preventDefault();choose(card,input,menu,player,opts[Math.max(active,0)].textContent)}
   if(e.key==="Escape")menu.classList.remove("open");
 });
 input.addEventListener("blur",()=>setTimeout(()=>menu.classList.remove("open"),100));
 clear.addEventListener("click",()=>clearChoice(card,input,menu,player));
 grid.appendChild(card);cards.push({card,input,player});
}
async function init(){
 const images=await resolveImages();
 board.forEach((p,i)=>makeCard(p,i,images));updateProgress();
 const missing=PLAYERS.filter(p=>!images[norm(p.name)]).length;
 if(missing)document.getElementById("imageNotice").textContent=`Player headshots loaded. ${missing} image${missing===1?"":"s"} could not be resolved by the image service.`;
}
init();

unguessedTab.addEventListener("click",()=>{activeView="unguessed";updateView()});
guessedTab.addEventListener("click",()=>{activeView="guessed";updateView()});

document.getElementById("submitBtn").addEventListener("click",()=>{
 const missing=TOTAL-selections.size;
 if(missing&&!confirm(`You still have ${missing} unmatched ${missing===1?"player":"players"}. Submit anyway?`))return;
 submitted=true;let score=0;
 cards.forEach(({card,input,player})=>{
   const guess=selections.get(player.id)||"",ok=guess===player.name;if(ok)score++;
   card.classList.add(ok?"correct":"wrong");
   card.querySelector(".feedback").textContent=ok?"✓ Correct":`✕ ${guess||"No answer"} → ${player.name}`;
   input.disabled=true;card.querySelector(".clear").style.display="none";
 });
 activeView=selections.size?"guessed":"unguessed";updateView();
 document.getElementById("score").textContent=score;
 document.getElementById("scoreLine").textContent=score>=68?"Elite WNBA face recognition.":score>=55?"You know this league extremely well.":score>=38?"Solid — the rotation players got you.":"The bottom half of the minutes leaderboard won this round.";
 document.getElementById("results").showModal();
});
document.getElementById("reviewBtn").addEventListener("click",()=>document.getElementById("results").close());
document.getElementById("playAgainBtn").addEventListener("click",()=>location.reload());
document.getElementById("resetBtn").addEventListener("click",()=>{if(confirm("Clear every answer and reshuffle the board?"))location.reload()});

const remainingPanel=document.querySelector(".remainingPanel");
const remainingToggle=document.getElementById("remainingToggle");
remainingToggle.addEventListener("click",()=>{
 const open=remainingPanel.classList.toggle("open");
 remainingToggle.setAttribute("aria-expanded",String(open));
 remainingToggle.textContent=open?"Hide remaining names":"Show remaining names";
});

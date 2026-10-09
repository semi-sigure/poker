const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const LV=[[10,20,0],[20,40,10],[30,60,15],[50,100,25],[100,200,50]],LVMS=720000,START=5000;
const HN=['ハイカード','ワンペア','ツーペア','スリーカード','ストレート','フラッシュ','フルハウス','フォーカード','ストレートフラッシュ'];
const $=id=>document.getElementById(id),rk=c=>c%13+2,su=c=>c/13|0;
const esc=s=>String(s).replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
const cs=c=>({11:'J',12:'Q',13:'K',14:'A'}[rk(c)]||rk(c))+'♣♦♥♠'[su(c)];
const cardH=(c,hide)=>hide?'<span class="card b">?</span>':`<span class="card ${su(c)==1||su(c)==2?'r':''}">${cs(c)}</span>`;
function s5(c){const r=c.map(rk).sort((a,b)=>b-a),fl=c.every(x=>su(x)==su(c[0]));let st=0;if(new Set(r).size==5){if(r[0]-r[4]==4)st=r[0];else if(r[0]==14&&r[1]==5)st=5}
const n={};r.forEach(x=>n[x]=(n[x]||0)+1);const g=Object.entries(n).map(([k,v])=>[v,+k]).sort((a,b)=>b[0]-a[0]||b[1]-a[1]),k=g.map(x=>x[1]),a=g[0][0],b=g[1]?g[1][0]:0;
const cat=fl&&st?8:a==4?7:a==3&&b==2?6:fl?5:st?4:a==3?3:a==2&&b==2?2:a==2?1:0,t=st?[st]:k;let v=cat;for(let i=0;i<5;i++)v=v*15+(t[i]||0);return v}
function best(c){let m=0;for(let i=0;i<c.length;i++)for(let j=i+1;j<c.length;j++){const s=s5(c.filter((_,k)=>k!=i&&k!=j));if(s>m)m=s}return m}


function makeRoom(){let S={phase:'lobby',players:[]},timer,hostId='',joins={};const conns={};const TURN=25000,REL=LVMS*3;let tt;
const nx=(i,f)=>{const n=S.players.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(f(S.players[j]))return j}return -1};
const view=id=>{const o=JSON.parse(JSON.stringify(S));delete o.deck;o.players.forEach(p=>{p.sc=0;if(p.id!=id&&!(o.reveal&&!p.folded))p.hole=(p.hole||[]).map(()=>-1)});return o};
const push=()=>Object.entries(conns).forEach(([id,w])=>{if(w.readyState==1){const o=view(id);o.host=hostId;o.now=Date.now();w.send(JSON.stringify({k:'st',s:o}))}});
function handleAway(id,v){if(S.phase=='lobby')return;const p=S.players.find(q=>q.id==id);if(!p)return;p.away=v?1:0;if(v&&S.phase=='play'&&S.players[S.turn]===p)act(S.turn,S.cur>p.bet?'f':'c');else push()}
function handleAct(id,t,a){if(S.phase!='play')return;const i=S.turn;if(S.players[i]&&S.players[i].id==id){S.players[i].to=0;act(i,t,a)}}
const sched=t=>{clearTimeout(timer);timer=setTimeout(newHand,t||7000)};

function seat(){let ch=0;Object.keys(joins).forEach(id=>{if(S.players.length<4&&!S.players.some(p=>p.id==id)){S.players.push({id,name:joins[id],chips:START});ch=1}});if(ch)push()}
function start(){S.startTs=Date.now();S.dealer=-1;S.hand=0;newHand()}
function reset(){S={phase:'lobby',players:[]};seat();push()}

function newHand(){clearTimeout(timer);const P=S.players;P.forEach(p=>{if(p.chips<=0&&!p.out)p.out=Date.now()});
P.forEach(p=>{p.in=p.chips>0&&!p.away?1:0;p.bet=p.tot=p.allin=p.acted=0;p.folded=!p.in;p.hole=[];p.sc=0});
const al=P.filter(p=>p.in);
const wc=P.filter(p=>p.chips>0).length;
if(al.length<2&&(wc>=2||(Date.now()-S.startTs<REL&&P.length>1))){S.phase='show';S.msg=wc>=2?'離席中のプレイヤーがいます。復帰待ち…':'リエントリー待ち…';sched();return push()}
if(al.length<2){S.phase='over';S.reveal=0;S.msg=al[0]?al[0].name+' の優勝！':'終了';S.rank=[...P].sort((a,b)=>(b.chips>0)-(a.chips>0)||(b.out||0)-(a.out||0)).map(p=>({n:p.name,r:p.re||0}));return push()}
S.lv=Math.min(4,(Date.now()-S.startTs)/LVMS|0);const [sb,bb,an]=LV[S.lv];
S.bb=bb;S.phase='play';S.hand++;S.board=[];S.street=0;S.reveal=0;S.msg='';
S.dealer=nx(S.dealer,p=>p.in);
const d=[...Array(52).keys()];for(let i=51;i>0;i--){const j=Math.random()*(i+1)|0;[d[i],d[j]]=[d[j],d[i]]}S.deck=d;
P.forEach(p=>{if(p.in)p.hole=[d.pop(),d.pop()]});
al.forEach(p=>{const a=Math.min(an,p.chips);p.chips-=a;p.tot+=a;if(!p.chips)p.allin=1});
const si=al.length==2?S.dealer:nx(S.dealer,p=>p.in),bi=nx(si,p=>p.in);
const post=(p,a)=>{a=Math.min(a,p.chips);p.chips-=a;p.bet+=a;p.tot+=a;if(!p.chips)p.allin=1};
post(P[si],sb);post(P[bi],bb);S.cur=bb;S.min=bb;S.turn=bi;
S.log=['— ハンド#'+S.hand+'  '+sb+'/'+bb+(an?' アンティ'+an:'')];adv();push()}

const aw=()=>{clearTimeout(tt);const p=S.players[S.turn];if(!p)return;if(p.away)act(S.turn,S.cur>p.bet?'f':'c');else{S.dl=Date.now()+TURN;tt=setTimeout(()=>{if(S.phase=='play'&&S.players[S.turn]===p){p.to=(p.to||0)+1;if(p.to>=2)p.away=1;act(S.turn,S.cur>p.bet?'f':'c')}},TURN)}};
function reentry(id){const p=S.players.find(q=>q.id==id);if(!p||S.phase=='lobby'||S.phase=='over'||p.chips>0||(S.phase=='play'&&p.in)||Date.now()-S.startTs>=REL)return;p.chips=START;p.out=0;p.away=0;p.re=(p.re||0)+1;S.log=(S.log||[]).concat(p.name+' がリエントリー').slice(-8);push()}
function adv(){const P=S.players,live=P.filter(p=>!p.folded);
if(live.length==1){const w=live[0],t=P.reduce((s,p)=>s+p.tot,0);w.chips+=t;S.msg=w.name+' が '+t+' を獲得(他全員フォールド)';S.win=[{n:w.name,v:t}];S.hn={};if(!S.mp||t>S.mp.v)S.mp={v:t,n:w.name,h:S.hand};S.phase='show';S.reveal=0;sched();return}
const ca=live.filter(p=>!p.allin);
if(!ca.every(p=>p.bet>=S.cur&&(p.acted||ca.length==1))){S.turn=nx(S.turn,p=>!p.folded&&!p.allin);aw();return}
P.forEach(p=>{p.bet=0;p.acted=0});S.cur=0;S.min=S.bb;
for(;;){if(S.street==3){showdown();return}
S.street++;for(let i=0;i<(S.street==1?3:1);i++)S.board.push(S.deck.pop());
if(ca.length>1){S.turn=nx(S.dealer,p=>!p.folded&&!p.allin);aw();return}}}

function showdown(){const P=S.players;P.forEach(p=>{p.sc=p.folded?0:best(p.hole.concat(S.board))});
let prev=0;const res={};
[...new Set(P.filter(p=>p.tot>0).map(p=>p.tot))].sort((a,b)=>a-b).forEach(l=>{
const amt=P.reduce((s,p)=>s+Math.min(p.tot,l)-Math.min(p.tot,prev),0);
let el=P.filter(p=>!p.folded&&p.tot>=l);if(!el.length)el=P.filter(p=>p.tot>=l);
const m=Math.max(...el.map(p=>p.sc)),w=el.filter(p=>p.sc==m),sh=Math.floor(amt/w.length);
w.forEach(p=>{p.chips+=sh;res[p.name]=(res[p.name]||0)+sh});w[0].chips+=amt-sh*w.length;prev=l});
S.reveal=1;S.phase='show';
S.msg=Object.entries(res).map(([n,v])=>n+' +'+v).join(' / ')+'  ('+P.filter(p=>!p.folded).map(p=>p.name+':'+HN[p.sc/759375|0]).join(', ')+')';S.win=Object.entries(res).map(([n,v])=>({n,v}));S.hn={};P.filter(p=>!p.folded).forEach(p=>S.hn[p.name]=HN[p.sc/759375|0]);{const tp=P.reduce((s,p)=>s+p.tot,0);if(!S.mp||tp>S.mp.v)S.mp={v:tp,n:S.win.map(w=>w.n).join('・'),h:S.hand}}sched(P.filter(p=>!p.folded).length>1&&P.some(p=>!p.folded&&p.allin)?13000:0)}

function act(i,t,a){const p=S.players[i],need=S.cur-p.bet;let tx='フォールド';
if(t=='f')p.folded=1;
else{let x;if(t=='c'){x=Math.min(need,p.chips);tx=need>0?'コール '+x:'チェック'}
else{let to=Math.max(S.cur+S.min,Math.floor(a)||0);to=Math.min(to,p.bet+p.chips);x=to-p.bet;if(x<=0)return;
if(to>S.cur){if(to-S.cur>=S.min){S.min=to-S.cur;S.players.forEach(q=>{if(q!=p)q.acted=0})}S.cur=to}tx=(S.street?'ベット/レイズ ':'レイズ ')+to}
p.chips-=x;p.bet+=x;p.tot+=x;if(!p.chips){p.allin=1;tx+=' (ALL-IN)'}}
p.acted=1;S.log.push(p.name+': '+tx);S.log=S.log.slice(-8);adv();push()}


return{empty:()=>!Object.keys(conns).length,
join(id,n,ws){if(!hostId)hostId=id;conns[id]=ws;joins[id]=n;if(S.phase=='lobby')seat();else handleAway(id,0);push()},
leave(id,ws){if(conns[id]!==ws)return;delete conns[id];
if(S.phase=='lobby'){S.players=S.players.filter(p=>p.id!=id);delete joins[id];if(hostId==id)hostId=Object.keys(conns)[0]||''}else handleAway(id,1);push()},
msg(id,m){if(m.k=='act'&&['f','c','r'].includes(m.t)&&Number.isFinite(+m.a))handleAct(id,m.t,+m.a);
else if(m.k=='away')handleAway(id,m.v);
else if(id==hostId&&m.k=='start'&&S.phase=='lobby'&&S.players.length>1)start();
else if(m.k=='re')reentry(id);
else if(id==hostId&&m.k=='reset')reset()}}}
const rooms={};
const srv=http.createServer((q,r)=>fs.readFile(path.join(__dirname,'index.html'),(e,d)=>{r.writeHead(e?500:200,{'content-type':'text/html; charset=utf-8'});r.end(e?'error':d)}));
const wss=new WebSocketServer({server:srv});
wss.on('connection',(ws,req)=>{const u=new URL(req.url,'http://x'),q=k=>u.searchParams.get(k)||'',
code=q('room').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8),id=q('id').replace(/[^\w-]/g,'').slice(0,24),name=q('name').slice(0,12)||'player';
let R=rooms[code];
if(!R){if(q('create')&&code)R=rooms[code]=makeRoom();else{ws.send(JSON.stringify({k:'err',m:'ルームが見つかりません'}));return ws.close()}}
if(!id)return ws.close();
R.join(id,name,ws);
ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch(e){return}R.msg(id,m)});
ws.on('close',()=>{R.leave(id,ws);if(R.empty())setTimeout(()=>{if(R.empty()&&rooms[code]===R)delete rooms[code]},600000)})});
srv.listen(process.env.PORT||3000);

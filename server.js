#!/usr/bin/env node
// CodexBD - single-file full-stack app (Gemini API backend + sci-fi frontend). Developer: Khokon Talukder
// Run:  GEMINI_API_KEY=your_key node server.js
// Optional env: PORT=3000  MODEL=gemini-2.5-flash  ACCESS_CODE=secret

const http = require('http');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const PORT = process.env.PORT || 3000;
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.MODEL || 'gemini-2.5-flash';
const CODE = process.env.ACCESS_CODE || '';

if (!KEY) {
  console.error('Missing GEMINI_API_KEY. Example: GEMINI_API_KEY=your_key node server.js');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: KEY });

const SYSTEM = "You are CodexBD, an AI assistant created by developer Khokon Talukder. Style: warm, natural, human-like conversation, short and clear. Always reply in the language the user writes or speaks (Bengali, Arabic, English, anything). Culture: respect Islamic values and etiquette. Answer a greeting with \"Assalamu Alaikum\" style warmth and use phrases like InshaAllah, Alhamdulillah or Jazakallah naturally, but sparingly. For religious rulings, share general knowledge and advise asking a qualified scholar. Never encourage haram or illegal acts. Never claim to be human if sincerely asked, and never claim abilities you lack (you cannot place real phone calls or make photorealistic images). Replies may be read aloud, so avoid markdown symbols and emojis outside code blocks.\nFILES: when asked for a file, put its full content in ONE fenced block whose first line is: lang filename=name.ext (prefer txt, md, csv, json, html, svg). CODE: always use fenced blocks with the language. IMAGE CREATION: when asked to draw or create an image, reply with one short sentence and a complete standalone SVG in a fenced block starting with \"svg filename=art.svg\" (viewBox set, no scripts, no external links).\nIMAGE ANALYSIS: if an image is attached, look at it and answer the request. Do not identify real people by face.";

const src = fs.readFileSync(__filename, 'utf8');
const A = '/*HTML' + '_START\n';
const B = '\nHTML_' + 'END*/';
const HTML = src.slice(src.indexOf(A) + A.length, src.lastIndexOf(B));

const hits = new Map();
function limited(ip) {
  const n = Date.now();
  const a = (hits.get(ip) || []).filter(t => n - t < 60000);
  a.push(n);
  hits.set(ip, a);
  return a.length > 20;
}

const json = (res, c, o) => {
  res.writeHead(c, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(o));
};

async function chat(req, res) {
  if (CODE && req.headers['x-access-code'] !== CODE) return json(res, 401, { error: 'Access code required' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip)) return json(res, 429, { error: 'Too many requests. Please wait a minute.' });
  
  let raw = '';
  for await (const c of req) {
    raw += c;
    if (raw.length > 8e6) return json(res, 413, { error: 'Request too large' });
  }
  
  let b;
  try { b = JSON.parse(raw); } catch { return json(res, 400, { error: 'Bad request' }); }
  
  const msgs = (Array.isArray(b.messages) ? b.messages : []).slice(-20)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content);

  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json(res, 400, { error: 'No message' });

  // Convert chat history to Gemini format
  const contents = msgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content.slice(0, 50000) }]
  }));

  // Attach image if present to the last message
  if (b.image && /^image\/(jpeg|png|webp|gif)$/.test(b.image.media_type) && typeof b.image.data === 'string') {
    const lastMsg = contents[contents.length - 1];
    lastMsg.parts.push({
      inlineData: {
        mimeType: b.image.media_type,
        data: b.image.data
      }
    });
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: MODEL,
      contents: contents,
      config: {
        systemInstruction: SYSTEM
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }
  } catch (err) {
    console.error('Gemini API Error:', err);
    res.write('\n[Error from Gemini API]');
  }
  res.end();
}

http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  if (req.method === 'GET' && p === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'microphone=(self), camera=(self)' });
    return res.end(HTML);
  }
  if (req.method === 'POST' && p === '/api/chat') {
    return chat(req, res).catch(e => {
      console.error(e);
      if (!res.headersSent) json(res, 500, { error: 'Server error' });
      else res.end();
    });
  }
  res.writeHead(404);
  res.end('Not found');
}).listen(PORT, () => console.log('CodexBD running at http://localhost:' + PORT));

/*HTML_START
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CodexBD</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#000;--panel:rgba(2,10,16,.88);--line:#14d6f5;--line2:#0b5566;--text:#d6f3ff;--muted:#6aa5b8;--gold:#ffc24a;--warn:#ff4d6d;--bot:rgba(8,34,49,.85);--user:rgba(40,30,8,.85);--glow:0 0 12px rgba(20,214,245,.5);
--fd:Orbitron,"Segoe UI",system-ui,sans-serif;--fb:Rajdhani,"Noto Sans Bengali","Noto Sans Arabic",system-ui,sans-serif;
box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:dark}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--text);font-family:var(--fb);font-size:17px;font-weight:500;display:flex;flex-direction:column;overflow:hidden}
#bg{position:fixed;inset:0;width:100%;height:100%;z-index:0}
.app{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;gap:8px;padding:10px;max-width:820px;width:100%;margin:0 auto;box-sizing:border-box;min-height:0}
.cut{--c:16px;background:var(--line);padding:1px;clip-path:polygon(var(--c) 0,calc(100% - var(--c)) 0,100% var(--c),100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,var(--c) 100%,0 calc(100% - var(--c)),0 var(--c));filter:drop-shadow(var(--glow))}
.cut>.in{background:var(--panel);clip-path:inherit;height:100%;box-sizing:border-box;backdrop-filter:blur(3px)}
.top{flex:none}.top .in{display:flex;align-items:center;gap:10px;padding:9px 20px}
.orb{width:36px;height:36px;border-radius:50%;flex:none;border:2px solid var(--line);box-shadow:var(--glow),inset 0 0 10px var(--line);position:relative}
.orb::after{content:"";position:absolute;inset:8px;border-radius:50%;background:var(--line);opacity:.75}
.orb.listening{animation:pulse .9s infinite;border-color:var(--warn);box-shadow:0 0 14px var(--warn),inset 0 0 10px var(--warn)}.orb.listening::after{background:var(--warn)}
.orb.thinking{animation:spin 1.2s linear infinite;border-style:dashed}
.orb.speaking{animation:pulse .5s infinite;border-color:var(--gold)}.orb.speaking::after{background:var(--gold)}
@keyframes pulse{50%{transform:scale(1.18)}}@keyframes spin{to{transform:rotate(360deg)}}
.ttl{flex:1;min-width:0}
.ttl b{font-family:var(--fd);font-weight:900;letter-spacing:.16em;font-size:17px;color:var(--line);text-shadow:var(--glow)}.ttl b i{font-style:normal;color:var(--gold)}
.ttl small{display:block;color:var(--muted);font-size:11px;letter-spacing:.14em;font-family:var(--fd)}
.tg{background:none;border:1px solid var(--line2);color:var(--line);padding:6px 9px;font-family:var(--fd);font-size:10px;letter-spacing:.1em;cursor:pointer;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
.tg.off{color:var(--muted);text-decoration:line-through}.tg.call{color:#04120a;background:#37e08a;border-color:#37e08a}
select.tg{appearance:none;padding:6px 6px;background:#000}
.chat{flex:1;min-height:0}
#log{height:100%;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}
#log::-webkit-scrollbar{width:4px}#log::-webkit-scrollbar-thumb{background:var(--line2)}
.m{max-width:88%;padding:10px 15px;line-height:1.5;word-wrap:break-word;--c:12px}
.b{align-self:flex-start;background:var(--bot);border-left:2px solid var(--line);clip-path:polygon(0 0,calc(100% - var(--c)) 0,100% var(--c),100% 100%,var(--c) 100%,0 calc(100% - var(--c)))}
.u{align-self:flex-end;background:var(--user);border-right:2px solid var(--gold);clip-path:polygon(var(--c) 0,100% 0,100% calc(100% - var(--c)),calc(100% - var(--c)) 100%,0 100%,0 var(--c))}
.tag{display:block;font-family:var(--fd);font-size:9px;letter-spacing:.2em;color:var(--muted);margin-bottom:3px}
.tx{white-space:pre-wrap}.err{color:var(--warn)}
.m img.pic{max-width:100%;max-height:220px;display:block;margin:6px 0;border:1px solid var(--line2)}
.code{margin:8px 0;border:1px solid var(--line2);background:rgba(0,0,0,.55)}
.code>div{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid var(--line2);font-family:var(--fd);font-size:10px;color:var(--gold);letter-spacing:.1em}
.code button{background:var(--line);color:#001018;border:0;font-family:var(--fd);font-size:10px;padding:3px 9px;cursor:pointer}
.code pre{margin:0;padding:8px;overflow-x:auto;max-height:260px;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#b8ecff}
.tools{flex:none;display:flex;gap:6px}.tools button{flex:1;padding:8px 2px;font-family:var(--fd);font-size:9px;letter-spacing:.08em;color:var(--line);background:rgba(2,10,16,.88);border:1px solid var(--line2);cursor:pointer;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)}.tools button span{display:block;font-size:17px;margin-bottom:2px}.tools button.on{background:var(--warn);color:#fff}.hint{flex:none;text-align:center;font-size:12px;letter-spacing:.1em;color:var(--muted);min-height:14px}
#cam{display:none;flex:none;align-self:flex-end;width:120px}#cam video{width:100%;display:block;background:#000}
.chip{display:none;flex:none;align-items:center;gap:8px;font-size:13px;color:var(--gold)}.chip img{height:34px;border:1px solid var(--gold)}.chip b{cursor:pointer;color:var(--warn)}
.bar .in{display:flex;gap:6px;align-items:flex-end;padding:9px 16px}
#in{flex:1;min-width:0;resize:none;border:0;border-bottom:1px solid var(--line2);padding:8px 4px;font:inherit;font-size:17px;background:transparent;color:var(--text);max-height:110px;outline:none}
#in:focus{border-bottom-color:var(--line);box-shadow:0 1px 0 var(--line)}#in::placeholder{color:var(--muted)}
.btn{border:0;padding:0 13px;height:40px;font-family:var(--fd);font-weight:700;letter-spacing:.08em;font-size:11px;cursor:pointer;background:var(--line);color:#001018;clip-path:polygon(9px 0,100% 0,100% calc(100% - 9px),calc(100% - 9px) 100%,0 100%,0 9px);flex:none}
.btn.ic{background:transparent;color:var(--line);box-shadow:inset 0 0 0 1px var(--line);font-size:16px;padding:0 11px}
.btn.on{background:var(--warn);color:#fff;animation:pulse .9s infinite}.btn:disabled{opacity:.4;cursor:default}
.ov{position:fixed;inset:0;z-index:9;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
.ov.show{display:flex}
.card{max-width:640px;width:100%;max-height:100%;overflow:auto}.card .in{padding:20px 24px}
.card h2{font-family:var(--fd);color:var(--line);letter-spacing:.14em;font-size:18px;margin:0 0 4px}
.card h3{font-family:var(--fd);color:var(--gold);letter-spacing:.12em;font-size:12px;margin:16px 0 6px}
.card ul{margin:0;padding-left:18px;line-height:1.45}.card p{margin:4px 0}
.dev{border:1px solid var(--gold);padding:10px 14px;margin-top:6px}.dev b{font-family:var(--fd);color:var(--gold)}
#call .big{width:130px;height:130px;margin:0 auto 20px}#call .big::after{inset:30px}
#call{flex-direction:column;text-align:center;font-family:var(--fd);letter-spacing:.2em}
#call p{color:var(--muted);font-size:12px;min-height:16px;margin:6px 0 20px;font-family:var(--fb);letter-spacing:.06em;max-width:520px}
</style>
</head>
<body>
<canvas id="bg"></canvas>
<div class="app">
  <div class="cut top"><div class="in">
    <div class="orb" id="orb"></div>
    <div class="ttl"><b>CODEX<i>BD</i></b><small id="st">SYSTEM ONLINE</small></div>
    <select class="tg" id="lang" title="Voice language"><option value="bn-BD">BN</option><option value="en-US">EN</option><option value="ar-SA">AR</option><option value="ur-PK">UR</option><option value="hi-IN">HI</option><option value="tr-TR">TR</option><option value="id-ID">ID</option></select>
    <button class="tg" id="vtog">VOICE</button>
    <button class="tg call" id="callb">CALL</button>
    <button class="tg" id="aboutb">ABOUT</button>
  </div></div>
  <div class="cut chat"><div class="in"><div id="log"></div></div></div>
  <div class="hint" id="hint"></div>
  <div id="cam"><video id="vid" autoplay playsinline muted></video></div>
  <div class="chip" id="chip"><img id="chipimg" alt=""><span>IMAGE READY</span><b id="chipx">✕</b></div>
  <div class="tools"><button id="talk"><span>🎧</span>LIVE TALK</button><button id="gal"><span>🖼</span>GALLERY</button><button id="pho"><span>📷</span>PHOTO</button><button id="vidb"><span>🎥</span>VIDEO</button><button id="fil"><span>📁</span>FILE</button></div>
  <div class="cut bar"><div class="in">
    <button class="btn ic" id="mic" title="Speak">🎙</button>
    <textarea id="in" rows="1" placeholder="Type a command or speak..."></textarea>
    <button class="btn" id="send">SEND</button>
  </div></div>
  <input type="file" id="fg" accept="image/*" hidden><input type="file" id="fp" accept="image/*" capture="environment" hidden><input type="file" id="ff" hidden>
</div>

<div class="ov" id="call"><div class="orb big" id="corb"></div><div id="cst">CALL ACTIVE</div><p id="cph"></p><button class="btn" id="endb" style="background:var(--warn);color:#fff;height:44px;padding:0 26px">END CALL</button></div>

<div class="ov" id="about"><div class="cut card"><div class="in">
<h2>CODEXBD</h2><p style="color:var(--muted)">Your AI companion with an Islamic-friendly tone. Replies in any language you use.</p>
<h3>WHAT IT CAN DO</h3><ul>
<li>Chat naturally in any language, with a warm and respectful style.</li>
<li>Voice: tap the mic to speak, and hear answers read aloud (VOICE toggle).</li>
<li>CALL mode: hands-free voice conversation, with the camera optionally on.</li>
<li>Image analysis: attach a photo or turn on the camera, then ask about it.</li>
<li>Image creation: draws vector (SVG) artwork that you can save.</li>
<li>Files: any text-based file (code, CSV, JSON, HTML, SVG...) saved with the right extension.</li>
<li>Writes, explains and debugs code in most languages.</li></ul>
<h3>HOW TO USE</h3><ul>
<li>Choose the voice language at the top (BN, EN, AR...) before speaking.</li>
<li>Say what you want: "make a CSV of...", "draw a mosque at sunset", "what is in this photo?"</li>
<li>Press SAVE on any code or file block to download it.</li>
<li>Allow microphone and camera permission when your browser asks.</li></ul>
<h3>NOT ALLOWED</h3><ul>
<li>Hacking, malware, phishing, scams or fraud.</li>
<li>Violence, weapons, terrorism, or hatred toward any person or group.</li>
<li>Sexual content involving minors, or any explicit content.</li>
<li>Stalking, doxxing, identifying strangers from photos, or violating privacy.</li>
<li>Deepfakes, impersonation, fake documents or fake news.</li>
<li>Copyright infringement or defamation.</li></ul>
<h3>LEGAL NOTICE</h3>
<p>Using CodexBD for the above may break cyber-crime, data-protection, copyright, defamation and other laws in your country, including Bangladesh. You alone are responsible for how you use it. This is not legal advice.</p>
<h3>LIMITS</h3><ul>
<li>AI can make mistakes. Verify important facts.</li>
<li>For religious rulings (fatwa), ask a qualified scholar.</li>
<li>Not a doctor or lawyer. It cannot place real phone calls and does not create photorealistic images.</li>
<li>Voice quality depends on your device and browser.</li></ul>
<h3>DEVELOPER</h3><div class="dev"><b>Khokon Talukder</b><br>Creator &amp; Developer of CodexBD<br><a class="btn" href="https://www.facebook.com/Khokon.talukder.2026" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;margin-top:10px;text-decoration:none;box-sizing:border-box">CONTACT DEVELOPER</a></div>
<div style="text-align:center;margin-top:16px"><button class="btn" id="aboutx">CLOSE</button></div>
</div></div></div>

<script>
const $=id=>document.getElementById(id);
// ---------- animated black background ----------
(()=>{const c=$('bg'),x=c.getContext('2d');let w,h,P=[];
function rs(){w=c.width=innerWidth;h=c.height=innerHeight;P=Array.from({length:Math.min(70,w*h/16000|0)},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4}))}
addEventListener('resize',rs);rs();let t=0;
(function f(){t++;x.fillStyle='#000';x.fillRect(0,0,w,h);
x.strokeStyle='rgba(20,214,245,.05)';x.lineWidth=1;for(let i=0;i<w;i+=40){x.beginPath();x.moveTo(i,0);x.lineTo(i,h);x.stroke()}for(let j=0;j<h;j+=40){x.beginPath();x.moveTo(0,j);x.lineTo(w,j);x.stroke()}
const sy=(t*1.5)%h;const g=x.createLinearGradient(0,sy-60,0,sy);g.addColorStop(0,'rgba(20,214,245,0)');g.addColorStop(1,'rgba(20,214,245,.10)');x.fillStyle=g;x.fillRect(0,sy-60,w,60);
for(const p of P){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;x.fillStyle='rgba(255,194,74,.8)';x.fillRect(p.x,p.y,2,2)}
for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const d=Math.hypot(P[i].x-P[j].x,P[i].y-P[j].y);if(d<110){x.strokeStyle='rgba(20,214,245,'+(.28*(1-d/110))+')';x.beginPath();x.moveTo(P[i].x,P[i].y);x.lineTo(P[j].x,P[j].y);x.stroke()}}
requestAnimationFrame(f)})()})();

const log=$('log'),inp=$('in'),btn=$('send'),mic=$('mic'),orb=$('orb'),corb=$('corb'),st=$('st'),hint=$('hint'),lang=$('lang');
const history=[];let sample=null,downloads=null,busy=false,voiceOn=true,rec=null,listening=false,inCall=false,pendingImg=null,camStream=null;
function setState(s,t){orb.className='orb '+s;corb.className='orb big '+s;st.textContent=t;$('cst').textContent=inCall?t:'CALL ACTIVE'}
const EXT={javascript:'js',python:'py',html:'html',css:'css',json:'json',csv:'csv',markdown:'md',md:'md',svg:'svg',txt:'txt',text:'txt'};
const OK=['txt','json','md','csv','html','svg','png','jpg','pdf','xlsx','docx','pptx','zip'];
function codeBlock(el,p){const nl=p.indexOf('\n');const head=(nl<0?p:p.slice(0,nl)).trim(),body=nl<0?'':p.slice(nl+1).replace(/\n$/,'');
 const lg=(head.split(/\s+/)[0]||'txt').toLowerCase();let fn=(head.match(/filename=(\S+)/)||[])[1]||('codexbd-file.'+(EXT[lg]||'txt'));
 if(lg==='svg'&&body.includes('</svg>')){const im=new Image();im.className='pic';im.alt='Generated art';im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(body);el.appendChild(im)}
 const d=document.createElement('div');d.className='code';const hd=document.createElement('div');const nm=document.createElement('span');nm.textContent=fn;const b=document.createElement('button');b.textContent='SAVE';
 b.onclick=async()=>{if(!downloads){hint.textContent='Saving is not available in this view';return}let f=fn;
  try{await downloads.save({filename:f,data:body})}catch(e){hint.textContent=e&&e.code==='declined'?'Save cancelled':'Could not save file'}};
 hd.append(nm,b);const pre=document.createElement('pre');pre.textContent=body;d.append(hd,pre);el.appendChild(d)}
function render(el,text){el.textContent='';const tg=document.createElement('span');tg.className='tag';tg.textContent='CODEXBD';el.appendChild(tg);
 text.split('```').forEach((p,i)=>{if(i%2===0){if(p.trim()){const s=document.createElement('div');s.className='tx';s.textContent=p.trim();el.appendChild(s)}}else codeBlock(el,p)});log.scrollTop=log.scrollHeight}
function addUser(t,img){const d=document.createElement('div');d.className='m u';const g=document.createElement('span');g.className='tag';g.textContent='YOU';d.appendChild(g);
 if(img){const i=new Image();i.className='pic';i.src=URL.createObjectURL(img);d.appendChild(i)}const s=document.createElement('div');s.className='tx';s.textContent=t;d.appendChild(s);log.appendChild(d);log.scrollTop=log.scrollHeight}
function addBot(t){const d=document.createElement('div');d.className='m b';log.appendChild(d);render(d,t);return d}
addBot('Assalamu Alaikum! I am CodexBD. Speak or type, and tell me what you need.');
const lsGet=()=>{try{return localStorage.getItem('cbd_code')||''}catch(e){return ''}};
downloads={save:async({filename,data})=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data]));a.download=filename;document.body.appendChild(a);a.click();a.remove()}};
async function toB64(b){const bm=await createImageBitmap(b);const k=Math.min(1,1280/Math.max(bm.width,bm.height));const c=document.createElement('canvas');c.width=bm.width*k;c.height=bm.height*k;c.getContext('2d').drawImage(bm,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.8).split(',')[1]}
sample=async(input,opts)=>{
 const body={messages:input};if(opts.images&&opts.images[0])body.image={media_type:'image/jpeg',data:await toB64(opts.images[0])};
 const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json','x-access-code':lsGet()},body:JSON.stringify(body)});
 if(r.status===401){const c=prompt('Access code');if(c)try{localStorage.setItem('cbd_code',c)}catch(e){}throw new Error('Access code needed. Send your message again.')}
 if(!r.ok){let m='';try{m=(await r.json()).error}catch(e){}throw Object.assign(new Error(m||'Server error'),{code:r.status===429?'rate_limited':'err'})}
 const rd=r.body.getReader(),dc=new TextDecoder();let text='';
 for(;;){const{done,value}=await rd.read();if(done)break;text+=dc.decode(value,{stream:true});if(opts.onText)opts.onText({text})}
 return{text}};

// ---------- voice out ----------
const synth=window.speechSynthesis;
function speak(text){return new Promise(res=>{
 const clean=text.replace(/```[\s\S]*?```/g,' ').replace(/[*#_`>]/g,'').trim();
 if(!voiceOn&&!inCall||!synth||!clean){res();return}
 try{synth.cancel();const u=new SpeechSynthesisUtterance(clean);u.lang=lang.value;const v=synth.getVoices().find(x=>x.lang.toLowerCase().startsWith(lang.value.slice(0,2)));if(v)u.voice=v;
 u.onstart=()=>setState('speaking','SPEAKING');u.onend=u.onerror=()=>{setState('','SYSTEM ONLINE');res()};synth.speak(u)}catch(e){res()}})}
if(!synth)$('vtog').style.display='none';
$('vtog').onclick=()=>{voiceOn=!voiceOn;$('vtog').classList.toggle('off',!voiceOn);if(!voiceOn&&synth){synth.cancel();setState('','SYSTEM ONLINE')}};

// ---------- voice in ----------
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SR){mic.disabled=true;$('callb').disabled=true;hint.textContent='Voice input needs Chrome or Safari'}
function stopRec(){listening=false;mic.classList.remove('on');if(!busy&&!inCall)setState('','SYSTEM ONLINE')}
function listen(){if(!SR||listening)return;if(synth)synth.cancel();rec=new SR();rec.lang=lang.value;rec.interimResults=true;rec.continuous=false;let heard='';
 rec.onstart=()=>{listening=true;mic.classList.add('on');setState('listening','LISTENING');hint.textContent=''};
 rec.onresult=e=>{let t='';for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;heard=t;inp.value=t;if(inCall)$('cph').textContent=t};
 rec.onerror=e=>{const fatal=e.error==='not-allowed'||e.error==='service-not-allowed';listening=false;mic.classList.remove('on');hint.textContent=fatal?'Microphone is blocked here. Allow mic permission, or use Chrome.':(e.error==='no-speech'?'':'Voice error: '+e.error);if(inCall&&e.error!=='no-speech'&&e.error!=='aborted')endCall()};
 rec.onend=()=>{const had=listening;stopRec();if(inCall&&!busy){if(heard.trim())send();else setTimeout(listen,300)}else if(had&&heard.trim())send()};
 try{rec.start()}catch(e){stopRec()}}
mic.onclick=()=>{if(listening){try{rec.stop()}catch(e){}}else listen()};

// ---------- camera / image ----------
function setImg(b){pendingImg=b;$('chip').style.display=b?'flex':'none';if(b)$('chipimg').src=URL.createObjectURL(b)}
$('gal').onclick=()=>$('fg').click();$('pho').onclick=()=>$('fp').click();$('fil').onclick=()=>$('ff').click();$('talk').onclick=()=>$('callb').click();
for(const id of ['fg','fp'])$(id).onchange=e=>{const f=e.target.files[0];if(f){setImg(f);hint.textContent='Image ready. Type your question and press SEND'}e.target.value=''};
$('ff').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.type.startsWith('image/')){setImg(f);return}
 if(f.size>200000){hint.textContent='File too large (max about 200 KB)';return}
 try{const t=await f.text();if(t.slice(0,2000).includes('\u0000'))throw 0;inp.value=(inp.value?inp.value+'\n\n':'')+'File: '+f.name+'\n```\n'+t+'\n```';hint.textContent='File loaded. Add your question and press SEND'}catch(_){hint.textContent='Only text-based files (txt, csv, json, code) can be read'}};
$('chipx').onclick=()=>setImg(null);
async function toggleCam(){if(camStream){camStream.getTracks().forEach(t=>t.stop());camStream=null;$('cam').style.display='none';$('vidb').classList.remove('on');return}
 try{camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});$('vid').srcObject=camStream;$('cam').style.display='block';$('vidb').classList.add('on')}
 catch(e){hint.textContent='Live video is blocked here ('+((e&&e.name)||'error')+'). Use the PHOTO button instead.'}}
$('vidb').onclick=toggleCam;
function frame(){return new Promise(r=>{const v=$('vid');if(!camStream||!v.videoWidth)return r(null);const c=document.createElement('canvas');const k=Math.min(1,640/v.videoWidth);c.width=v.videoWidth*k;c.height=v.videoHeight*k;c.getContext('2d').drawImage(v,0,0,c.width,c.height);c.toBlob(b=>r(b),'image/jpeg',.7)})}

// ---------- chat ----------
async function send(){
 const t=inp.value.trim();if(!t||busy||!sample)return;
 inp.value='';busy=true;btn.disabled=true;setState('thinking','PROCESSING');
 let img=pendingImg;setImg(null);if(!img)img=await frame();
 addUser(t,img);history.push({role:'user',content:t});const out=addBot('...');
 const input=history;
 const opts={cache:false,onText:({text})=>render(out,text)};
 if(img)opts.images=[img];
 let reply='';
 try{const r=await sample(input,opts);reply=r.text;render(out,reply);history.push({role:'assistant',content:reply});setState('','SYSTEM ONLINE')}
 catch(e){history.pop();out.textContent='';out.classList.add('err');out.textContent=e&&e.code==='rate_limited'?'System busy. Please try again shortly.':(e&&e.message)||'Could not get a reply. Please try again.';setState('','ERROR')}
 busy=false;btn.disabled=false;
 if(reply)await speak(reply);
 if(inCall)listen();
}
btn.onclick=send;
inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});

// ---------- call mode ----------
$('callb').onclick=()=>{inCall=true;$('call').classList.add('show');$('cph').textContent='';listen()};
function endCall(){inCall=false;$('call').classList.remove('show');if(synth)synth.cancel();try{rec&&rec.stop()}catch(e){}setState('','SYSTEM ONLINE')}
$('endb').onclick=endCall;
$('aboutb').onclick=()=>$('about').classList.show?$('about').classList.remove('show'):$('about').classList.add('show');
$('aboutx').onclick=()=>$('about').classList.remove('show');
</script>
</body>
</html>
HTML_END*/

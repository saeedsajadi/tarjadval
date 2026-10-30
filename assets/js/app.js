const $=s=>document.getElementById(s);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const norm=s=>String(s).trim().replace(/\s+/g,' ');
let headers=[],rows=[],transData=null,busy=false;
let colKw=['برو جلو'],rowKw=['برو پایین'];
let syncingFromText=false,syncingFromTable=false;
const ta=$('ta');

/* ---------- Settings storage ---------- */
const KEY='tablesync.settings.v1';
let S={apiUrl:'https://openrouter.ai/api/v1/chat/completions',token:'',model:'',lang:'English',note:''};
try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o){
  if(Array.isArray(o.colKw))colKw=o.colKw.filter(x=>typeof x==='string');
  if(Array.isArray(o.rowKw))rowKw=o.rowKw.filter(x=>typeof x==='string');
  ['apiUrl','token','model','lang','note'].forEach(k=>{if(typeof o[k]==='string')S[k]=o[k]});
}}catch(e){}
function saveSettings(){try{localStorage.setItem(KEY,JSON.stringify({colKw,rowKw,...S}))}catch(e){}}

/* ---------- UI helpers ---------- */
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2000)}
function autosize(){ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,Math.max(80,Math.round(innerHeight*0.28)))+'px'}
let pending=null;
function ask(msg,fn){pending=fn;$('dmsg').textContent=msg;$('ov').classList.add('show');$('no').focus()}
function closeAsk(){pending=null;$('ov').classList.remove('show')}
$('no').onclick=closeAsk;
$('yes').onclick=()=>{const f=pending;closeAsk();if(f)f()};
function openSheet(id){$(id).classList.add('show')}
function closeSheets(){document.querySelectorAll('.sheet').forEach(s=>s.classList.remove('show'))}
$('setBtn').onclick=()=>openSheet('shSet');
$('glBtn').onclick=()=>{renderGloss();openSheet('shGl')};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeSheets);
document.querySelectorAll('.sheet,.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o){closeSheets();closeAsk();closeAdd()}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSheets();closeAsk();closeAdd()}});

/* ---------- Keywords -> regex ---------- */
function rx(list){
  const parts=list.slice().sort((a,b)=>b.length-a.length).map(k=>k.split(/\s+/).map(w=>w.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&')).join('\\s+'));
  return parts.length?new RegExp(parts.join('|'),'g'):null;
}
function parseText(t){
  const cRe=rx(colKw),rRe=rx(rowKw),out=[];
  t.split(/\r\n|\r|\n/).forEach(line=>{
    (rRe?line.split(rRe):[line]).forEach(seg=>{
      const cells=(cRe?seg.split(cRe):[seg]).map(s=>s.trim());
      if(cells.length===1&&cells[0]==='')return;
      out.push(cells);
    });
  });
  const w=Math.max(0,...out.map(r=>r.length));
  out.forEach(r=>{while(r.length<w)r.push('')});
  headers=out.length?out.shift():[];
  rows=out;
}
function toText(){
  if(!headers.length)return '';
  const sep=colKw.length?' '+colKw[0]+' ':' ';
  return [headers,...rows].map(r=>r.join(sep)).join('\n');
}
function mdOf(h,r){
  if(!h.length)return '';
  const c=s=>String(s).replace(/\|/g,'\\|');
  const line=a=>'| '+a.map(c).join(' | ')+' |';
  return [line(h),'|'+h.map(()=>'---').join('|')+'|',...r.map(line)].join('\n');
}
function syncTextFromTable(){
  if(syncingFromText)return;
  syncingFromTable=true;
  const t=toText();
  if(ta.value!==t){ta.value=t;autosize();updPrev()}
  syncingFromTable=false;
}
function syncTableFromText(){
  if(syncingFromTable)return;
  syncingFromText=true;
  parseText(ta.value);
  render();
  syncingFromText=false;
}
ta.addEventListener('input',()=>{autosize();if(!syncingFromTable)syncTableFromText()});

/* ---------- Table render ---------- */
function render(newRow){
  const area=$('tableArea');
  $('dims').textContent=headers.length?(rows.length+' ردیف داده × '+headers.length+' ستون'):'';
  if(!headers.length){
    area.innerHTML='<div class="empty">جدول خالی است.<br>در کادر پایین بنویسید، یا «＋ ستون» / «＋ ردیف» را بزنید.<br><button class="act" id="exBtn" style="margin-top:10px">درج نمونه</button></div>';
    return;
  }
  let h='<div class="tw"><table><thead><tr class="dels"><th class="ctl"></th>';
  headers.forEach((_,c)=>h+=`<th><button class="x" data-dc="${c}" title="حذف ستون ${c+1}" aria-label="حذف ستون ${c+1}">×</button></th>`);
  h+='</tr><tr class="hrow"><th class="ctl">هدر</th>';
  headers.forEach((v,c)=>h+=`<th><input data-r="-1" data-c="${c}" value="${esc(v)}" aria-label="سرستون ${c+1}" placeholder="سرستون"></th>`);
  h+='</tr></thead><tbody>';
  rows.forEach((r,i)=>{
    h+=`<tr class="${newRow===i?'new':''}"><td class="ctl"><button class="x" data-dr="${i}" title="حذف ردیف ${i+1}" aria-label="حذف ردیف ${i+1}">×</button></td>`;
    r.forEach((v,c)=>h+=`<td><input data-r="${i}" data-c="${c}" value="${esc(v)}" aria-label="ردیف ${i+1} ستون ${c+1}"></td>`);
    h+='</tr>';
  });
  area.innerHTML=h+'</tbody></table></div>';
}
$('tableArea').addEventListener('input',e=>{
  const i=e.target;if(i.tagName!=='INPUT')return;
  const r=+i.dataset.r,c=+i.dataset.c;
  if(r<0)headers[c]=i.value;else rows[r][c]=i.value;
  syncTextFromTable();
});
$('tableArea').addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.target.tagName!=='INPUT')return;
  e.preventDefault();
  const all=[...$('tableArea').querySelectorAll('input')],n=all[all.indexOf(e.target)+1];
  if(n){n.focus();n.select()}
});
$('tableArea').addEventListener('click',e=>{
  if(e.target.id==='exBtn'){
    const c=' '+(colKw[0]||'|')+' ',r=rowKw[0]?' '+rowKw[0]+' ':'\n';
    ta.value=['نام','سن','شهر'].join(c)+r+['علی','۳۰','تهران'].join(c)+r+['سارا','۲۵','شیراز'].join(c);
    autosize();updPrev();syncTableFromText();return;
  }
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.dr!==undefined){
    const i=+b.dataset.dr;
    ask('ردیف '+(i+1)+' حذف شود؟',()=>{rows.splice(i,1);render();syncTextFromTable()});
  }else if(b.dataset.dc!==undefined){
    const c=+b.dataset.dc,last=headers.length<=1;
    ask(last?'این تنها ستون است؛ با حذف آن کل جدول پاک می‌شود. ادامه می‌دهید؟':'ستون «'+(headers[c]||c+1)+'» حذف شود؟',()=>{
      if(last){headers=[];rows=[]}else{headers.splice(c,1);rows.forEach(r=>r.splice(c,1))}
      render();syncTextFromTable();
    });
  }
});
$('addRow').onclick=()=>{
  if(!headers.length)headers=['ستون 1'];
  rows.push(headers.map(()=>''));
  render(rows.length-1);syncTextFromTable();
  const el=document.querySelector(`#tableArea input[data-r="${rows.length-1}"][data-c="0"]`);
  if(el){el.focus();el.scrollIntoView({block:'nearest'})}
};
$('addCol').onclick=()=>{headers.push('ستون '+(headers.length+1));rows.forEach(r=>r.push(''));render();syncTextFromTable()};
$('clear').onclick=()=>{if(headers.length||ta.value)ask('کل جدول پاک شود؟ این کار قابل بازگشت نیست.',()=>{headers=[];rows=[];render();syncTextFromTable()})};

/* ---------- ChipBox ---------- */
function chipBox(el,id,getL,setL,label){
  function draw(){
    const v=el.querySelector('input')?el.querySelector('input').value:'';
    el.innerHTML=getL().map((k,i)=>`<span class="chip">${esc(k)}<button data-i="${i}" title="حذف «${esc(k)}»" aria-label="حذف ${esc(k)}">×</button></span>`).join('')+`<input id="${id}" aria-label="${label}" placeholder="کلمه جدید…" value="${esc(v)}">`;
  }
  function add(raw){const k=raw.trim().replace(/\s+/g,' ');if(!k||getL().includes(k))return false;setL([...getL(),k]);return true}
  function commit(inp){
    let ch=false;inp.value.split(/[,،]/).forEach(p=>{if(add(p))ch=true});
    inp.value='';if(ch){draw();changed()}return ch;
  }
  el.addEventListener('click',e=>{
    const b=e.target.closest('button');
    if(b){const l=getL().slice();l.splice(+b.dataset.i,1);setL(l);draw();changed()}
    el.querySelector('input').focus();
  });
  el.addEventListener('keydown',e=>{
    const inp=e.target;if(inp.tagName!=='INPUT')return;
    if(e.key==='Enter'||e.key===','||e.key==='،'){e.preventDefault();commit(inp);el.querySelector('input').focus()}
    else if(e.key==='Backspace'&&inp.value===''&&getL().length){setL(getL().slice(0,-1));draw();changed();el.querySelector('input').focus()}
  });
  el.addEventListener('focusout',e=>{if(e.target.tagName==='INPUT'&&e.target.value.trim())commit(e.target)});
  draw();
}
function changed(){
  saveSettings();
  $('kwHint').innerHTML='ستون: <b>'+(colKw.map(esc).join('، ')||'—')+'</b> | ردیف: <b>'+(rowKw.map(esc).join('، ')||'—')+'</b> | و Enter';
  syncTableFromText();
}
chipBox($('colBox'),'colIn',()=>colKw,l=>colKw=l,'کلمه کلیدی ستون');
chipBox($('rowBox'),'rowIn',()=>rowKw,l=>rowKw=l,'کلمه کلیدی ردیف');

[['apiUrl','apiUrl'],['apiToken','token'],['apiModel','model'],['apiLang','lang'],['note','note']].forEach(([id,k])=>{
  const el=$(id);el.value=S[k];
  el.addEventListener('input',()=>{S[k]=k==='note'?el.value:el.value.trim();saveSettings()});
});
$('tokShow').onclick=()=>{const t=$('apiToken');t.type=t.type==='password'?'text':'password'};

/* ---------- Copy helpers ---------- */
function tableHtml(h,r,dir){
  const c='border:1px solid #777;padding:6px 10px;';
  return `<table dir="${dir}" border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;border:1px solid #777"><thead><tr>${h.map(x=>`<th style="${c}background:#e8e8e8;text-align:start">${esc(x)}</th>`).join('')}</tr></thead><tbody>${r.map(row=>`<tr>${row.map(x=>`<td style="${c}">${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
async function copyTable(h,r,dir){
  if(!h.length){toast('جدولی برای کپی نیست');return}
  const html=tableHtml(h,r,dir),plain=[h,...r].map(x=>x.join('\t')).join('\n');
  try{
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);
    toast('جدول کپی شد ✓');return;
  }catch(_){}
  const d=document.createElement('div');d.innerHTML=html;d.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(d);
  const s=getSelection(),rg=document.createRange();rg.selectNodeContents(d);s.removeAllRanges();s.addRange(rg);
  let ok=false;try{ok=document.execCommand('copy')}catch(e){}
  s.removeAllRanges();d.remove();toast(ok?'جدول کپی شد ✓':'کپی ناموفق بود');
}
async function copyText(t){
  if(!t){toast('چیزی برای کپی نیست');return}
  try{await navigator.clipboard.writeText(t);toast('کپی شد ✓');return}catch(_){}
  const x=document.createElement('textarea');x.value=t;document.body.appendChild(x);x.select();
  let ok=false;try{ok=document.execCommand('copy')}catch(e){}
  x.remove();toast(ok?'کپی شد ✓':'کپی ناموفق بود');
}
const tH=()=>transData.headers.map(c=>c.t),tR=()=>transData.rows.map(r=>r.map(c=>c.t));
$('copyOrig').onclick=()=>copyTable(headers,rows,'rtl');
$('copyOrigMd').onclick=()=>copyText(mdOf(headers,rows));
$('copyTrans').onclick=()=>{if(transData)copyTable(tH(),tR(),'auto')};
$('copyTransMd').onclick=()=>{if(transData)copyText(mdOf(tH(),tR()))};

/* ---------- Glossary ---------- */
const GKEY='tablesync.glossary.v1';
let gloss=[];
try{const g=JSON.parse(localStorage.getItem(GKEY)||'[]');if(Array.isArray(g))gloss=g.filter(x=>x&&typeof x.fa==='string'&&typeof x.en==='string')}catch(e){}
const saveGloss=()=>{try{localStorage.setItem(GKEY,JSON.stringify(gloss))}catch(e){}};
const activeGloss=()=>gloss.filter(g=>norm(g.fa)&&norm(g.en)).map(g=>({fa:norm(g.fa),en:norm(g.en)}));
function upsertGloss(fa,en,quiet){
  fa=norm(fa);en=norm(en);if(!fa||!en)return false;
  const i=gloss.findIndex(x=>norm(x.fa)===fa);
  if(i>=0)gloss[i]={fa,en};else gloss.push({fa,en});
  if(!quiet){saveGloss();renderGloss()}
  return true;
}
function renderGloss(){
  const q=$('glSearch').value.trim().toLowerCase();let h='';
  gloss.forEach((g,i)=>{
    if(q&&!(g.fa.toLowerCase().includes(q)||g.en.toLowerCase().includes(q)))return;
    h+=`<div class="glrow"><input class="fi fa" data-i="${i}" data-k="fa" value="${esc(g.fa)}" aria-label="فارسی" placeholder="فارسی"><input class="fi" data-i="${i}" data-k="en" value="${esc(g.en)}" aria-label="English" placeholder="English"><button class="x" data-gd="${i}" title="حذف" aria-label="حذف">×</button></div>`;
  });
  $('glList').innerHTML=h||'<div class="empty">'+(gloss.length?'نتیجه‌ای یافت نشد.':'واژه‌نامه خالی است.')+'</div>';
  $('glCount').textContent=activeGloss().length+' مورد';
}
$('glList').addEventListener('input',e=>{const i=e.target;if(i.dataset.i===undefined)return;gloss[+i.dataset.i][i.dataset.k]=i.value;saveGloss();$('glCount').textContent=activeGloss().length+' مورد'});
$('glList').addEventListener('click',e=>{
  const b=e.target.closest('button[data-gd]');if(!b)return;const i=+b.dataset.gd;
  ask('«'+(gloss[i].fa||'مورد خالی')+'» از واژه‌نامه حذف شود؟',()=>{gloss.splice(i,1);saveGloss();renderGloss()});
});
$('glSearch').addEventListener('input',renderGloss);
$('glAdd').onclick=()=>{$('glSearch').value='';gloss.unshift({fa:'',en:''});renderGloss();const f=$('glList').querySelector('input');if(f)f.focus()};
function parseCSV(t){
  t=t.replace(/^\uFEFF/,'');
  const first=t.split(/\r?\n/)[0]||'';
  const d=[',',';','\t'].map(x=>[x,first.split(x).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const out=[];let row=[],cur='',q=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;
    else if(c===d){row.push(cur);cur=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cur);out.push(row);row=[];cur=''}
    else cur+=c;
  }
  if(cur!==''||row.length){row.push(cur);out.push(row)}
  return out;
}
function csvOf(){
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  return ['فارسی,English',...activeGloss().map(g=>q(g.fa)+','+q(g.en))].join('\n');
}
$('glImp').onclick=()=>$('glFile').click();
$('glFile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const rws=parseCSV(await f.text());
    if(rws.length&&/^(fa|farsi|persian|فارسی)$/i.test(norm(rws[0][0]||'')))rws.shift();
    let n=0;rws.forEach(r=>{if(r.length>=2&&upsertGloss(r[0],r[1],true))n++});
    saveGloss();renderGloss();toast(n+' مورد وارد شد ✓');
  }catch(err){toast('خواندن فایل ناموفق بود')}
  e.target.value='';
};
$('glExp').onclick=()=>{
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+csvOf()],{type:'text/csv;charset=utf-8'}));
  a.download='glossary.csv';document.body.appendChild(a);a.click();a.remove();toast('فایل CSV آماده شد');
};
$('glCopy').onclick=()=>copyText(csvOf());

/* ---------- Translation ---------- */
const cellAt=(r,c)=>r<0?transData.headers[c]:transData.rows[r][c];
function cellHtml(c,r,j,tag){
  const has=norm(c.t)||norm(c.src);
  const cls=!has?'':(c.g?'cg':'co');
  const tip=cls==='cg'?'از واژه‌نامه':cls==='co'?'خارج از واژه‌نامه':'';
  const add=(cls==='co'&&norm(c.t))?`<button class="ad" data-r="${r}" data-c="${j}" title="افزودن به واژه‌نامه" aria-label="افزودن به واژه‌نامه">＋</button>`:'';
  const ok=cls==='cg'?'<span class="gk" title="از واژه‌نامه">✓</span>':'';
  return `<${tag} class="tc ${cls}" title="${tip}"><div class="cw"><input dir="auto" data-r="${r}" data-c="${j}" value="${esc(c.t)}" aria-label="ترجمه">${ok}${add}</div></${tag}>`;
}
function renderTrans(){
  const t=transData;if(!t)return;
  $('transArea').innerHTML='<div class="legend"><span><i class="sw" style="background:#16a34a"></i>از واژه‌نامه ✓</span><span><i class="sw" style="background:#f59e0b"></i>خارج از واژه‌نامه (برای افزودن ＋ را بزنید)</span></div><div class="tw"><table dir="auto"><thead><tr class="hrow">'+t.headers.map((c,j)=>cellHtml(c,-1,j,'th')).join('')+'</tr></thead><tbody>'+t.rows.map((r,i)=>'<tr>'+r.map((c,j)=>cellHtml(c,i,j,'td')).join('')+'</tr>').join('')+'</tbody></table></div>';
  $('copyTrans').disabled=false;$('copyTransMd').disabled=false;
}
$('transArea').addEventListener('input',e=>{const i=e.target;if(i.tagName!=='INPUT'||!transData)return;cellAt(+i.dataset.r,+i.dataset.c).t=i.value});
let addTarget=null;
$('transArea').addEventListener('click',e=>{
  const b=e.target.closest('button.ad');if(!b||!transData)return;
  addTarget={r:+b.dataset.r,c:+b.dataset.c};
  const c=cellAt(addTarget.r,addTarget.c);
  $('adFa').value=norm(c.src);$('adEn').value=norm(c.t);
  $('ov2').classList.add('show');$('adEn').focus();
});
function closeAdd(){addTarget=null;$('ov2').classList.remove('show')}
$('adCancel').onclick=closeAdd;
$('adSave').onclick=()=>{
  const fa=norm($('adFa').value),en=norm($('adEn').value);
  if(!fa||!en){toast('هر دو فیلد را پر کنید');return}
  upsertGloss(fa,en);
  if(transData&&addTarget){
    const mark=c=>{c.t=en;c.g=true};
    [...transData.headers,...transData.rows.flat()].forEach(c=>{if(norm(c.src)===fa)mark(c)});
    mark(cellAt(addTarget.r,addTarget.c));
    renderTrans();
  }
  closeAdd();toast('به واژه‌نامه اضافه شد ✓');
};
function buildPrompt(lang,note){
  let p=`You are a professional translator. The user sends a JSON object with "glossary" (a list of {fa,en} pairs) and "table" (an array of rows; each row is an array of source cell strings; the first row is the header). Translate every cell into ${lang||'English'}. Whenever a cell is exactly, or contains, a glossary "fa" term, you MUST use the glossary's exact "en" equivalent for that term and set "g" to true for that cell. If no glossary term was used in a cell, set "g" to false. Respond with ONLY a JSON array of arrays with exactly the same dimensions as "table", where every element is an object {"t": "translated text", "g": true or false}. Empty cells become {"t":"","g":false}. Keep numbers, URLs and code unchanged. No explanation, no code fences, no extra text.`;
  if(norm(note))p+=`\n\nAdditional instructions from the user (follow them, but never break the required JSON output format and never ignore the glossary):\n${note.trim()}`;
  return p;
}
$('transBtn').onclick=async()=>{
  if(busy)return;
  if(!headers.length){toast('جدول خالی است');return}
  if(!S.apiUrl||!S.token||!S.model){toast('ابتدا تنظیمات هوش مصنوعی را کامل کنید');openSheet('shSet');return}
  const srcRows=[headers,...rows].map(r=>r.slice());
  const ns=srcRows.flat().map(norm);
  const gl=activeGloss().filter(g=>ns.some(t=>t.includes(g.fa)));
  busy=true;const btn=$('transBtn');btn.disabled=true;btn.textContent='در حال ترجمه…';
  $('transArea').innerHTML='<div class="empty" style="margin-top:12px">در حال دریافت ترجمه از مدل…</div>';
  try{
    const res=await fetch(S.apiUrl,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+S.token},body:JSON.stringify({model:S.model,temperature:0,messages:[{role:'system',content:buildPrompt(S.lang,S.note)},{role:'user',content:JSON.stringify({glossary:gl,table:srcRows})}]})});
    const raw=await res.text();let data=null;try{data=JSON.parse(raw)}catch(_){}
    if(!res.ok){const m=data&&data.error;throw new Error((typeof m==='string'?m:m&&m.message)||('HTTP '+res.status))}
    const out=data&&data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;
    if(!out)throw new Error('پاسخ نامعتبر از API');
    const txt=out.replace(/<think>[\s\S]*?<\/think>/g,'').replace(/```[a-z]*/gi,'');
    const a=txt.indexOf('['),z=txt.lastIndexOf(']');
    if(a<0||z<a)throw new Error('خروجی مدل JSON معتبر نبود');
    const arr=JSON.parse(txt.slice(a,z+1));
    if(!Array.isArray(arr)||arr.length!==srcRows.length||arr.some((r,i)=>!Array.isArray(r)||r.length!==srcRows[i].length))throw new Error('ساختار خروجی مدل با جدول مطابقت نداشت');
    const cells=arr.map((r,i)=>r.map((x,j)=>{const o=(x&&typeof x==='object')?x:{t:x};const t=String(o.t==null?'':o.t);return {src:srcRows[i][j],t,g:o.g===true&&!!norm(t)}}));
    transData={headers:cells[0],rows:cells.slice(1)};renderTrans();
    $('transArea').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(e){
    const net=e instanceof TypeError;const pub=/claude|anthropic/i.test(location.hostname);
    $('transArea').innerHTML='<div class="err">خطا: '+esc(e.message)+(net&&pub?'<br><b>این صفحه روی claude.ai منتشر شده و مرورگر اجازه درخواست به سایت‌های دیگر را نمی‌دهد. فایل HTML را دانلود کنید و محلی یا روی هاست خودتان باز کنید.</b>':'')+(net?'<br>ارتباط با API برقرار نشد؛ آدرس را بررسی کنید. ممکن است محدودیت CORS یا امنیتی مرورگر/صفحه جلوی درخواست را گرفته باشد.':'')+'</div>';
  }finally{busy=false;btn.disabled=false;btn.textContent='ترجمه جدول'}
};

/* ---------- Minimizable composer ---------- */
const UIK='tablesync.ui.v1',compEl=document.querySelector('.comp');
function updPrev(){
  const l=ta.value.split(/\r?\n/).filter(Boolean);
  $('cprev').textContent=ta.value.trim()?('✎ '+l[0]+(l.length>1?'  (+'+(l.length-1)+' خط)':'')):'✎ کادر متن (برای باز کردن لمس کنید)';
}
function setMin(m,focus){
  compEl.classList.toggle('min',m);
  const b=$('compToggle');b.textContent=m?'▴ باز کردن':'▾ کوچک کردن';b.setAttribute('aria-expanded',String(!m));
  try{localStorage.setItem(UIK,m?'1':'0')}catch(e){}
  if(m)updPrev();else{autosize();if(focus)ta.focus()}
}
$('compToggle').onclick=()=>setMin(!compEl.classList.contains('min'),false);
$('cprev').onclick=()=>setMin(false,true);
$('cprev').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setMin(false,true)}};
ta.addEventListener('input',updPrev);

render();changed();autosize();updPrev();
try{if(localStorage.getItem(UIK)==='1')setMin(true,false)}catch(e){}

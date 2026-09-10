/* Shared authoring, validation and print layout; no external libraries. */
(function(root){
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=value=>String(value||'guida').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'guida';
  function uniqueSlug(title,items){let base=slug(title),value=base,n=2;while(items.some(p=>p.slug===value))value=base+'-'+n++;return value;}
  function link(config,id){const base=config.publishing?.baseUrl||new URL('index.html',location.href).href;return base.split('#')[0].split('?')[0]+'#prompt/'+encodeURIComponent(id);}
  function sectionVisible(config,id){const state=config?.sectionSettings?.[id];return state?.removed!==true&&state?.visible!==false;}
  const defaultTemplate={tool:'',stepTitles:['Prepara','Genera','Rifinisci']};
  function fromSteps(brief,items=[]){
    const title=String(brief.title||'').trim();
    if(!title)throw Error('Dai un titolo alla guida.');
    if(!Array.isArray(brief.steps)||!brief.steps.length)throw Error('Aggiungi almeno un passaggio.');
    const steps=brief.steps.map((s,i)=>{
      if(!String(s.title||'').trim()||!String(s.body||'').trim())throw Error(`Passaggio ${i+1}: scrivi il titolo e cosa deve fare il lettore.`);
      const blocks=(s.blocks||[]).map((b,k)=>{if(!String(b.code||'').trim())throw Error(`Passaggio ${i+1}, prompt ${k+1}: incolla il testo oppure rimuovi il prompt vuoto.`);return {label:String(b.label||'').trim(),code:String(b.code)};});
      return {title:s.title.trim(),body:s.body.trim(),blocks};
    });
    return {title,slug:uniqueSlug(title,items),status:'draft',type:'Guida',mediaType:'Video',tool:String(brief.tool||'').trim(),heroImage:'',preview:'graphite',desc:'',tags:[],category:'',guide:{steps}};
  }
  function fromBrief(brief,template={},items=[]){
    const title=String(brief.title||'').trim();
    const lines=String(brief.process||'').split(/\r?\n/).map(s=>s.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '').trim()).filter(Boolean);
    if(!title||!lines.length)throw Error('Inserisci il titolo e almeno un passaggio del processo.');
    const titles=template.stepTitles?.length?template.stepTitles:defaultTemplate.stepTitles;
    return {title,slug:uniqueSlug(title,items),status:'draft',type:'Guida',mediaType:brief.mediaType||'Video',tool:String(brief.tool||template.tool||'').trim(),heroImage:brief.heroImage||'',preview:brief.heroImage||'graphite',desc:'',tags:[],category:'',guide:{steps:lines.map((body,i)=>({title:titles[i]||'Passaggio '+(i+1),body,blocks:i===0&&brief.prompt?.trim()?[{label:'Prompt',code:brief.prompt.trim()}]:[]}))}};
  }
  // One concise projection is shared by the reader and PDF; original extra fields remain editable data.
  function essentials(p){return {...p,category:'',tags:[],desc:p.summary||'',neg:'',guide:p.guide?{steps:(p.guide.steps||[]).map((s,i)=>({title:s.title||'Passaggio '+(i+1),label:String(i+1).padStart(2,'0'),body:s.body||'',image:s.image,blocks:(s.blocks||[]).filter(b=>b.code?.trim())}))}:undefined};}
  function validate(c){
    const errors=[];
    if(!c||typeof c!=='object'||Array.isArray(c))return ['La configurazione deve essere un oggetto.'];
    for(const key of ['tiles','prompts','tools','free','socials','projects'])if(c[key]!==undefined&&!Array.isArray(c[key]))errors.push(key+': elenco non valido.');
    if(errors.length)return errors;
    const seen=new Set();
    const color=/^#[0-9a-f]{6}$/i;
    for(const [name,value] of Object.entries(c.appearance||{}))if(value&&!color.test(value))errors.push(`Colore generale non valido: ${name}. Usa il formato #00356B.`);
    for(const p of c.prompts||[]){
      if(!p||typeof p!=='object'){errors.push('Guida non valida.');continue;}
      if(!p.title?.trim())errors.push('Ogni guida deve avere un titolo.');
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug||''))errors.push((p.title||'Guida')+': usa un link con lettere minuscole, numeri e trattini.');
      if(seen.has(p.slug))errors.push('Link duplicato: '+p.slug);seen.add(p.slug);
      if(p.status==='published'&&!p.prompt?.trim()&&!p.guide?.steps?.some(s=>s.body?.trim()||s.blocks?.some(b=>b.code?.trim())))errors.push(p.title+': aggiungi contenuto prima di pubblicare.');
    }
    for(const [i,tile] of (c.tiles||[]).entries())for(const [name,value] of Object.entries(tile.colors||{}))if(value&&!color.test(value))errors.push(`Blocco ${i+1}, colore ${name} non valido. Usa il formato #00356B.`);
    const email=/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
    for(const [kind,f] of Object.entries(c.forms||{})){
      for(const key of ['to','cc'])if(f[key]&&f[key].split(',').some(s=>!email.test(s.trim())))errors.push(kind+': indirizzo email non valido ('+key+').');
      if(f.affiliateParam&&!/^[a-zA-Z0-9_-]+$/.test(f.affiliateParam))errors.push('Parametro affiliato non valido.');
    }
    function walk(obj,path=''){
      for(const [key,v] of Object.entries(obj||{})){
        if(['__proto__','constructor','prototype'].includes(key)){errors.push('Campo non consentito: '+key);continue;}
        if(v&&typeof v==='object'){walk(v,path+'.'+key);continue;}
        if(typeof v!=='string')continue;
        if(/^(url|link|endpoint|formEndpoint|bookingUrl|bookUrl|baseUrl|website|instagram|privacy|terms)$/i.test(key)&&v&&v!=='#'&&!v.includes('{{')){
          if(!/^https:\/\/[^\s"'<>]+$/i.test(v)&&!(/^assets\/[^"'<>]+$/.test(v)&&['url','link'].includes(key)))errors.push(path+'.'+key+': inserisci un link HTTPS completo.');
        }
        if(['img','image','heroImage','video','poster'].includes(key)&&v&&!/^(https:\/\/|assets\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(v))errors.push(path+'.'+key+': usa un’immagine o video in assets/ oppure un URL HTTPS.');
      }
    }
    walk(c);return [...new Set(errors)];
  }
  function fromMarkdown(text,items=[]){
    const lines=text.replace(/\r/g,'').split('\n');
    const title=lines.find(l=>/^#\s/.test(l))?.replace(/^#\s+/,'').trim()||'Nuova guida';
    const p={title,slug:uniqueSlug(title,items),status:'draft',type:'Guida',mediaType:'Immagine',category:'',tool:'',tags:[],desc:'',heroImage:'',preview:'graphite',guide:{intro:'',steps:[],rules:[],result:''}};
    let step=null,code=null;
    for(const line of lines){
      if(/^```/.test(line)){if(code!==null){if(!step){step={title:'Prompt',body:'',blocks:[]};p.guide.steps.push(step);}step.blocks.push({label:'Prompt',code:code.join('\n')});code=null;}else code=[];continue;}
      if(code!==null){code.push(line);continue;}
      if(/^#\s/.test(line))continue;
      if(/^##\s/.test(line)){step={label:'STEP '+(p.guide.steps.length+1),title:line.replace(/^##\s+/,''),body:'',list:[],blocks:[],note:''};p.guide.steps.push(step);continue;}
      if(step){if(/^[-*]\s/.test(line))step.list.push(line.replace(/^[-*]\s+/,''));else step.body+=(step.body?'\n':'')+line;}
      else p.guide.intro+=(p.guide.intro?'\n':'')+line;
    }
    if(code!==null)throw Error('Chiudi il blocco prompt con tre accenti gravi (```).');
    p.guide.intro=p.guide.intro.trim();p.desc=p.guide.intro.slice(0,180);return p;
  }
  function printHTML(c,p){
    p=essentials(p);
    const e=escape,g=p.guide;
    const paras=t=>e(t).replace(/\n/g,'<br>');
    const img=p.heroImage||g?.heroImage;
    const image=img&&/^(https:\/\/|assets\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(img)?`<img class="hero" src="${e(new URL(img,location.href).href)}" alt="${e(p.title)}">`:'';
    const content=g?`<p>${paras(g.intro)}</p>${(g.steps||[]).map((s,i)=>`<section><div class="label">${e(s.label||'STEP '+(i+1))}</div><h2>${e(s.title)}</h2><p>${paras(s.body)}</p>${s.image?`<img class="hero" src="${e(new URL(s.image,location.href).href)}" alt="${e(s.title)}">`:""}${s.list?.length?'<ul>'+s.list.map(v=>'<li>'+e(v)+'</li>').join('')+'</ul>':''}${(s.blocks||[]).map(b=>`<h3>${e(b.label||'Prompt')}</h3><pre>${e(b.code)}</pre>`).join('')}${s.note?'<aside>'+paras(s.note)+'</aside>':''}</section>`).join('')}${g.rules?.length?'<h2>Regole chiave</h2><ul>'+g.rules.map(v=>'<li>'+e(v)+'</li>').join('')+'</ul>':''}${g.result?'<h2>Risultato</h2><p>'+paras(g.result)+'</p>':''}`:`<h2>Prompt</h2><pre>${e(p.prompt)}</pre>${p.neg?'<h3>Negative prompt</h3><pre>'+e(p.neg)+'</pre>':''}`;
    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(p.title)} — Maxdesign</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=Jost:wght@400;500&display=swap"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#232323;background:#F5F3F0;font:16px/1.6 Jost,Arial,sans-serif}.page{max-width:800px;margin:auto;padding:40px;background:white}.brand,.label{color:#00356B;letter-spacing:.12em;font-size:12px;text-transform:uppercase}header{border-bottom:2px solid #00356B;padding-bottom:20px}h1,h2{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.2}h1{font-size:36px;overflow-wrap:anywhere}h2{font-size:25px}h3{font-size:16px}p{white-space:normal}section{margin-top:30px}.hero{max-width:100%;max-height:280px;object-fit:contain;margin:24px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.65 monospace;background:#F5F3F0;border-left:3px solid #00356B;padding:16px}aside{border:1px solid #ddd;padding:14px}h1,h2,h3,.label{break-after:avoid}li,aside{break-inside:avoid}footer{border-top:1px solid #ddd;margin-top:36px;padding-top:16px;font-size:12px;overflow-wrap:anywhere}nav{padding:16px;display:flex;gap:12px;align-items:center;justify-content:center}button{padding:12px 20px;border:0;border-radius:30px;background:#00356B;color:white;font:inherit;cursor:pointer}@media print{body{background:white}.page{padding:0;max-width:none}nav{display:none}a{color:#00356B}pre{box-decoration-break:clone;-webkit-box-decoration-break:clone}}</style></head><body><nav><button onclick="window.print()">Stampa / Salva come PDF</button><span>Scegli “Salva come PDF” nelle opzioni di stampa.</span></nav><main class="page"><header><div class="brand">${e(c.profile?.name||'Maxdesign®')} · Guide creative</div><h1>${e(p.title)}</h1><div>${e([p.category,p.tool].filter(Boolean).join(' · '))}</div><p>${paras(p.desc)}</p></header>${image}${p.video?`<p>Video del risultato: <a href="${e(new URL(p.video,location.href).href)}">Guarda il video online</a></p>`:""}${content}<footer>${e(c.profile?.handle||'@maxdesign.ai')} · Prompt. Processo. Creatività.<br>${c.publishing?.baseUrl?`<a href="${e(link(c,p.slug))}">${e(link(c,p.slug))}</a>`:''}</footer></main></body></html>`;
  }
  function printGuide(c,p){if(!p)return;const win=window.open('','_blank');if(!win){alert('Consenti l’apertura della scheda per esportare il PDF.');return;}win.opener=null;win.document.write(printHTML(c,p));win.document.close();}
  const api={escape,slug,uniqueSlug,link,sectionVisible,validate,fromMarkdown,fromBrief,fromSteps,essentials,defaultTemplate,printHTML,printGuide};
  if(typeof module!=='undefined')module.exports=api;root.MaxContent=api;
})(typeof window!=='undefined'?window:globalThis);

(function(){
  const e=MaxContent.escape;
  function addCommunityPanel(c){
    const section=document.createElement('section');section.className='panel';section.dataset.p='communityContact';
    section.hidden=!MaxContent.sectionVisible(c,'communityContact');
    section.innerHTML='<div class="panel-head"></div><div id="communityFormSlot"></div>';
    document.querySelector('.sheet-inner').append(section);
  }
  function bookingLink(f){try{const u=new URL(f.bookingUrl);if(u.protocol!=='https:')return '';if(f.affiliateId)u.searchParams.set(f.affiliateParam||'ref',f.affiliateId);return u.href;}catch{return '';}}
  function setupForms(c){
    for(const [kind,panel] of [['collaboration','contact'],['community','communityContact']]){
      const f=c.forms?.[kind]||{to:c.links?.email,endpoint:c.links?.formEndpoint,objectives:c.contact?.objectives};
      const section=document.querySelector(`[data-p="${panel}"]`);
      if(!section||!MaxContent.sectionVisible(c,panel)){if(section)section.hidden=true;continue;}
      const heading=kind==='community'?'Informazioni e call community':'Collaborazioni e progetti';
      section.querySelector('.panel-head').innerHTML=`<span class="eyebrow">${heading}</span><h2>${e(f.title||heading)}</h2><p>${e(f.intro||'')}</p>`;
      let form=section.querySelector('form');if(!form){form=document.createElement('form');document.querySelector('#communityFormSlot').append(form);}form.id=kind+'Form';form.noValidate=false;
      const configured=!!(f.endpoint||f.to);const privacy=c.links?.privacy&&c.links.privacy!=='#'?c.links.privacy:'';
      form.innerHTML=`<div class="f"><label for="${kind}-name">Nome *</label><input id="${kind}-name" name="name" autocomplete="name" maxlength="120" required></div><div class="f"><label for="${kind}-email">Email *</label><input id="${kind}-email" name="email" type="email" autocomplete="email" maxlength="254" required></div><div class="f"><label for="${kind}-objective">Motivo della richiesta</label><select id="${kind}-objective" name="objective">${(f.objectives?.length?f.objectives:[heading]).map(v=>`<option>${e(v)}</option>`).join('')}</select></div><div class="f"><label for="${kind}-message">Messaggio *</label><textarea id="${kind}-message" name="message" rows="5" maxlength="6000" required></textarea></div><div class="form-trap" aria-hidden="true"><label>Lascia vuoto<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="consent"><input type="checkbox" name="consent" required><span>${e(f.privacyText||'Acconsento al trattamento dei dati per rispondere alla richiesta.')}${privacy?` <a href="${e(privacy)}" target="_blank" rel="noopener">Leggi l’informativa</a>`:''}</span></label><button class="btn btn-dark" type="submit" ${configured?'':'disabled'}>${e(f.buttonText||'Invia richiesta')}</button><p class="form-note">${configured?(f.endpoint?'La richiesta verrà inviata direttamente.':'Si aprirà la tua app email: controlla il messaggio e premi Invia.'): 'Questo modulo sarà disponibile a breve.'}</p><p class="form-feedback" role="status" aria-live="polite"></p>`;
      const legacy=section.querySelector('#formDone');if(legacy)legacy.remove();
      const oldBooking=section.querySelector('#bookCall');if(oldBooking)oldBooking.remove();
      const booking=bookingLink(f);
      if(kind==='community'&&booking){const a=document.createElement('a');a.className='btn-full';a.href=booking;a.target='_blank';a.rel='noopener';a.textContent='Prenota una call con la community ↗';form.after(a);}
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!form.reportValidity())return;
        const fields=new FormData(form);if(fields.get('website'))return;
        const data={name:String(fields.get('name')).trim(),email:String(fields.get('email')).trim(),objective:fields.get('objective'),message:String(fields.get('message')).trim(),consent:true,requestType:kind,source:'Maxdesign Instagram Hub',affiliateId:kind==='community'?(f.affiliateId||''):'',page:location.href};
        const status=form.querySelector('.form-feedback'),button=form.querySelector('[type="submit"]');
        if(!data.name||!data.message){status.textContent='Inserisci nome e messaggio, senza lasciare solo spazi.';return;}
        if(location.search.includes('preview')){status.textContent='Anteprima: nessun messaggio inviato.';return;}
        if(!f.endpoint){
          if(!f.to){status.textContent='Il modulo non è ancora disponibile.';return;}
          const subject=(kind==='community'?'Community — richiesta da Maxdesign':'Collaborazione Maxdesign')+' — '+data.name;
          const body=`Nome: ${data.name}\nEmail: ${data.email}\nMotivo: ${data.objective}\n\n${data.message}\n\nProvenienza: Maxdesign Instagram Hub\n${data.affiliateId?'Affiliato: '+data.affiliateId+'\n':''}Consenso privacy: sì`;
          const params=new URLSearchParams({subject,body});if(f.cc)params.set('cc',f.cc);
          location.href='mailto:'+encodeURIComponent(f.to).replace(/%2C/g,',')+'?'+params.toString().replace(/\+/g,'%20');
          status.textContent='Email preparata. Completa l’invio nella tua app email; la richiesta non è ancora stata inviata dal sito.';return;
        }
        button.disabled=true;status.textContent='Invio in corso…';
        try{
          const response=await fetch(f.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
          if(!response.ok)throw Error('server');
          const result=await response.json().catch(()=>({}));if(result.success===false||result.error||result.errors)throw Error('provider');
          status.textContent=f.successText||'Richiesta inviata. Grazie!';form.reset();
        }catch{status.textContent='Invio non riuscito. I tuoi dati sono ancora qui: riprova tra poco.';}
        finally{button.disabled=false;}
      });
    }
    // Manage focus, background interaction and videos as overlays appear.
    const sheet=document.querySelector('#sheet'),modal=document.querySelector('#modal');let prior=null,lastLayer=null;
    const sync=()=>{
      const layer=modal.classList.contains('show')?modal:sheet.classList.contains('show')?sheet:null;
      document.querySelector('.shell').inert=!!layer;sheet.inert=layer===modal||!layer;modal.inert=layer!==modal;
      sheet.setAttribute('aria-hidden',String(!sheet.classList.contains('show')));modal.setAttribute('aria-hidden',String(layer!==modal));
      if(layer!==lastLayer){if(!lastLayer)prior=document.activeElement;if(layer){layer.querySelector('button,a,input')?.focus({preventScroll:true});layer.scrollTop=0;}else prior?.focus?.({preventScroll:true});lastLayer=layer;}
      document.querySelectorAll('video').forEach(video=>{if(layer||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)video.pause();});
    };
    new MutationObserver(sync).observe(sheet,{attributes:true,attributeFilter:['class']});new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class']});sync();
    document.addEventListener('keydown',event=>{
      if(event.key!=='Tab'||!lastLayer)return;
      const nodes=[...lastLayer.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled&&!el.closest('[inert]'));
      if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    const observer=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{if(isIntersecting&&!document.hidden&&!lastLayer&&!matchMedia('(prefers-reduced-motion: reduce)').matches)target.play().catch(()=>{});else target.pause();}),{threshold:.15});
    document.querySelectorAll('video').forEach(video=>observer.observe(video));document.addEventListener('visibilitychange',sync);
    document.querySelectorAll('a[href="#"],a[href*="{{"]').forEach(a=>{if(a.closest('.legal'))a.hidden=true;});
  }
  window.MaxExperience={addCommunityPanel,setupForms,bookingLink};
})();

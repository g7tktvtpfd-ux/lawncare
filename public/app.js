'use strict';
const menu=document.getElementById('menu-toggle');
const links=document.getElementById('nav-links');
menu?.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation')});
links?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('open');menu.setAttribute('aria-expanded','false')}));

const picker=document.getElementById('service-picker');
const selectedLabel=document.getElementById('selected-services-label');
const boxes=[...document.querySelectorAll('input[name="services"]')];
const selectedServices=()=>boxes.filter(box=>box.checked).map(box=>box.value);
function updateSelection(){
  const selected=selectedServices();
  selectedLabel.textContent=selected.length===0?'Select one or more services above.':
    selected.length===1?'✓ 1 service selected: '+selected[0]:
    '✓ '+selected.length+' services selected: '+selected.join(', ');
  selectedLabel.classList.toggle('active',selected.length>0);
  boxes.forEach(box=>box.closest('label')?.classList.toggle('checked',box.checked));
  document.querySelectorAll('[data-service]').forEach(tile=>{const checked=selected.includes(tile.dataset.service);tile.classList.toggle('is-selected',checked);tile.setAttribute('aria-pressed',String(checked))});
}
boxes.forEach(box=>box.addEventListener('change',updateSelection));
document.querySelectorAll('[data-service]').forEach(tile=>tile.addEventListener('click',()=>{
  const box=boxes.find(b=>b.value===tile.dataset.service);
  if(box)box.checked=!box.checked;
  updateSelection();
  document.getElementById('request').scrollIntoView({behavior:'smooth',block:'start'});
}));
updateSelection();

const date=document.getElementById('preferredDate');
date.min=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const form=document.getElementById('request-form'),button=document.getElementById('submit-request'),status=document.getElementById('form-status');
form.addEventListener('submit',async event=>{
  event.preventDefault();status.className='form-status';status.textContent='';
  if(!form.reportValidity())return;
  const services=selectedServices();
  if(!services.length){status.textContent='Please check at least one service above.';status.className='form-status show error';picker.querySelector('input')?.focus();return}
  const d=Object.fromEntries(new FormData(form).entries());d.services=services;delete d.service;
  button.disabled=true;button.textContent='Sending request…';
  try{
    const response=await fetch('/api/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'Could not send request.');
    status.textContent='✓ '+result.message;status.className='form-status show';form.reset();updateSelection();
  }catch(err){status.textContent=err.message||'Could not send. Please try again.';status.className='form-status show error'}
  finally{button.disabled=false;button.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg> Send Request'}
});

/* Plain JavaScript, no build step and no client-side secrets. */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.PLANNER_CONFIG||{};
const SITE_VERSION='stats-20261122';
const effortValues=['1 - Very easy, plenty of energy left｜非常輕鬆，仍有充足餘力','2 - Fairly easy, slightly tired｜比較輕鬆，稍感疲倦','3 - Moderate effort, some breaks needed｜有些吃力，需要稍作休息','4 - Very demanding, close to my limit｜很吃力，接近體力極限','5 - Extremely demanding, struggled or stopped early｜極其吃力，勉強完成或中途退出'];
const effortLabels=[['Very easy','非常輕鬆'],['Fairly easy','比較輕鬆'],['Moderate','有些吃力'],['Demanding','很吃力'],['Very demanding','極其吃力']];
effortValues.forEach((v,i)=>{const l=document.createElement('label');l.className='effort-card';const input=document.createElement('input');input.type='radio';input.name='last_hike_effort';input.value=v;input.required=true;l.append(input);const b=document.createElement('b');b.textContent=i+1;l.append(b);const s=document.createElement('span');s.textContent=effortLabels[i][0];l.append(s);const sm=document.createElement('small');sm.textContent=effortLabels[i][1];l.append(sm);$('#effort-options').append(l)});
let step=0, controller=null,planText='',previewMode=false,taskId='',runUser='';
const panels=$$('[data-panel]');
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,3500)}
function validate(i){const bad=[...panels[i].querySelectorAll('input,textarea')].find(e=>!e.checkValidity());if(bad){showStep(i,false);bad.reportValidity();return false}return true}
function showStep(i,focus=true){step=i;panels.forEach((p,n)=>p.hidden=n!==i);$$('[data-step]').forEach((b,n)=>{if(n===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current')});$('#back').hidden=i===0;$('#next').hidden=i===2;$('#generate').hidden=i!==2;$('#step-count').textContent=`STEP 0${i+1} OF 03`;if(focus){$('#planner').scrollIntoView({behavior:'smooth'});const h=panels[i].querySelector('h2');h.tabIndex=-1;h.focus({preventScroll:true})}}
$$('[data-step]').forEach(b=>b.addEventListener('click',()=>{let target=Number(b.dataset.step);if(target>step){for(let i=step;i<target;i++)if(!validate(i))return}showStep(target)}));
$('#next').onclick=()=>{if(validate(step))showStep(step+1)};$('#back').onclick=()=>showStep(step-1);
$('#original').href=cfg.difyUrl||'https://udify.app/workflow/712OufqxYO2EAtSM';
$('#connection-note').hidden=Boolean(cfg.endpoint);

function collect(){const data=Object.fromEntries(new FormData($('#plan-form')));for(const k of ['available_hours','trip_budget','gear_budget']){if(data[k]==='')delete data[k];else data[k]=Number(data[k])}return data}
function detailsText(){return Object.entries(collect()).map(([k,v])=>k+': '+v).join('\n')}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copied · 已複製')}catch{toast('Copy unavailable here. Use Save .md instead.／此環境無法複製，請使用下載。')}}
$('#handoff-copy').onclick=()=>copy(detailsText());
// Render untrusted model text as text nodes. Only http(s) links are clickable.
function inline(parent,text){const re=/(\*\*[^*]+\*\*|https?:\/\/[^\s<>"，。；）]+)/g;let at=0,m;while((m=re.exec(text))){parent.append(document.createTextNode(text.slice(at,m.index)));const token=m[0];if(token.startsWith('**')){const s=document.createElement('strong');s.textContent=token.slice(2,-2);parent.append(s)}else{const clean=token.replace(/[).,;]+$/,'');const a=document.createElement('a');a.href=clean;a.textContent=clean;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);parent.append(document.createTextNode(token.slice(clean.length)))}at=m.index+token.length}parent.append(document.createTextNode(text.slice(at)))}
function normaliseMarkdown(s){return s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s]+?)\)/g,'$1 ($2)')}
function renderPlan(text,isPreview=false){planText=text;previewMode=isPreview;$('#result-panel').hidden=false;$('#feedback').hidden=isPreview;$('#feedback').open=false;$('#feedback-form').dataset.runId=isPreview?'preview':runUser;$('#result-badge').textContent=isPreview?'LAYOUT PREVIEW · 版面示例，並非即時行程':'YOUR PLAN · 你的徒步計劃';$('#plan-content').replaceChildren();$('#result-nav').replaceChildren();const lines=normaliseMarkdown(text).split('\n');let sec=null,pending='',count=0;const flush=()=>{if(!pending.trim())return;if(!sec)makeSection('Field note','徒步筆記');const p=document.createElement('p');inline(p,pending.trim());sec.append(p);pending=''};const makeSection=(en,zh)=>{sec=document.createElement('section');sec.className='plan-section';sec.id='plan-section-'+count++;const h=document.createElement('h3');h.textContent=en;sec.append(h);if(zh){const h4=document.createElement('h4');h4.textContent=zh;sec.append(h4)}$('#plan-content').append(sec);const a=document.createElement('a');a.href='#'+sec.id;a.textContent=en.replace(/^\d+[.)]?\s*/,'');$('#result-nav').append(a)};
for(let i=0;i<lines.length;i++){const raw=lines[i].trim();const match=raw.match(/^(?:#{1,3}\s+(.+)|\*\*(\d+[.]?\s+.+)\*\*)$/);if(match){flush();let title=(match[1]||match[2]).replace(/^\*\*|\*\*$/g,'');let zh='';if(lines[i+1]&&/^[#*]/.test(lines[i+1].trim())&&/[\u3400-\u9fff]/.test(lines[i+1])){zh=lines[++i].trim().replace(/^#{1,3}\s+|^\*\*|\*\*$/g,'')}makeSection(title,zh)}else if(!raw){flush()}else{pending+=raw+'\n'}}flush();if(isPreview){const n=document.createElement('p');n.className='preview-label';n.textContent='Design sample only. No weather, transport or stock has been checked.／僅供查看版面，並未查詢天氣、交通或存貨。';$('#plan-content').prepend(n)}$('#result-panel').scrollIntoView({behavior:'smooth'})}
$('#copy-plan').onclick=()=>copy(planText);$('#download-plan').onclick=()=>{const blob=new Blob([(previewMode?'LAYOUT PREVIEW / 版面示例\n\n':'')+planText],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=previewMode?'little-trail-layout-preview.md':'little-trail-plan.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('#print-plan').onclick=()=>window.print();$('#edit-plan').onclick=()=>{$('#planner').scrollIntoView({behavior:'smooth'});showStep(0)};
$('#preview').onclick=()=>renderPlan(`# 🥾 Route overview\n# 🥾 路線摘要\n\nThis is a layout sample, not a generated travel plan. Your chosen route, date, distance and planning status will appear here after a successful run.\n\n這是版面示例，並非已生成行程。成功執行後，這裡會顯示你的路線、日期、距離及規劃狀態。\n\n# ⏱️ Itinerary\n# ⏱️ 行程安排\n\n01  Travel to the trailhead\n02  Walk, pause, take a photograph\n03  Leave time for the journey home\n\n01  前往山徑起點\n02  徒步、歇一歇、拍張照片\n03  為回程留一點時間\n\n# 🌦️ Weather & things to check\n# 🌦️ 天氣與待確認事項\n\nThe actual plan will distinguish the hiking-date forecast from current warnings, with sources and any gaps in the evidence.\n\n實際計劃會區分徒步日期預報與當前警告，並列出來源及尚未核實之處。\n\n# 🎒 Equipment & shops\n# 🎒 裝備與門店\n\nRequested gear and store links will appear here. A product listing does not establish branch stock. Shopping stays outside the walking itinerary.\n\n你想添購的裝備和門店連結會出現在這裡。商品頁面不代表分店有貨，購物也不會強制排進徒步行程。`,true);
$('#fill-sample').onclick=()=>{
  if(controller)return;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const date=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+7)).toISOString().slice(0,10);
  const sample={preferred_route:'麥理浩徑第四段',departure_point:'紅磡站',hike_date:date,available_hours:8,last_hike:'上次完成麥理浩徑第四段，感覺很吃力',exercise_habits:'平日很少運動',trip_budget:200,gear_budget:'',gear_details:'已有行山鞋、背包及水樽',preferences_requests:'喜歡海景，希望預留拍照時間；如路線太吃力，請建議較短選擇。'};
  for(const [name,value] of Object.entries(sample))$('#plan-form').elements.namedItem(name).value=value;
  $('#plan-form').elements.namedItem('hiking_party').value='With others｜結伴同行';
  $('#plan-form').elements.namedItem('last_hike_effort').value=effortValues[3];
  $('#form-error').hidden=true;$('#result-panel').hidden=true;showStep(0);
  toast('Sample filled. Edit or generate when ready.／已填入示例，可修改後生成。');
};
function busy(on){$$('#plan-form button,#plan-form input,#plan-form textarea,.steps button').forEach(e=>e.disabled=on);$('#run-panel').hidden=!on;$('#preview').disabled=on;$('#fill-sample').disabled=on}
function status(t){$('#run-status').textContent=t}
async function consumeSSE(response,onEvent){if(!response.body)throw Error('Empty response／沒有回應內容');const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';function frame(f){const data=f.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data||data==='[DONE]')return;let evt;try{evt=JSON.parse(data)}catch{throw Error('Unreadable planner response／無法讀取規劃器回應')}onEvent(evt)}while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let at;while((at=buffer.indexOf('\n\n'))>=0){frame(buffer.slice(0,at));buffer=buffer.slice(at+2)}}buffer+=decoder.decode();if(buffer.trim())frame(buffer)}
$('#plan-form').addEventListener('submit',async ev=>{ev.preventDefault();for(let i=0;i<3;i++)if(!validate(i))return;$('#form-error').hidden=true;if(!cfg.endpoint){$('#connection-note').hidden=false;$('#connection-note').scrollIntoView({behavior:'smooth'});toast('Direct generation is not connected yet.／本頁尚未接通直接生成。');return}if(controller)return;const inputs=collect();const waitStarted=performance.now();let metricsReceipt='',metricsSent=false;controller=new AbortController();taskId='';runUser='web-'+crypto.randomUUID();const metricsUser=runUser;function reportWait(outcome){if(metricsSent||!metricsReceipt)return;metricsSent=true;const wait_ms=Math.round(performance.now()-waitStarted);fetch(cfg.endpoint.replace(/\/run\/?$/,'')+'/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:metricsUser,receipt:metricsReceipt,wait_ms,outcome}),keepalive:true}).catch(()=>{})}busy(true);$('#result-panel').hidden=true;$('#run-heading').textContent='Planning your hike… Please wait.';status('正在規劃你的徒步行程，請稍候。');$('#run-panel').scrollIntoView({behavior:'smooth'});let finished=false;
try{const response=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inputs,user:runUser,client_version:SITE_VERSION}),signal:controller.signal});metricsReceipt=response.headers.get('X-Run-Receipt')||'';if(!response.ok)throw Error('Planner request failed ('+response.status+'). Please try again.／規劃請求失敗，請稍後重試。');await consumeSSE(response,e=>{if(e.task_id)taskId=e.task_id;if(e.event==='error')throw Error('The planner returned an error. Please retry.／規劃器回報錯誤，請重試。');if(e.event==='workflow_finished'){if(e.data?.status!=='succeeded')throw Error('The workflow did not finish successfully.／工作流未能成功完成。');const t=e.data?.outputs?.travel_plan;if(typeof t!=='string'||!t.trim())throw Error('No travel plan was returned.／未收到旅遊計劃。');finished=true;renderPlan(t);reportWait('result_ready')}});if(!finished)throw Error('Connection ended before the plan finished. Retry when ready.／連線在計劃完成前中斷，請重新執行。')}
catch(e){reportWait(e.name==='AbortError'?'stopped':'error');$('#form-error').hidden=false;$('#form-error').textContent=e.name==='AbortError'?'Stopped waiting. Check Dify if a run is still active.／已停止等待，如工作仍在執行請到 Dify 查看。':e.message;$('#form-error').scrollIntoView({behavior:'smooth'})}finally{controller=null;busy(false)}});
$('#cancel').onclick=async()=>{if(!controller)return;const active=controller;if(taskId){try{await fetch(cfg.endpoint.replace(/\/run\/?$/,'')+'/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_id:taskId,user:runUser})})}catch{/* abort local wait even if remote stop unavailable */}}active.abort()};
showStep(0,false);

const feedbackForm=$('#feedback-form');
feedbackForm.addEventListener('submit',async ev=>{
  ev.preventDefault();
  if(!feedbackForm.reportValidity())return;
  const button=$('#feedback-send'), status=$('#feedback-status');
  if(button.disabled)return;
  const data=new FormData(feedbackForm);
  data.set('run_id',feedbackForm.dataset.runId||'unavailable');
  data.set('site_version',SITE_VERSION);
  button.disabled=true;status.textContent='Sending…／正在傳送…';
  try{
    const response=await fetch(feedbackForm.action,{method:'POST',body:data,headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('send failed');
    feedbackForm.reset();status.textContent='Thank you for your feedback!／謝謝你的回饋！';
  }catch{
    status.textContent='Could not send. Please try again.／未能傳送，請重試。';
  }finally{button.disabled=false}
});


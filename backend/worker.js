// Deploy as little-trail-api. Secrets belong in Cloudflare, never in this file.
const PROXY_VERSION='stats-20261122';
const KEYS=['preferred_route','departure_point','hike_date','available_hours','hiking_party','last_hike','last_hike_effort','exercise_habits','trip_budget','gear_budget','gear_details','preferences_requests'];
const SAFE_HEADERS={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const version=v=>typeof v==='string'&&/^[a-zA-Z0-9._-]{1,80}$/.test(v)?v:'unlabelled';
const validUser=v=>typeof v==='string'&&/^web-[a-zA-Z0-9-]{10,80}$/.test(v);
const finite=(v,max=86400000)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:null;
async function digest(s){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
async function hash(s){return [...await digest(s)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function equal(a,b){const [x,y]=await Promise.all([digest(a),digest(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
async function record(env,sql,args){
  if(!env.STATS_DB)return false;
  try{await env.STATS_DB.prepare(sql).bind(...args).run();return true}
  catch{console.warn('metrics_write_failed');return false}
}
// Bounded SSE inspection. All bytes still flow unchanged to the browser.
// Only workflow metadata is retained; node inputs, outputs and text are discarded.
export function makeObserver(onFinish,onError){
  const decoder=new TextDecoder();let line='',lines=[],dropping=false,frameBytes=0;
  const dispatch=()=>{
    if(lines.length){try{const e=JSON.parse(lines.join('\n'));
      if(e.event==='workflow_finished')onFinish(e.data||{},e.workflow_run_id);
      else if(e.event==='error')onError();
    }catch{/* An oversized or non-JSON frame does not interrupt generation. */}}
    lines=[];frameBytes=0;dropping=false;
  };
  const take=l=>{if(l.endsWith('\r'))l=l.slice(0,-1);if(!l){dispatch();return}
    if(l.startsWith('data:')&&!dropping){const s=l.slice(5).trimStart();frameBytes+=s.length;
      if(frameBytes<=262144)lines.push(s);else{lines=[];dropping=true}}
  };
  const feed=t=>{for(const ch of t){if(ch==='\n'){take(line);line=''}else if(line.length<262144)line+=ch;else dropping=true}};
  return {push:chunk=>feed(decoder.decode(chunk,{stream:true})),end(){feed(decoder.decode());if(line)take(line);dispatch()}};
}
export function summarise(rows){
  const ended=rows.filter(r=>r.status!=='running');
  const good=rows.filter(r=>r.status==='succeeded');
  const median=values=>{const a=values.filter(x=>typeof x==='number'&&Number.isFinite(x)).sort((a,b)=>a-b);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2};
  return {runs:rows.length,completed:ended.length,succeeded:good.length,
    success_rate:ended.length?good.length/ended.length:null,
    median_dify_seconds:median(good.map(r=>r.dify_seconds)),
    median_client_seconds:median(good.filter(r=>r.client_outcome==='result_ready').map(r=>r.client_wait_ms===null?null:r.client_wait_ms/1000)),
    client_samples:good.filter(r=>r.client_outcome==='result_ready'&&r.client_wait_ms!==null).length,
    total_tokens:rows.reduce((n,r)=>n+(r.total_tokens||0),0),
    token_samples:rows.filter(r=>r.total_tokens!==null).length};
}
function csv(rows){const fields=['run_id','started_at','finished_at','status','server_ms','dify_seconds','total_tokens','gear_enabled','client_wait_ms','client_outcome','client_version','workflow_version','proxy_version','workflow_run_id','error_code'];
  const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';
  return '\uFEFF'+[fields.join(','),...rows.map(r=>fields.map(k=>cell(r[k])).join(','))].join('\r\n')
}
async function admin(request,env,url){
  const h={...SAFE_HEADERS,'Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
  if(!env.ADMIN_PASSWORD||env.ADMIN_PASSWORD.length<24)return new Response('Private statistics are not configured.',{status:503,headers:h});
  let supplied='';try{const auth=request.headers.get('Authorization')||'';if(auth.startsWith('Basic ')){const raw=atob(auth.slice(6));if(raw.slice(0,raw.indexOf(':'))==='admin')supplied=raw.slice(raw.indexOf(':')+1)}}catch{}
  if(!await equal(supplied,env.ADMIN_PASSWORD))return new Response('Sign in to view private statistics.',{status:401,headers:{...h,'WWW-Authenticate':'Basic realm="Little Trail statistics", charset="UTF-8"'}});
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:h});
  if(url.pathname==='/admin'||url.pathname==='/admin/')return new Response(ADMIN_HTML,{headers:{...h,'Content-Type':'text/html; charset=utf-8'}});
  if(!['/admin/data','/admin/export'].includes(url.pathname))return new Response('Not found',{status:404,headers:h});
  if(!env.STATS_DB)return new Response('Bind STATS_DB first.',{status:503,headers:h});
  const days=[7,30,90].includes(Number(url.searchParams.get('days')))?Number(url.searchParams.get('days')):30;
  const since=new Date(Date.now()-days*86400000).toISOString();const args=[since];let where='started_at >= ?';
  const gear=url.searchParams.get('gear');if(gear==='0'||gear==='1'){where+=' AND gear_enabled = ?';args.push(Number(gear))}
  const wf=url.searchParams.get('version');if(wf){if(version(wf)==='unlabelled'&&wf!=='unlabelled')return new Response('Invalid version',{status:400,headers:h});where+=' AND workflow_version = ?';args.push(wf)}
  try{
    const fields='run_id,started_at,finished_at,status,server_ms,dify_seconds,total_tokens,gear_enabled,client_wait_ms,client_outcome,client_version,workflow_version,proxy_version,workflow_run_id,error_code';
    const result=await env.STATS_DB.prepare('SELECT '+fields+' FROM runs WHERE '+where+' ORDER BY started_at DESC, run_id DESC LIMIT 10001').bind(...args).all();
    const limited=result.results.length>10000;
    const rows=result.results.slice(0,10000).map(r=>r.status==='running'&&Date.now()-Date.parse(r.started_at)>900000?{...r,status:'incomplete'}:r);
    if(url.pathname==='/admin/export')return new Response(csv(rows),{headers:{...h,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="little-trail-runs.csv"'}});
    return Response.json({summary:summarise(rows),rows,limited,days},{headers:h});
  }catch{return new Response('Statistics unavailable. Check database setup.',{status:503,headers:h})}
}
export default {async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/admin'||path.startsWith('/admin/'))return admin(request,env,url);
  const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!origin||!allowed.includes(origin))return new Response('Origin not allowed',{status:403,headers:SAFE_HEADERS});
  const cors={...SAFE_HEADERS,'Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Expose-Headers':'X-Run-Receipt'};
  const reply=(error,status=400,extra={})=>Response.json({error},{status,headers:{...cors,...extra}});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return reply('Method not allowed',405);
  if(!['/run','/stop','/metrics'].includes(path))return reply('Not found',404);
  if(!env.PLANNER_LIMITER)return reply('Rate limiting not configured',503);
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const limit=await env.PLANNER_LIMITER.limit({key:(path==='/metrics'?'metrics:':'')+ip});
  if(!limit.success)return reply('Please wait before trying again',429);
  let body;try{if(Number(request.headers.get('Content-Length'))>(path==='/metrics'?1500:12000))return reply('Request too large',413);
    const raw=await request.text();if(raw.length>(path==='/metrics'?1500:12000))return reply('Request too large',413);body=JSON.parse(raw)
  }catch{return reply('Invalid request')}
  if(!body||!validUser(body.user))return reply('Invalid user');
  if(path==='/metrics'){
    if(!env.STATS_DB)return new Response(null,{status:204,headers:cors});
    if(typeof body.receipt!=='string'||!/^[a-zA-Z0-9-]{36}$/.test(body.receipt)||finite(body.wait_ms)===null||!['result_ready','error','stopped'].includes(body.outcome))return reply('Invalid metrics');
    const ok=await record(env,'UPDATE runs SET client_wait_ms = ?, client_outcome = ? WHERE run_id = ? AND receipt_hash = ? AND client_wait_ms IS NULL',[Math.round(body.wait_ms),body.outcome,body.user,await hash(body.receipt)]);
    return new Response(null,{status:ok?204:503,headers:cors});
  }
  if(!env.DIFY_API_KEY)return reply('Planner not configured',503);
  let target,payload,inputs;
  if(path==='/stop'){
    if(typeof body.task_id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(body.task_id))return reply('Invalid task');
    target='/workflows/tasks/'+encodeURIComponent(body.task_id)+'/stop';payload={user:body.user};
  }else{
    const input=body.inputs;if(!input||typeof input!=='object'||Array.isArray(input))return reply('Invalid inputs');inputs={};
    for(const k of KEYS)if(k in input){const v=input[k];if(['available_hours','trip_budget','gear_budget'].includes(k)){
      if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000)return reply('Invalid number');inputs[k]=v;
    }else{if(typeof v!=='string'||v.length>2000)return reply('Invalid text');inputs[k]=v}}
    if(!inputs.departure_point?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(inputs.hike_date||'')||!inputs.hiking_party||!inputs.last_hike_effort||!(inputs.available_hours>=1&&inputs.available_hours<=24)||!(inputs.trip_budget>0))return reply('Required details missing');
    target='/workflows/run';payload={inputs,user:body.user,response_mode:'streaming'};
  }
  const start=Date.now();let tracked=false,receipt='',receiptHeader={};
  if(path==='/run'&&env.STATS_DB){
    receipt=crypto.randomUUID();tracked=await record(env,'INSERT INTO runs (run_id,started_at,gear_enabled,client_version,workflow_version,proxy_version,receipt_hash) VALUES (?,?,?,?,?,?,?)',[body.user,new Date(start).toISOString(),inputs.gear_budget>0?1:0,version(body.client_version),version(env.WORKFLOW_VERSION),PROXY_VERSION,await hash(receipt)]);
    if(tracked)receiptHeader={'X-Run-Receipt':receipt};
  }
  let finalised=false;
  const finish=async(status,data={},error=null)=>{
    if(!tracked||finalised)return;finalised=true;
    await record(env,'UPDATE runs SET finished_at = ?, status = ?, server_ms = ?, dify_seconds = ?, total_tokens = ?, workflow_run_id = ?, error_code = ? WHERE run_id = ? AND status = ?',[new Date().toISOString(),status,Date.now()-start,finite(data.elapsed_time,86400),finite(data.total_tokens,100000000),typeof data.id==='string'?data.id.slice(0,100):null,error,body.user,'running']);
  };
  const defer=p=>ctx.waitUntil(p.catch(()=>{console.warn('metrics_background_failed')}));
  try{
    const upstream=await fetch('https://api.dify.ai/v1'+target,{method:'POST',headers:{Authorization:'Bearer '+env.DIFY_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:request.signal});
    if(!upstream.ok){await upstream.body?.cancel();defer(finish('failed',{},'upstream_http'));return reply('Upstream planner unavailable',502,receiptHeader)}
    if(path==='/stop'){
      if(env.STATS_DB)defer(record(env,'UPDATE runs SET status = ?, finished_at = ? WHERE run_id = ? AND status = ?',['stopped',new Date().toISOString(),body.user,'running']));
      return new Response(upstream.body,{headers:{...cors,'Content-Type':'application/json'}});
    }
    if(!upstream.body){defer(finish('failed',{},'empty_stream'));return reply('Upstream planner unavailable',502,receiptHeader)}
    if(!tracked)return new Response(upstream.body,{headers:{...cors,'Content-Type':'text/event-stream; charset=utf-8'}});
    const observer=makeObserver(data=>{const s=data.status==='succeeded'?'succeeded':data.status==='stopped'?'stopped':'failed';defer(finish(s,data,s==='failed'?'workflow_failed':null))},()=>defer(finish('failed',{},'workflow_error')));
    const stream=new TransformStream({transform(chunk,controller){controller.enqueue(chunk);observer.push(chunk)},flush(){observer.end();defer(finish('incomplete',{},'stream_ended'))}});
    defer(upstream.body.pipeTo(stream.writable).catch(()=>finish('incomplete',{},'stream_disconnected')));
    return new Response(stream.readable,{headers:{...cors,...receiptHeader,'Content-Type':'text/event-stream; charset=utf-8'}});
  }catch{defer(finish(request.signal.aborted?'stopped':'failed',{},'connection_failed'));return reply('Planner connection failed',502,receiptHeader)}
}};

const ADMIN_HTML=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Little Trail private statistics</title><style>
*{box-sizing:border-box}body{margin:0;background:#e8e7dd;color:#33463b;font:15px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:30px 20px}h1{font:32px Georgia,serif;margin:0}small{display:block;color:#687869}form{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}label{font-size:13px}input,select,button,a{font:inherit;color:inherit}input,select,button{padding:9px;border:1px solid #bbc7b4;border-radius:3px;background:#f5f3e9}button,a{cursor:pointer}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px}.card{padding:15px;background:#f5f3e9}.card b{display:block;font-size:25px}table{border-collapse:collapse;width:100%;font-size:12px;background:#f5f3e9}td,th{border-bottom:1px solid #d3d8c8;padding:9px;text-align:left;overflow-wrap:anywhere}#table-wrap{overflow:auto;margin-top:14px}a{text-underline-offset:3px}.notes{font-size:13px;color:#53634f}#state{min-height:28px}#rows{font-variant-numeric:tabular-nums}details{margin:20px 0}code{word-break:break-all}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #33463b;outline-offset:2px}
</style></head><body><main><h1>Little Trail statistics</h1><small>私人運行統計 · Hong Kong time</small><p class="notes">No form answers, plans, email addresses or IP addresses are stored here.<br>這裡不保存規劃表內容、生成計劃、電郵或 IP 地址。</p>
<form id="filters"><label>Period／期間<br><select name="days"><option value="7">7 days／天</option><option value="30" selected>30 days／天</option><option value="90">90 days／天</option></select></label><label>Shopping／裝備推薦<br><select name="gear"><option value="">All／全部</option><option value="0">Off／關閉</option><option value="1">On／開啟</option></select></label><label>Workflow label／工作流版本標籤<br><input name="version" placeholder="All／全部" maxlength="80"></label><button>Refresh／更新</button></form>
<p id="state" role="status">Loading／載入中</p><div class="cards" id="cards"></div><p><a id="export" href="/admin/export">Download CSV／下載 CSV</a> · <a href="https://formspree.io/forms" target="_blank" rel="noopener noreferrer">Formspree feedback／使用回饋</a></p>
<details><summary>How to read these numbers／如何閱讀</summary><p class="notes">Success rate uses finished runs, excluding currently running requests. Client wait is measured by the browser until the result is prepared on the page; it is client-reported and may be missing if the tab closes or the network fails. Dify time comes from its final event. Tokens are not a currency amount; missing usage is not zero. Stale running requests are shown as incomplete after 15 minutes. Summaries and CSV cover at most the latest 10,000 matching runs; the table shows the latest 200. Labels must be updated when publishing workflow changes.<br>成功率以已結束的執行計算。等待時間由瀏覽器回報至結果完成頁面處理時，關閉分頁或斷線時可能缺失。Dify 用時取自完成事件。Token 不是實際金額，缺少資料不等於零。超過15分鐘仍未結束者顯示為 incomplete。彙總及 CSV 最多涵蓋最近一萬筆，列表顯示最近200筆。修改工作流後需更新版本標籤。</p></details>
<div id="table-wrap"><table><thead><tr><th>Time／時間</th><th>Run reference／執行編號</th><th>Status／狀態</th><th>Dify s／秒</th><th>Client s／等待秒數</th><th>Tokens</th><th>Gear／裝備</th><th>Workflow／版本</th><th>Client／前端</th></tr></thead><tbody id="rows"></tbody></table></div></main>
<script>
const $=s=>document.querySelector(s);const fmt=v=>v===null||v===undefined?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
const time=s=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',dateStyle:'short',timeStyle:'medium'}).format(new Date(s));
async function load(){const query=new URLSearchParams(new FormData($('#filters')));$('#export').href='/admin/export?'+query;$('#state').textContent='Loading／載入中';try{const res=await fetch('/admin/data?'+query,{cache:'no-store'});if(!res.ok)throw Error();const data=await res.json(),s=data.summary;$('#cards').replaceChildren();for(const [label,value] of [['Runs／執行次數',fmt(s.runs)],['Success／成功率',s.success_rate===null?'—':(100*s.success_rate).toFixed(1)+'%'],['Median Dify s／後端中位秒數',fmt(s.median_dify_seconds)],['Median wait s／等待中位秒數',fmt(s.median_client_seconds)],['Tokens／總用量',fmt(s.total_tokens)],['Wait samples／等待樣本數',fmt(s.client_samples)]]){const c=document.createElement('div');c.className='card';const b=document.createElement('b');b.textContent=value;c.append(b,document.createTextNode(label));$('#cards').append(c)}$('#rows').replaceChildren();for(const r of data.rows.slice(0,200)){const tr=document.createElement('tr');for(const v of [time(r.started_at),r.run_id,r.status,fmt(r.dify_seconds),r.client_wait_ms===null?'—':fmt(r.client_wait_ms/1000),fmt(r.total_tokens),r.gear_enabled?'On':'Off',r.workflow_version,r.client_version]){const td=document.createElement('td');td.textContent=v;tr.append(td)}$('#rows').append(tr)}$('#state').textContent=(data.limited?'Latest 10,000 matches only／僅最近一萬筆。 ':'')+'Updated／已更新 · Token samples／用量樣本 '+s.token_samples+'/'+s.runs}catch{$('#state').textContent='Could not load statistics. Check database configuration.／未能載入，請檢查資料庫設定。'}}
$('#filters').addEventListener('submit',e=>{e.preventDefault();load()});load();
</script></body></html>`;

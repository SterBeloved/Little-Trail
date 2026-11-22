import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker,{makeObserver,summarise} from './worker.js';
const origin='https://sterbeloved.github.io';
const user='web-11111111-1111-4111-a111-111111111111';
const inputs={departure_point:'PRIVATE PLACE',hike_date:'2026-11-29',available_hours:8,hiking_party:'With others',last_hike_effort:'4',trip_budget:200,exercise_habits:'PRIVATE HABIT'};
function setup(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 const adapter={prepare(sql){let args=[];return {bind(...v){args=v;return this},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}}},async all(){return {results:db.prepare(sql).all(...args)}}}}};
 const pending=[];const ctx={waitUntil(p){pending.push(p)}};
 return {db,env:{STATS_DB:adapter,DIFY_API_KEY:'test-only',ALLOWED_ORIGINS:origin,PLANNER_LIMITER:{limit:async()=>({success:true})},WORKFLOW_VERSION:'test-v1',ADMIN_PASSWORD:'test-only-password-at-least-24-characters'},ctx,async drain(){while(pending.length)await Promise.all(pending.splice(0))}};
}
const req=(path,body,headers={})=>new Request('https://test.invalid'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
function mockUpstream(t,text){const old=globalThis.fetch;globalThis.fetch=async()=>new Response(text,{headers:{'Content-Type':'text/event-stream'}});t.after(()=>{globalThis.fetch=old})}
const end='data: '+JSON.stringify({event:'workflow_finished',data:{id:'workflow-test-id',status:'succeeded',elapsed_time:12.5,total_tokens:1234,outputs:{travel_plan:'PRIVATE PLAN'}}})+'\n\n';
test('SSE inspection handles split UTF-8, CRLF, comments and ignores node data',()=>{
 let seen;const observer=makeObserver(d=>{seen=d},()=>assert.fail());
 const bytes=new TextEncoder().encode(': ping\r\n\r\ndata: '+JSON.stringify({event:'node_finished',data:{text:'私密'}})+'\r\n\r\n'+end);
 for(let i=0;i<bytes.length;i+=3)observer.push(bytes.slice(i,i+3));observer.end();assert.equal(seen.total_tokens,1234);
});
test('SSE frame memory bound does not prevent reading subsequent final event',()=>{
 let count=0;const o=makeObserver(()=>count++,()=>{});o.push(new TextEncoder().encode('data: '+ 'x'.repeat(300000)+'\n\n'+end));o.end();assert.equal(count,1);
});
test('successful stream is byte-identical and stores metadata without personal text',async t=>{
 const s=setup();mockUpstream(t,'data: '+JSON.stringify({event:'node_finished',data:{inputs}})+'\n\n'+end);
 const res=await worker.fetch(req('/run',{user,inputs,client_version:'client-v1'}),s.env,s.ctx);const receipt=res.headers.get('X-Run-Receipt');assert.ok(receipt);const raw=await res.text();assert.ok(raw.endsWith(end));await s.drain();
 const row=s.db.prepare('SELECT * FROM runs').get();assert.equal(row.status,'succeeded');assert.equal(row.total_tokens,1234);assert.equal(row.dify_seconds,12.5);assert.equal(row.gear_enabled,0);assert.equal(row.client_wait_ms,null);assert.ok(!JSON.stringify(row).includes('PRIVATE'));
 const metric={user,receipt,wait_ms:14500,outcome:'result_ready'};
 await worker.fetch(req('/metrics',{...metric,receipt:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}),s.env,s.ctx);assert.equal(s.db.prepare('SELECT client_wait_ms FROM runs').get().client_wait_ms,null);
 assert.equal((await worker.fetch(req('/metrics',metric),s.env,s.ctx)).status,204);
 await worker.fetch(req('/metrics',{...metric,wait_ms:999}),s.env,s.ctx);assert.equal(s.db.prepare('SELECT client_wait_ms FROM runs').get().client_wait_ms,14500);
});
test('missing final event is incomplete, not counted as success',async t=>{
 const s=setup();mockUpstream(t,'data: {"event":"ping"}\n\n');const res=await worker.fetch(req('/run',{user,inputs:{...inputs,gear_budget:400}}),s.env,s.ctx);await res.text();await s.drain();const r=s.db.prepare('SELECT * FROM runs').get();assert.equal(r.status,'incomplete');assert.equal(r.gear_enabled,1);assert.equal(r.total_tokens,null);
});
test('upstream failures are recorded with a generic code',async t=>{
 const s=setup();const old=globalThis.fetch;globalThis.fetch=async()=>new Response('SECRET',{status:500});t.after(()=>globalThis.fetch=old);
 const res=await worker.fetch(req('/run',{user,inputs}),s.env,s.ctx);assert.equal(res.status,502);assert.ok(!await res.text().then(s=>s.includes('SECRET')));await s.drain();assert.equal(s.db.prepare('SELECT status FROM runs').get().status,'failed');
});
test('statistics failure does not break generation',async t=>{
 const s=setup();s.env.STATS_DB={prepare(){throw Error('database unavailable')}};mockUpstream(t,end);const res=await worker.fetch(req('/run',{user,inputs}),s.env,s.ctx);assert.equal(res.status,200);assert.equal(res.headers.get('X-Run-Receipt'),null);assert.equal(await res.text(),end);
});
test('styled login protects data and issues revocable sessions',async()=>{
 const s=setup();const call=(p,headers={})=>worker.fetch(new Request('https://test.invalid'+p,{headers}),s.env,s.ctx);
 const page=await call('/admin');assert.equal(page.status,200);assert.equal(page.headers.get('WWW-Authenticate'),null);assert.match(await page.text(),/login-card/);
 for(const p of ['/admin/data','/admin/export'])assert.equal((await call(p)).status,401);
 const login=(password,Origin='https://test.invalid')=>worker.fetch(new Request('https://test.invalid/admin/login',{method:'POST',headers:{Origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password})}),s.env,s.ctx);
 assert.equal((await login('wrong')).status,401);assert.equal((await login(s.env.ADMIN_PASSWORD,'https://wrong.invalid')).status,403);
 const signed=await login(s.env.ADMIN_PASSWORD);assert.equal(signed.status,303);const cookie=signed.headers.get('Set-Cookie');for(const flag of ['Secure','HttpOnly','SameSite=Strict','Max-Age=28800'])assert.ok(cookie.includes(flag));const headers={Cookie:cookie.split(';')[0]};
 const yes=await call('/admin/data',headers);assert.equal(yes.status,200);assert.deepEqual((await yes.json()).rows,[]);
 assert.equal((await call('/admin/data?version=%27%20OR%201=1',headers)).status,400);
 assert.equal((await call('/admin/data',{Cookie:headers.Cookie+'broken'})).status,401);
 const logout=await worker.fetch(new Request('https://test.invalid/admin/logout',{method:'POST',headers:{Origin:'https://test.invalid',...headers}}),s.env,s.ctx);assert.equal(logout.status,303);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
 s.env.ADMIN_PASSWORD+='rotated';assert.equal((await call('/admin/data',headers)).status,401);
 assert.equal((await worker.fetch(new Request('https://test.invalid/admin'),{...s.env,ADMIN_PASSWORD:undefined},s.ctx)).status,503);
});
test('summary keeps missing values distinct from zero and uses finished runs',()=>{
 const r=summarise([{status:'succeeded',dify_seconds:10,total_tokens:0,client_wait_ms:12000,client_outcome:'result_ready'},{status:'succeeded',dify_seconds:20,total_tokens:100,client_wait_ms:null},{status:'failed',dify_seconds:null,total_tokens:null,client_wait_ms:1000},{status:'running',dify_seconds:null,total_tokens:null,client_wait_ms:null}]);assert.equal(r.success_rate,2/3);assert.equal(r.median_dify_seconds,15);assert.equal(r.median_client_seconds,12);assert.equal(r.token_samples,2);assert.equal(r.total_tokens,100);
});
test('foreign origins, invalid inputs and missing limiter cannot invoke paid planner',async()=>{
 const s=setup();assert.equal((await worker.fetch(req('/run',{user,inputs},{Origin:'https://wrong.invalid'}),s.env,s.ctx)).status,403);assert.equal((await worker.fetch(req('/run',{user,inputs:{}}),s.env,s.ctx)).status,400);assert.equal((await worker.fetch(req('/run',{user,inputs}),{...s.env,PLANNER_LIMITER:undefined},s.ctx)).status,503);
});

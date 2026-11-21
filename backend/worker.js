// Cloudflare Worker. Store DIFY_API_KEY as a Worker secret, never in GitHub.
const allowedKeys=['preferred_route','departure_point','hike_date','available_hours','hiking_party','last_hike','last_hike_effort','exercise_habits','trip_budget','gear_budget','gear_details','preferences_requests'];
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!origin||!allowed.includes(origin))return new Response('Origin not allowed',{status:403});
 const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
 const reply=(s,status=400)=>new Response(JSON.stringify({error:s}),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply('Method not allowed',405);
 if(!env.DIFY_API_KEY)return reply('Planner not configured',503);
 // Required rate limit binding; fail closed instead of exposing an unlimited paid endpoint.
 if(!env.PLANNER_LIMITER)return reply('Rate limiting not configured',503);
 const limit=await env.PLANNER_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});
 if(!limit.success)return reply('Please wait before trying again',429);
 let body;try{const raw=await request.text();if(raw.length>12000)return reply('Request too large',413);body=JSON.parse(raw)}catch{return reply('Invalid request')}
 if(typeof body.user!=='string'||!/^web-[a-zA-Z0-9-]{10,80}$/.test(body.user))return reply('Invalid user');
 const path=new URL(request.url).pathname;
 let target,payload;
 if(path==='/stop'){if(typeof body.task_id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(body.task_id))return reply('Invalid task');target='/workflows/tasks/'+encodeURIComponent(body.task_id)+'/stop';payload={user:body.user}}
 else if(path==='/run'){
 const input=body.inputs;if(!input||typeof input!=='object'||Array.isArray(input))return reply('Invalid inputs');const inputs={};
 for(const k of allowedKeys)if(k in input){const v=input[k];if(['available_hours','trip_budget','gear_budget'].includes(k)){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000)return reply('Invalid number');inputs[k]=v}else{if(typeof v!=='string'||v.length>2000)return reply('Invalid text');inputs[k]=v}}
 if(!inputs.departure_point?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(inputs.hike_date||'')||!inputs.hiking_party||!inputs.last_hike_effort||!(inputs.available_hours>=1&&inputs.available_hours<=24)||!(inputs.trip_budget>0))return reply('Required details missing');
 target='/workflows/run';payload={inputs,user:body.user,response_mode:'streaming'};
 }else return reply('Not found',404);
 try{const upstream=await fetch('https://api.dify.ai/v1'+target,{method:'POST',headers:{'Authorization':'Bearer '+env.DIFY_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:request.signal});if(!upstream.ok){await upstream.body?.cancel();return reply('Upstream planner unavailable',502)}return new Response(upstream.body,{status:200,headers:{...cors,'Content-Type':path==='/run'?'text/event-stream; charset=utf-8':'application/json','X-Content-Type-Options':'nosniff'}})}catch{return reply('Planner connection failed',502)}
}};

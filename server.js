/** C&M Neighborhood Services — zero-dependency Node.js backend. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data', 'requests.json');
const ENV_FILE = path.join(ROOT, '.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      let v=m[2].trim(); if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
      process.env[m[1]]=v;
    }
  }
}
const PORT=Number(process.env.PORT)||3000;
const SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const ADMIN_CODE=process.env.ADMIN_CODE||'';
const SUPABASE_URL=(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const SUPABASE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const DB_ENABLED=Boolean(SUPABASE_URL&&SUPABASE_KEY);
const RESEND_API_KEY=process.env.RESEND_API_KEY||'';
const FROM_EMAIL=process.env.FROM_EMAIL||'';
const NOTIFICATION_EMAIL=process.env.NOTIFICATION_EMAIL||'';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
const rate=new Map();
function json(res,status,obj,headers={}){const body=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body)}
function clientIP(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim()}
function allowed(key,max,windowMs){const now=Date.now(),entry=rate.get(key)||{start:now,count:0};if(now-entry.start>windowMs){entry.start=now;entry.count=0}entry.count++;rate.set(key,entry);if(rate.size>5000)for(const [k,v] of rate)if(now-v.start>windowMs)rate.delete(k);return entry.count<=max}
async function bodyJson(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>60_000)throw Error('Request too large');parts.push(chunk)};try{return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}')}catch{throw Error('Invalid JSON')}}
function sig(payload){return crypto.createHmac('sha256',SECRET).update(payload).digest('base64url')}
function makeToken(){const payload=Buffer.from(JSON.stringify({exp:Date.now()+7*24*3600_000,nonce:crypto.randomBytes(12).toString('hex')})).toString('base64url');return payload+'.'+sig(payload)}
function admin(req){if(!ADMIN_CODE)return false;const cookies=req.headers.cookie||'';const match=cookies.match(/(?:^|;\s*)cm_admin=([^;]*)/);if(!match)return false;const token=decodeURIComponent(match[1]);const parts=token.split('.');if(parts.length!==2)return false;const expected=sig(parts[0]);if(parts[1].length!==expected.length||!crypto.timingSafeEqual(Buffer.from(parts[1]),Buffer.from(expected)))return false;try{return JSON.parse(Buffer.from(parts[0],'base64url').toString()).exp>Date.now()}catch{return false}}
function cookie(token,req){const secure=(req.headers['x-forwarded-proto']==='https'||req.socket.encrypted)?'; Secure':'';return `cm_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`}
async function supabase(method,endpoint,data){const response=await fetch(`${SUPABASE_URL}/rest/v1/cm_requests${endpoint}`,{method,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(12_000)});if(!response.ok)throw Error('Database error '+response.status);return await response.json()}
async function loadRecords(){if(DB_ENABLED){const rows=await supabase('GET','?select=payload&order=created_at.desc');return rows.map(r=>r.payload)}try{return JSON.parse(await fsp.readFile(DATA,'utf8'))}catch(e){if(e.code==='ENOENT')return [];throw e}}
let queue=Promise.resolve();
function synchronized(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next}
async function saveRecord(record){if(DB_ENABLED){await supabase('POST','',[{id:record.id,created_at:record.createdAt,payload:record}]);return}return synchronized(async()=>{const items=await loadRecords();items.push(record);await fsp.mkdir(path.dirname(DATA),{recursive:true});await fsp.writeFile(DATA+'.tmp',JSON.stringify(items,null,2));await fsp.rename(DATA+'.tmp',DATA)})}
async function updateRecord(id,patch){if(DB_ENABLED){const rows=await supabase('GET',`?select=payload&id=eq.${encodeURIComponent(id)}&limit=1`);if(!rows[0])return null;const updated={...rows[0].payload,...patch,updatedAt:new Date().toISOString()};await supabase('PATCH',`?id=eq.${encodeURIComponent(id)}`,{payload:updated});return updated}return synchronized(async()=>{const items=await loadRecords();const i=items.findIndex(x=>x.id===id);if(i<0)return null;items[i]={...items[i],...patch,updatedAt:new Date().toISOString()};await fsp.writeFile(DATA+'.tmp',JSON.stringify(items,null,2));await fsp.rename(DATA+'.tmp',DATA);return items[i]})}
async function sendEmail(to,subject,text){if(!RESEND_API_KEY||!FROM_EMAIL)return {sent:false,reason:'Email service not configured'};const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:FROM_EMAIL,to:[to],subject,text,reply_to:NOTIFICATION_EMAIL||undefined}),signal:AbortSignal.timeout(12_000)});if(!response.ok){console.error('Email provider rejected request:',response.status);return {sent:false,reason:'Email provider rejected request'}}return {sent:true}}
function safeString(v,max=500){return typeof v==='string'?v.trim().slice(0,max):''}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<250}
const SERVICES=['Lawn Mowing','Leaf Cleanup','Car Washing','Garden Weeding','Trash Bin Cleaning','Yard Work','Gutter Cleaning'];
async function route(req,res){const url=new URL(req.url,'http://localhost');const pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/health')return json(res,200,{ok:true,version:'v3-visible-multi-service',storage:DB_ENABLED?'cloud':'local'});
  if(req.method==='POST'&&pathname==='/api/request'){
    if(!allowed('request:'+clientIP(req),8,60*60_000))return json(res,429,{error:'Too many requests. Please try again later.'});
    const b=await bodyJson(req);if(b.website)return json(res,200,{ok:true});
    const fullName=safeString(b.fullName,100),email=safeString(b.email,200),phone=safeString(b.phone,40),details=safeString(b.details,1400),preferredDate=safeString(b.preferredDate,20);
    // Accept the new multi-service array and the older one-service form for compatibility.
    const rawServices=Array.isArray(b.services)?b.services:(typeof b.service==='string'?[b.service]:[]);
    const services=rawServices.map(v=>safeString(v,80));
    if(fullName.length<2||!validEmail(email)||!/^\+?[\d\s().-]{7,25}$/.test(phone)||details.length<5||!services.length||services.length>SERVICES.length||new Set(services).size!==services.length||services.some(s=>!SERVICES.includes(s)))return json(res,400,{error:'Please enter valid contact information, select one or more services, and describe your job.'});
    if(preferredDate&&!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate))return json(res,400,{error:'Invalid preferred date.'});
    const service=services.join(', ');
    const record={id:crypto.randomUUID(),createdAt:new Date().toISOString(),fullName,email,phone,services,service,details,preferredDate,status:'New',price:'',scheduledDate:'',notes:''};
    await saveRecord(record);
    if(NOTIFICATION_EMAIL)sendEmail(NOTIFICATION_EMAIL,`New C&M job request: ${service}`,`New request received\n\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone}\nServices: ${services.join(', ')}\nPreferred date: ${preferredDate||'Flexible'}\nDetails: ${details}\n\nOpen your admin dashboard to manage the request.`).catch(e=>console.error('Notification failed:',e.message));
    return json(res,201,{ok:true,message:'Your request has been sent! We will contact you about pricing and availability.'});
  }
  if(req.method==='POST'&&pathname==='/api/admin/login'){
    if(!allowed('login:'+clientIP(req),12,15*60_000))return json(res,429,{error:'Too many attempts. Please try later.'});
    const b=await bodyJson(req);const submitted=safeString(b.code,256);
    if(!ADMIN_CODE)return json(res,503,{error:'Set ADMIN_CODE in the server .env file first.'});
    const a=Buffer.from(crypto.createHash('sha256').update(submitted).digest());const c=Buffer.from(crypto.createHash('sha256').update(ADMIN_CODE).digest());
    if(!submitted||!crypto.timingSafeEqual(a,c))return json(res,401,{error:'Incorrect editing code.'});
    return json(res,200,{ok:true},{'Set-Cookie':cookie(makeToken(),req)});
  }
  if(req.method==='POST'&&pathname==='/api/admin/logout')return json(res,200,{ok:true},{'Set-Cookie':'cm_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
  if(pathname.startsWith('/api/admin/')){
    if(!admin(req))return json(res,401,{error:'Please log in to your admin dashboard.'});
    if(req.method==='GET'&&pathname==='/api/admin/me')return json(res,200,{ok:true});
    if(req.method==='GET'&&pathname==='/api/admin/requests'){const list=await loadRecords();return json(res,200,{items:list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),emailConfigured:Boolean(RESEND_API_KEY&&FROM_EMAIL)});}
    const updateMatch=pathname.match(/^\/api\/admin\/requests\/([\w-]+)$/);
    if(req.method==='PATCH'&&updateMatch){const b=await bodyJson(req);const status=safeString(b.status,30);if(!['New','Contacted','Scheduled','Completed','Cancelled'].includes(status))return json(res,400,{error:'Invalid status'});const record=await updateRecord(updateMatch[1],{status,price:safeString(b.price,80),scheduledDate:safeString(b.scheduledDate,20),notes:safeString(b.notes,1500)});return record?json(res,200,{ok:true,item:record}):json(res,404,{error:'Request not found'});}
    if(req.method==='POST'&&pathname==='/api/admin/reply'){const b=await bodyJson(req);const item=(await loadRecords()).find(x=>x.id===b.id);if(!item)return json(res,404,{error:'Request not found'});const subject=`C&M Neighborhood Services — ${(item.services||[item.service]).join(", ")} Request`;const msg=safeString(b.message,4000);if(msg.length<10)return json(res,400,{error:'Write a reply first.'});const result=await sendEmail(item.email,subject,msg);return json(res,200,{...result,subject,message:msg});}
    return json(res,404,{error:'Not found'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
  const requested=pathname==='/'?'/index.html':pathname==='/admin'?'/admin.html':pathname;
  let file=path.resolve(PUBLIC,'.'+decodeURIComponent(requested));if(file!==PUBLIC&&!file.startsWith(PUBLIC+path.sep))return json(res,403,{error:'Forbidden'});
  try{const stat=await fsp.stat(file);if(!stat.isFile())return json(res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"frame-ancestors 'none'"});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)}catch(e){if(e.code==='ENOENT')return json(res,404,{error:'Not found'});throw e}
}
http.createServer((req,res)=>route(req,res).catch(e=>{console.error('Server:',e.message);if(!res.headersSent)json(res,500,{error:'Something went wrong. Please try again.'});else res.end()})).listen(PORT,'0.0.0.0',()=>{console.log(`C&M website: http://localhost:${PORT}`);if(!ADMIN_CODE)console.warn('Admin login disabled: set ADMIN_CODE in .env');if(!DB_ENABLED)console.warn('Using local file storage. Configure Supabase for reliable public hosting.');});

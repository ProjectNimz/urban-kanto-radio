import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
export function sameOrigin(request){try{return request.headers.get('origin')===new URL(request.url).origin}catch{return false}}
export async function readJSON(request,max=8192){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON required');
 if(Number(request.headers.get('content-length'))>max)throw Error('Payload too large');
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');
 const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('Payload too large')}chunks.push(value)}}finally{reader.releaseLock()}
 const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Object required');return value;
}
export function equal(a,b){return timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest())}
const secret=()=>process.env.UKR_DJ_SESSION_SECRET||'';
export function adminConfigured(){return (process.env.UKR_DJ_PASSWORD||'').length>=16&&secret().length>=32}
export function admin(request){
 if(!adminConfigured())return false;
 const token=request.headers.get('cookie')?.match(/(?:^|; )ukr_dj_session=([^;]+)/)?.[1];if(!token)return false;
 const [body,sig,...extra]=token.split('.');if(!body||!sig||extra.length)return false;
 if(!equal(sig,createHmac('sha256',secret()).update(body).digest('base64url')))return false;
 try{const data=JSON.parse(Buffer.from(body,'base64url').toString());return data.station==='ukr'&&Number.isFinite(data.exp)&&data.exp>Date.now()}catch{return false}
}
export function sessionCookie(){const body=Buffer.from(JSON.stringify({station:'ukr',exp:Date.now()+43200000})).toString('base64url');return `ukr_dj_session=${body}.${createHmac('sha256',secret()).update(body).digest('base64url')}; Max-Age=43200; Path=/; HttpOnly; Secure; SameSite=Strict`}
export const clearCookie='ukr_dj_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict';

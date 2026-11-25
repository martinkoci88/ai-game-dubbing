const page = `<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Game Dubbing</title><style>body{font:18px system-ui;background:#111827;color:white;max-width:600px;margin:40px auto;padding:20px}input,textarea,button{box-sizing:border-box;width:100%;padding:14px;margin:8px 0;font:inherit;border-radius:8px}button{background:#2563eb;color:white;border:0}</style><h1>AI Game Dubbing</h1><input id="token" type="password" placeholder="Přístupový token"><textarea id="source" placeholder="Anglický titulek"></textarea><button id="go">Přeložit a nadabovat</button><p id="out"></p><audio id="audio" controls></audio><script>let url;document.querySelector('#go').onclick=async()=>{const b=document.querySelector('#go'),o=document.querySelector('#out');b.disabled=true;try{o.textContent='Překládám…';const r=await fetch('/dub',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+document.querySelector('#token').value},body:JSON.stringify({text:document.querySelector('#source').value})});const d=await r.json();if(!r.ok)throw Error(d.error);o.textContent=d.translation;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(new Blob([Uint8Array.from(atob(d.audio),c=>c.charCodeAt(0))],{type:'audio/mpeg'}));const a=document.querySelector('#audio');a.src=url;await a.play().catch(()=>{});}catch(e){o.textContent=e.message;}finally{b.disabled=false;}};</script></html>`;
export default {async fetch(req,env){
const path=new URL(req.url).pathname;
if(req.method==='GET'&&path==='/')return new Response(page,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
if(path!=='/dub'||req.method!=='POST')return json({error:'Nenalezeno'},404);
if(!env.APP_TOKEN||req.headers.get('Authorization')!=='Bearer '+env.APP_TOKEN)return json({error:'Neplatný token'},401);
try{
if(!env.AI||!env.ELEVENLABS_API_KEY||!env.ELEVENLABS_VOICE_ID)return json({error:'Chybí konfigurace serveru'},503);
const {text}=await req.json();if(typeof text!=='string'||!text.trim()||text.length>500)return json({error:'Zadej 1–500 znaků'},400);
const result=await env.AI.run('@cf/meta/m2m100-1.2b',{text,source_lang:'en',target_lang:'cs'});
const translation=result.translated_text;if(!translation)throw Error('translation');
const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(env.ELEVENLABS_VOICE_ID),{method:'POST',headers:{'xi-api-key':env.ELEVENLABS_API_KEY,'Content-Type':'application/json','Accept':'audio/mpeg'},body:JSON.stringify({text:translation,model_id:'eleven_multilingual_v2'})});
if(!r.ok)return json({error:'Syntéza hlasu selhala ('+r.status+')'},502);
const bytes=new Uint8Array(await r.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
return json({translation,audio:btoa(binary)});
}catch{return json({error:'Překlad nebo dabing selhal'},502);}
}};

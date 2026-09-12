const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
async function check(source, expired=false) {
 let requests=0;
 const session={access_token:'header.payload.signature',expires_at:expired?0:Date.now()/1000+3600};
 const client={auth:{getSession:async()=>({data:{session}}),refreshSession:async()=>({data:{session:{access_token:'fresh.payload.signature',expires_at:Date.now()/1000+3600}}})}};
 class Upload {
  constructor(body,options){this.o=options;}
  findPreviousUploads(){return Promise.resolve([]);}
  async start(){try{for(let i=0;i<2;i++){
   const headers={};
   const req={setHeader(k,v){k=k.toLowerCase();headers[k]=headers[k]?headers[k]+', '+v:v;}};
   for(const [k,v] of Object.entries(this.o.headers))req.setHeader(k,v);
   await this.o.onBeforeRequest(req);
   assert.equal(headers.authorization,expired?'Bearer fresh.payload.signature':'Bearer header.payload.signature');
   assert.equal(headers.apikey,'sb_publishable_test');requests++;
  }this.o.onSuccess();}catch(e){this.o.onError(e);}}
 }
 const exports={};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>n==='tus-js-client'?{Upload}:{supabase:client},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}},DOMException,Date});
 await exports.uploadResumable({bucket:'chat-media',path:'friend/test/file',body:new Blob(['test']),contentType:'application/octet-stream'});
 assert.equal(requests,2);
}
(async()=>{
 const source=fs.readFileSync('lib/resumable-upload.ts','utf8');
 await check(source);await check(source,true);
 const old=source.replace("headers:{'x-upsert':'false'}","headers:{authorization:`Bearer ${token}`,apikey:key,'x-upsert':'false'}");
 assert.notEqual(old,source);await assert.rejects(check(old));
 console.log('PASS: single auth headers on creation/chunks, refreshed session; pre-fix duplicate regression reproduced.');
})().catch(e=>{console.error(e);process.exit(1);});

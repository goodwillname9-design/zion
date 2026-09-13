const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function setup({downloadFails=false,missingKey=false}={}){
 let consumed=false,claims=0,downloads=0;
 const item={media_path:'friend/test/media',view_once:true,viewed_at:null,sender_id:'sender',friendship_id:'room',deleted_at:null};
 const client={auth:{getUser:async()=>({data:{user:{id:'recipient'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:item})})})}),rpc:async(name)=>{if(name==='is_friendship_member')return {data:true};claims++;if(consumed)return {error:{code:'P0001'}};consumed=true;assert(downloads>0);return {data:item.media_path}}};
 const service={storage:{from:()=>({download:async()=>{downloads++;return downloadFails?{error:{}}:{data:new Blob(['encrypted'])}},remove:async()=>{throw Error('delete unavailable')}})}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/view-once/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>n==='next/server'?{NextResponse:class extends Response{static json(v,init){return new Response(JSON.stringify(v),init)}}}:{createClient:(u,k)=>k==='secret'?service:client},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:missingKey?'':'secret'}},Response,Blob});
 const request=()=>new Request('https://example.test/api/view-once',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({id:'12'})});
 return {post:()=>exports.POST(request()),claims:()=>claims};
}
(async()=>{
 let s=setup({downloadFails:true});assert.equal((await s.post()).status,502);assert.equal(s.claims(),0);
 s=setup({missingKey:true});assert.equal((await s.post()).status,503);assert.equal(s.claims(),0);
 s=setup();const responses=await Promise.all([s.post(),s.post()]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,410]);assert.equal(await responses.find(r=>r.status===200).text(),'encrypted');
 console.log('PASS: storage failure leaves unconsumed; missing configuration; concurrent delivery once only; removal failure preserves delivery; string ID accepted.');
})().catch(e=>{console.error(e);process.exit(1)});

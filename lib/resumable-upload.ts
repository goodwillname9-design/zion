'use client';
import * as tus from 'tus-js-client';
import { supabase } from '@/lib/supabase';
export async function uploadResumable({bucket,path,body,contentType,onProgress,signal}:{bucket:string;path:string;body:Blob;contentType:string;onProgress?:(percentage:number)=>void;signal?:AbortSignal}){
 if(!supabase)throw new Error('Storage is not configured.');const client=supabase;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Storage configuration is missing.');
 if(signal?.aborted)throw new DOMException('Upload cancelled','AbortError');
 let {data}=await client.auth.getSession();if(!data.session?.access_token){const refreshed=await client.auth.refreshSession();data=refreshed.data;}
 let token=data.session?.access_token;if(!token)throw new Error('Sign in again before uploading.');
 // Authentication headers are set only in onBeforeRequest: XHR appends duplicate values.
 // Only one transport: never restart a cancelled/failed resumable upload as an uncancellable request.
 await new Promise<void>((resolve,reject)=>{
  let settled=false;
  const finish=(error?:Error)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',cancel);if(error)reject(error);else resolve();};
  const upload=new tus.Upload(body,{endpoint:`${url.replace(/\/$/,'')}/storage/v1/upload/resumable`,retryDelays:[0,1000,3000,5000,10000],headers:{'x-upsert':'false'},
   uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
   metadata:{bucketName:bucket,objectName:path,contentType,cacheControl:'3600'},
   onBeforeRequest:async request=>{if(signal?.aborted)throw new DOMException('Upload cancelled','AbortError');const current=await client.auth.getSession();if((current.data.session?.expires_at??0)*1000<Date.now()+60000){const refreshed=await client.auth.refreshSession();token=refreshed.data.session?.access_token??token;}else token=current.data.session?.access_token??token;request.setHeader('authorization',`Bearer ${token}`);request.setHeader('apikey',key);},
   onProgress:(done,total)=>{if(!settled)onProgress?.(total?Math.round(done/total*100):0);},onError:error=>finish(error),onSuccess:()=>finish()});
  const cancel=()=>{void upload.abort(true).catch(()=>{});finish(new DOMException('Upload cancelled','AbortError'));};
  signal?.addEventListener('abort',cancel,{once:true});
  void upload.findPreviousUploads().then(previous=>{if(signal?.aborted){cancel();return;}if(previous[0])upload.resumeFromPreviousUpload(previous[0]);upload.start();}).catch(error=>finish(error));
 });
}

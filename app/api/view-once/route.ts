import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!secret)return NextResponse.json({error:'Secure media delivery is not configured.'},{status:503});
 const token=request.headers.get('authorization');if(!token?.startsWith('Bearer '))return new NextResponse(null,{status:401});
 const client=createClient(url,key,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:auth,error:authError}=await client.auth.getUser(token.slice(7));if(authError||!auth.user)return new NextResponse(null,{status:401});
 let id:unknown;try{id=(await request.json()).id;}catch{return new NextResponse(null,{status:400});}
 if(typeof id!=='number'||!Number.isSafeInteger(id)||id<=0)return new NextResponse(null,{status:400});
 const {data:path,error}=await client.rpc('claim_zion_once',{p_id:id});if(error||typeof path!=='string')return NextResponse.json({error:'Media already opened or unavailable. View-once supports files up to 4 MB.'},{status:410});
 const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:blob,error:downloadError}=await service.storage.from('chat-media').download(path);
 if(downloadError||!blob)return NextResponse.json({error:'Delivery failed. This view-once item cannot be reopened.'},{status:410});
 if(blob.size>4194304)return new NextResponse(null,{status:413});
 // Claim is atomic; no reusable storage URL is sent to the recipient.
 const headers={'Content-Type':'application/octet-stream','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
 await service.storage.from('chat-media').remove([path]);
 return new NextResponse(await blob.arrayBuffer(),{status:200,headers});
}

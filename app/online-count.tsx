'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import {ZION_CEO_ID} from '@/lib/ceo';

// Every signed-in account sends a quiet heartbeat so the CEO's number is accurate.
// Only the CEO account ever asks for, receives or sees the count (the database enforces this too).
export default function OnlineCount(){
 const [count,setCount]=useState<number|null>(null),[account,setAccount]=useState<string|null>(null);
 const pathname=usePathname();
 useEffect(()=>{
  const client=supabase;if(!client)return;
  let stopped=false,inFlight=false,generation=0;let uid:string|null=null;
  const beat=async()=>{
   if(stopped||inFlight||!uid||document.visibilityState!=='visible')return;
   inFlight=true;const version=generation;const isCeo=uid===ZION_CEO_ID;
   try{
    if(isCeo){
     const {data,error}=await client.rpc('zion_online_count').abortSignal(AbortSignal.timeout(8000));
     if(!stopped&&version===generation)setCount(!error&&data!==null&&Number.isSafeInteger(Number(data))?Number(data):null);
    }else{
     await client.rpc('zion_online_ping').abortSignal(AbortSignal.timeout(8000));
    }
   }catch{if(!stopped&&version===generation)setCount(null);}finally{inFlight=false;}
  };
  const session=(id:string|null)=>{if(stopped)return;if(uid!==id){generation++;uid=id;setAccount(id);setCount(null);}void beat();};
  const {data:listener}=client.auth.onAuthStateChange((_event,s)=>{session(s?.user.id??null);});
  const timer=window.setInterval(()=>void beat(),30000);
  const visibility=()=>{if(document.visibilityState==='visible')void beat();else setCount(null);};
  document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;generation++;window.clearInterval(timer);listener.subscription.unsubscribe();document.removeEventListener('visibilitychange',visibility);};
 },[]);
 if(account!==ZION_CEO_ID||count===null||pathname==='/city'||pathname==='/forest'||pathname==='/meeting')return null;
 return <aside className="zion-online-count" aria-label={`${count} accounts online recently`} title="CEO only · accounts active in the last 90 seconds, refreshed every 30 seconds."><i aria-hidden="true"/>{count.toLocaleString()} <span>Online now</span></aside>;
}

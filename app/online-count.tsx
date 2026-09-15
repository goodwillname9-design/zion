'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {supabase} from '@/lib/supabase';
export default function OnlineCount(){
 const [count,setCount]=useState<number|null>(null),[account,setAccount]=useState<string|null>(null);
 const pathname=usePathname();
 useEffect(()=>{
  const client=supabase;if(!client)return;
  let stopped=false,inFlight=false,generation=0;let uid:string|null=null;
  const update=async()=>{
   if(stopped||inFlight||!uid||document.visibilityState!=='visible')return;
   inFlight=true;const version=generation;
   try{const {data,error}=await client.rpc('zion_online_count').abortSignal(AbortSignal.timeout(8000));
    if(!stopped&&version===generation)setCount(!error&&Number.isSafeInteger(Number(data))&&data!==null?Number(data):null);
   }catch{if(!stopped&&version===generation)setCount(null);}finally{inFlight=false;}
  };
  const session=(id:string|null)=>{if(stopped)return;if(uid!==id){generation++;uid=id;setAccount(id);setCount(null);}void update();};
  const {data:listener}=client.auth.onAuthStateChange((_event,s)=>{session(s?.user.id??null);});
  const timer=window.setInterval(()=>void update(),30000);
  const visibility=()=>{if(document.visibilityState==='visible')void update();else setCount(null);};
  document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;generation++;window.clearInterval(timer);listener.subscription.unsubscribe();document.removeEventListener('visibilitychange',visibility);};
 },[]);
 if(!account||count===null||pathname==='/city'||pathname==='/forest'||pathname==='/meeting')return null;
 return <aside className="zion-online-count" aria-label={`${count} accounts online recently`} title="Accounts active in the last 90 seconds. Updated every 30 seconds; each account is counted once."><i aria-hidden="true"/>{count.toLocaleString()} <span>Online now</span></aside>;
}

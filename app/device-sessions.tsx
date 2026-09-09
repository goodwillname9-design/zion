'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
export default function DeviceSessions({userId}:{userId:string}){
 const [open,setOpen]=useState(false),[rows,setRows]=useState<{username:string;user_agent:string;first_seen:string;last_seen:string}[]>([]),[error,setError]=useState('');
 useEffect(()=>{const note=()=>{if(!document.hidden)void supabase?.rpc('zion_note_device',{p_agent:navigator.userAgent}).then(()=>{});};note();const timer=setInterval(note,60000);return()=>clearInterval(timer);},[userId]);
 const ceo=userId==='fd62030e-f3b8-4c14-bce7-a1f3eedbb74b';
 async function load(){setOpen(true);const response=await supabase?.rpc('zion_ceo_devices');if(response?.error)setError('Could not load device activity. Check V68 privacy setup.');else{setRows(response?.data??[]);setError('');}}
 if(!ceo)return null;
 return <><button onClick={()=>void load()} style={{position:'fixed',bottom:90,left:14,zIndex:110,borderRadius:16,padding:12,background:'#242137',color:'#d9ff83',border:'1px solid #7786'}}>Login devices</button>{open&&<section className="social-overlay" style={{zIndex:200,overflow:'auto',padding:24}}><div style={{maxWidth:800,margin:'auto',padding:24,background:'#171426',borderRadius:20,color:'#fff'}}><button onClick={()=>setOpen(false)}>Back</button><h2>Device/session activity</h2><p>Browser-reported information; last activity is not proof a session is still logged in. Latest 200 sessions.</p><button onClick={()=>void load()}>Refresh</button>{error&&<p role="alert">{error}</p>}{rows.map((r,i)=><article key={i} style={{padding:12,borderBottom:'1px solid #7775',overflowWrap:'anywhere'}}><b>@{r.username}</b><p>{r.user_agent}</p><small>First seen: {new Date(r.first_seen).toLocaleString()} · Last activity: {new Date(r.last_seen).toLocaleString()}</small></article>)}</div></section>}</>;
}

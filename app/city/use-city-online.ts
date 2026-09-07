'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
export type Position = { x:number;z:number;yaw:number;vehicle:string };
export type Peer = Position & { id:string;username:string };
type Room = { id:string;code:string;user_id:string };
export function useCityOnline(position:React.RefObject<Position>) {
  const [room,setRoom]=useState<Room|null>(null);
  const [status,setStatus]=useState('Solo');
  const [busy,setBusy]=useState(false);
  const peers=useRef<Peer[]>([]);
  const [count,setCount]=useState(0);
  async function join(code?:string) {
    if(!supabase){setStatus('Configure Supabase first.');return;}
    setBusy(true);
    try {
      const {data,error}=await supabase.rpc('zion_city_join',{p_code:code?.trim()||null}).abortSignal(AbortSignal.timeout(12000));
      if(error)throw error;
      setRoom(data as Room);setStatus('Connecting…');
    } catch(e) {setStatus(e instanceof Error?e.message:(e as {message?:string})?.message||'Join failed. Run SUPABASE_V63_CITY.sql and sign in to ZION.');}
    finally {setBusy(false);}
  }
  function leave(){setRoom(null);peers.current=[];setCount(0);setStatus('Solo');}
  useEffect(()=>{
    if(!room||!supabase)return;
    const client=supabase;let stopped=false;let timer:ReturnType<typeof setTimeout>;let failures=0;
    const sync=async()=>{
      if(stopped)return;
      try {
        const p=position.current;
        const {data,error}=await client.rpc('zion_city_sync',{p_room:room.id,p_x:p.x,p_z:p.z,p_yaw:((p.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI,p_vehicle:p.vehicle}).abortSignal(AbortSignal.timeout(5000));
        if(stopped)return;if(error)throw error;
        if(!Array.isArray(data))throw new Error('Unexpected room response');
        peers.current=(data as Peer[]).filter(v=>v.id!==room.user_id&&typeof v.username==='string'&&Number.isFinite(v.x)&&Number.isFinite(v.z)&&Number.isFinite(v.yaw)).slice(0,3);
        setCount(peers.current.length+1);setStatus('Online');failures=0;
      } catch {if(stopped)return;failures++;peers.current=[];setCount(0);setStatus(failures>=3?'Disconnected — leave and rejoin the room.':'Reconnecting…');}
      if(!stopped)timer=setTimeout(sync,failures?2500:250);
    };
    void sync();
    return()=>{stopped=true;clearTimeout(timer);peers.current=[];void client.rpc('zion_city_leave',{p_room:room.id}).then(()=>{});};
  },[room,position]);
  return {room,status,busy,peers,count,join,leave};
}

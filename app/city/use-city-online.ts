'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { supabase } from '@/lib/supabase';
export type Position={x:number;z:number;yaw:number;vehicle:string};
export type Peer=Position&{id:string;username:string;hp:number;ammo:number;kills:number;respawn_at:string|null};
type Room={id:string;code:string;user_id:string};
type Round={number:number;ends_at:string|null;active:boolean;host:boolean};
export function useCityOnline(position:React.RefObject<Position>){
 const [room,setRoom]=useState<Room|null>(null),[status,setStatus]=useState('Solo'),[busy,setBusy]=useState(false),[count,setCount]=useState(0),[round,setRound]=useState<Round|null>(null);
 const peers=useRef<Peer[]>([]),self=useRef<Peer|null>(null),joining=useRef(false),queue=useRef(Promise.resolve()),currentRoom=useRef<string|null>(null);
 const command=useCallback((action:string):Promise<string>=>{
 let answer='';
 const task=queue.current.catch(()=>{}).then(async()=>{
 if(!supabase||!room||currentRoom.current!==room.id)return;
 const p=position.current;
 const {data,error}=await supabase.rpc('zion_forest_command',{p_room:room.id,p_action:action,p_x:p.x,p_z:p.z,p_yaw:((p.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI,p_vehicle:p.vehicle}).abortSignal(AbortSignal.timeout(5000));
 if(currentRoom.current!==room.id)return;if(error)throw new Error(error.message);
 if(!Array.isArray(data?.players))throw new Error('Unexpected round response');
 self.current=(data.players as Peer[]).find(p=>p.id===room.user_id)??null;
 peers.current=(data.players as Peer[]).filter(p=>p.id!==room.user_id&&typeof p.username==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.z)).slice(0,3);
 setRound(data.round);setCount(peers.current.length+1);setStatus('Online');answer=data.message||'';
 });queue.current=task.catch(()=>{});return task.then(()=>answer);
 },[room,position]);
 async function join(code?:string){if(!supabase||joining.current)return;joining.current=true;setBusy(true);
 try{const {data,error}=await supabase.rpc('zion_city_join',{p_code:code?.trim()||null}).abortSignal(AbortSignal.timeout(12000));if(error)throw new Error(error.message);currentRoom.current=data.id;setRoom(data);setStatus('Connecting…');}
 catch(e){setStatus(e instanceof Error?e.message:'Join failed.');}finally{joining.current=false;setBusy(false);}}
 function leave(){currentRoom.current=null;setRoom(null);peers.current=[];self.current=null;setCount(0);setRound(null);setStatus('Solo');}
 useEffect(()=>{if(!room||!supabase)return;const client=supabase;let stopped=false,timer:ReturnType<typeof setTimeout>;let failures=0;
 const sync=async()=>{if(stopped)return;try{await command('sync');failures=0;}catch{if(stopped)return;failures++;peers.current=[];self.current=null;setCount(0);setStatus('Connection unavailable. Check V68 combat SQL, then leave/rejoin.');}if(!stopped)timer=setTimeout(sync,failures?2000:250);};void sync();
 return()=>{stopped=true;clearTimeout(timer);peers.current=[];void client.rpc('zion_city_leave',{p_room:room.id}).then(()=>{});};},[room,command]);
 return {room,status,busy,peers,self,count,round,command,join,leave};
}

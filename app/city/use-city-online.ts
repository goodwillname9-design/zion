'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { supabase } from '@/lib/supabase';
export type Position={x:number;z:number;yaw:number;vehicle:string};
export type Peer=Position&{id:string;username:string;role?:string;jailed_until?:string|null;owns_gun?:boolean;hp:number;ammo:number;kills:number;respawn_at:string|null};
type Room={id:string;code:string;user_id:string};
type Round={number:number;ends_at:string|null;active:boolean;host:boolean};
export function useCityOnline(position:React.RefObject<Position>){
 const [room,setRoom]=useState<Room|null>(null),[status,setStatus]=useState('Solo'),[busy,setBusy]=useState(false),[count,setCount]=useState(0),[round,setRound]=useState<Round|null>(null);
 const peers=useRef<Peer[]>([]),self=useRef<Peer|null>(null),joining=useRef(false),queue=useRef(Promise.resolve()),currentRoom=useRef<string|null>(null);
 // Fast lane: other players' positions arrive over a Realtime broadcast channel (no database call per move).
 const live=useRef(new Map<string,{x:number;z:number;yaw:number;vehicle:string;t:number}>()),channelHealthy=useRef(false),roundActive=useRef(false);
 const command=useCallback((action:string):Promise<string>=>{
 let answer='';
 const task=queue.current.catch(()=>{}).then(async()=>{
 if(!supabase||!room||currentRoom.current!==room.id)return;
 const p=position.current;
 const {data,error}=await supabase.rpc('zion_forest_command',{p_room:room.id,p_action:action,p_x:p.x,p_z:p.z,p_yaw:((p.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI,p_vehicle:p.vehicle}).abortSignal(AbortSignal.timeout(5000));
 if(currentRoom.current!==room.id)return;if(error)throw new Error(error.message);
 if(!Array.isArray(data?.players))throw new Error('Unexpected round response');
 self.current=(data.players as Peer[]).find(p=>p.id===room.user_id)??null;
 const now=Date.now();
  peers.current=(data.players as Peer[]).filter(p=>p.id!==room.user_id&&typeof p.username==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.z)).slice(0,19).map(p=>{const l=live.current.get(p.id);return l&&now-l.t<1200?{...p,x:l.x,z:l.z,yaw:l.yaw,vehicle:l.vehicle}:p;});
  roundActive.current=!!data.round?.active;
 setRound(data.round);setCount(peers.current.length+1);setStatus('Online');answer=data.message||'';
 });queue.current=task.catch(()=>{});return task.then(()=>answer);
 },[room,position]);
 async function join(code?:string){if(!supabase||joining.current)return;joining.current=true;setBusy(true);
 try{const {data,error}=await supabase.rpc('zion_city_join',{p_code:code?.trim()||null}).abortSignal(AbortSignal.timeout(12000));if(error)throw new Error(error.message);currentRoom.current=data.id;setRoom(data);setStatus('Connecting…');}
 catch(e){setStatus(e instanceof Error?e.message:'Join failed.');}finally{joining.current=false;setBusy(false);}}
 function leave(){currentRoom.current=null;setRoom(null);peers.current=[];self.current=null;setCount(0);setRound(null);setStatus('Solo');}
 useEffect(()=>{if(!room||!supabase)return;const client=supabase;const liveMap=live.current;let stopped=false;const channel=client.channel(`city-pos-${room.id}`,{config:{broadcast:{self:false,ack:false}}});
  channel.on('broadcast',{event:'p'},({payload})=>{
   const d=(payload??{}) as {id?:unknown;x?:unknown;z?:unknown;yaw?:unknown;vehicle?:unknown};
   if(typeof d.id!=='string'||d.id===room.user_id)return;
   const x=Number(d.x),z=Number(d.z),yaw=Number(d.yaw),vehicle=typeof d.vehicle==='string'?d.vehicle:'';
   if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(yaw)||Math.abs(x)>130||Math.abs(z)>130||!['','Sedan','Motorcycle'].includes(vehicle))return;
   live.current.set(d.id,{x,z,yaw,vehicle,t:Date.now()});
   const peer=peers.current.find(p=>p.id===d.id);if(peer){peer.x=x;peer.z=z;peer.yaw=yaw;peer.vehicle=vehicle;}
  }).subscribe(status=>{if(!stopped)channelHealthy.current=status==='SUBSCRIBED';});
  let sent={x:NaN,z:NaN,yaw:NaN,vehicle:'',t:0};
  const sender=window.setInterval(()=>{
   if(!channelHealthy.current||document.visibilityState!=='visible')return;
   const p=position.current,now=Date.now();
   const moved=Math.hypot(p.x-sent.x,p.z-sent.z)>.03||Math.abs(p.yaw-sent.yaw)>.02||p.vehicle!==sent.vehicle;
   if(!moved&&now-sent.t<1500)return;
   sent={x:p.x,z:p.z,yaw:p.yaw,vehicle:p.vehicle,t:now};
   void channel.send({type:'broadcast',event:'p',payload:{id:room.user_id,x:+p.x.toFixed(2),z:+p.z.toFixed(2),yaw:+p.yaw.toFixed(3),vehicle:p.vehicle}}).catch(()=>{});
  },200);
  let timer:ReturnType<typeof setTimeout>;let failures=0,lastSync={x:NaN,z:NaN};
  // Server sync is the slow, authoritative lane (health, jail, rounds). Busy players sync faster; idle ones barely at all.
  const nextDelay=()=>{const p=position.current;const moved=!(Math.hypot(p.x-lastSync.x,p.z-lastSync.z)<=.05);lastSync={x:p.x,z:p.z};
   if(!channelHealthy.current||roundActive.current)return 250;return p.vehicle?300:moved?600:1500;};
 const sync=async()=>{if(stopped)return;try{await command('sync');failures=0;}catch{if(stopped)return;failures++;peers.current=[];self.current=null;setCount(0);setStatus('Connection unavailable. Check V68 combat SQL, then leave/rejoin.');}if(!stopped)timer=setTimeout(sync,failures?2000:nextDelay());};void sync();
 return()=>{stopped=true;channelHealthy.current=false;window.clearInterval(sender);clearTimeout(timer);liveMap.clear();void client.removeChannel(channel);peers.current=[];void client.rpc('zion_city_leave',{p_room:room.id}).then(()=>{});};},[room,command,position]);
 return {room,status,busy,peers,self,count,round,command,join,leave};
}

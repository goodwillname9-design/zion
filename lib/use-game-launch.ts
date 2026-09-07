'use client';
import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import {shouldLaunchGame} from './game-invites';
type Game=Parameters<typeof shouldLaunchGame>[1];
export function useGameLaunch(userId?:string){
  const [gameId,setGameId]=useState<string|null>(null);
  useEffect(()=>{
    if(!supabase||!userId)return;
    const client=supabase,pending=new Set<string>();let disposed=false,inFlight=false;
    const observe=(g:Game)=>{if(!disposed&&shouldLaunchGame(pending,g,userId))setGameId(g.id);};
    const sent=(event:Event)=>{const g=(event as CustomEvent<Game>).detail;if(g?.id)observe({...g,status:'pending'});};
    const check=async()=>{
      if(disposed||inFlight||document.hidden)return;inFlight=true;
      try{const {data}=await client.from('friend_games').select('id,inviter_id,game_type,status,participant_ids,accepted_ids').contains('participant_ids',[userId]).in('status',['pending','active']).order('updated_at',{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(10000));for(const g of data??[])observe(g);}
      catch{/* A later poll/realtime event retries. */}finally{inFlight=false;}
    };
    const channel=client.channel(`game-auto-launch-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'friend_games'},event=>observe(event.new as Game)).subscribe();
    window.addEventListener('zion-game-invited',sent);document.addEventListener('visibilitychange',check);
    void check();const timer=window.setInterval(()=>void check(),3000);
    return()=>{disposed=true;window.clearInterval(timer);window.removeEventListener('zion-game-invited',sent);document.removeEventListener('visibilitychange',check);void client.removeChannel(channel);};
  },[userId]);
  return {gameId,clearGame:()=>setGameId(null)};
}

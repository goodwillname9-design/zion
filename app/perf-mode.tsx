'use client';
import {useEffect} from 'react';

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

// Detects weaker phones / data-saver and turns on "lite" visuals (no endless animations, no blur) so the site stays smooth.
// Add ?lite=1 or ?lite=0 to the address once to force it either way (remembered on this device).
export function PerfMode(){
 useEffect(()=>{
  const root=document.documentElement;
  let forced:string|null=null;
  try{
   const q=new URLSearchParams(location.search).get('lite');
   if(q==='1'||q==='0')localStorage.setItem('zion-lite',q);
   forced=localStorage.getItem('zion-lite');
  }catch{}
  const nav=navigator as NavigatorHints;
  const weak=(nav.hardwareConcurrency!==undefined&&nav.hardwareConcurrency<=4)||(nav.deviceMemory!==undefined&&nav.deviceMemory<=2)||nav.connection?.saveData===true;
  root.classList.toggle('zion-lite',forced==='1'||(forced!=='0'&&weak));
 },[]);
 return null;
}

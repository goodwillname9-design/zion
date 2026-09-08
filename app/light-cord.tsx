'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import styles from './light-cord.module.css';
export default function LightCord(){
 const [day,setDay]=useState(false),[pull,setPull]=useState(0),[angle,setAngle]=useState(0),[swing,setSwing]=useState(false);
 const start=useRef<{x:number;y:number}|null>(null),distance=useRef(0),skipClick=useRef(false);
 const path=usePathname();
 useEffect(()=>{const sync=()=>setDay(document.documentElement.dataset.theme==='day');
 try{document.documentElement.dataset.theme=localStorage.getItem('zion-theme')==='day'?'day':'dark';}catch{}
 sync();const observer=new MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 const storage=(e:StorageEvent)=>{if(e.key==='zion-theme')document.documentElement.dataset.theme=e.newValue==='day'?'day':'dark';};
 window.addEventListener('storage',storage);return()=>{observer.disconnect();window.removeEventListener('storage',storage);};},[]);
 function toggle(){const next=document.documentElement.dataset.theme==='day'?'dark':'day';document.documentElement.dataset.theme=next;try{localStorage.setItem('zion-theme',next);}catch{}window.dispatchEvent(new Event('zion-theme-change'));}
 if(path==='/city'||path==='/forest')return null;
 return <div className={`${styles.fixture} ${day?styles.on:''}`}>
  <div className={styles.glow}/><div className={styles.cap}/>
  <button className={`${styles.cord} ${swing?styles.swing:''}`} aria-label={day?'Pull cord to turn lights off':'Pull cord to turn lights on'} aria-pressed={day} title="Pull or tap to switch lights"
   style={{'--pull':`${pull}px`,'--angle':`${angle}deg`} as CSSProperties}
   onPointerDown={e=>{if(e.button!==0)return;start.current={x:e.clientX,y:e.clientY};distance.current=0;skipClick.current=false;setSwing(false);e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{if(!start.current)return;const d=Math.min(65,Math.max(0,e.clientY-start.current.y));distance.current=d;setPull(d);setAngle(Math.max(-18,Math.min(18,(start.current.x-e.clientX)/3)));}}
   onPointerUp={()=>{if(!start.current)return;const dragged=distance.current>8;start.current=null;skipClick.current=dragged;if(distance.current>=24)toggle();setPull(0);setAngle(0);setSwing(true);}}
   onPointerCancel={()=>{start.current=null;setPull(0);setAngle(0);setSwing(false);skipClick.current=true;}}
   onLostPointerCapture={()=>{start.current=null;setPull(0);setAngle(0);}}
   onClick={()=>{if(skipClick.current){skipClick.current=false;return;}toggle();setSwing(true);}}
   onAnimationEnd={()=>setSwing(false)}>
   <span className={styles.chain}/><span className={styles.handle}>◉</span>
  </button>
 </div>;
}

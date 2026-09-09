'use client';
import { useRef,useState } from 'react';
export default function Joystick({onMove}:{onMove:(x:number,y:number)=>void}){
 const [point,setPoint]=useState({x:0,y:0});const active=useRef<number|null>(null);
 const release=()=>{active.current=null;setPoint({x:0,y:0});onMove(0,0);};
 return <div role="group" aria-label="Touch movement joystick" style={{width:104,height:104,borderRadius:'50%',background:'#10231bcc',border:'1px solid #a6c9ac66',touchAction:'none',display:'grid',placeItems:'center'}}
 onPointerDown={e=>{active.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{if(active.current!==e.pointerId)return;const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,scale=32/Math.max(32,Math.hypot(x,y));setPoint({x:x*scale,y:y*scale});onMove(x*scale/32,y*scale/32);}}
 onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
 <span style={{display:'block',width:44,height:44,borderRadius:'50%',background:'linear-gradient(140deg,#c8e6b5,#456d55)',boxShadow:'0 4px 12px #0007',transform:`translate(${point.x}px,${point.y}px)`,pointerEvents:'none'}}/>
 </div>;
}

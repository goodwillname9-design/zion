'use client';
import {useEffect} from 'react';

const FIELD='input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]),textarea,[contenteditable="true"]';
const mark=(root:ParentNode)=>root.querySelectorAll<HTMLElement>(FIELD).forEach(el=>{if(el.getAttribute('dir')!=='auto')el.setAttribute('dir','auto');});

// Makes every text box choose its own direction from what is typed, so typing never jumps to one side.
export function InputDirection(){
 useEffect(()=>{
  mark(document);
  let queued=false;
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mark(document);});});
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 return null;
}

import { Fragment } from "react";
/** Text-only linkification: no HTML injection, preview fetch, or private message disclosure. */
export default function MessageLinks({text}:{text:string}) {
 return <span className="message-linked-text">{text.split(/((?:https?:\/\/|www\.)[^\s<>]+)/gi).map((part,i)=>{
 if(!/^(https?:\/\/|www\.)/i.test(part))return <Fragment key={i}>{part}</Fragment>;
 const clean=part.replace(/[.,!?;:]+$/,"");const tail=part.slice(clean.length);
 try {const url=new URL(/^www\./i.test(clean)?`https://${clean}`:clean);if(!["http:","https:"].includes(url.protocol))return part;
 return <Fragment key={i}><a href={url.href} target="_blank" rel="noopener noreferrer" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>{clean}</a>{tail}</Fragment>;
 }catch{return part;}
 })}</span>;
}

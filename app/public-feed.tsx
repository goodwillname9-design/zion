'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft,Globe2,Heart,ImagePlus,RefreshCw,Share2,Trash2,X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadResumable } from '@/lib/resumable-upload';
import styles from './public-feed.module.css';
type Post={id:string;owner_id:string;username:string;body:string;media_path:string|null;media_kind:'image'|'video'|null;created_at:string;likes:number;liked:boolean;can_delete:boolean;url?:string};
export default function PublicFeed({user,onClose}:{user:User;onClose:()=>void}){
 const [posts,setPosts]=useState<Post[]>([]),[body,setBody]=useState(''),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[more,setMore]=useState(true),[error,setError]=useState(''),[progress,setProgress]=useState(0),[status,setStatus]=useState('');
 const pageLock=useRef(false),publishLock=useRef(false),live=useRef(true),abort=useRef<AbortController|null>(null),objectURL=useRef(''),draft=useRef<{id:string;path:string|null;uploaded:boolean}|null>(null),likeLocks=useRef(new Set<string>());
 const load=useCallback(async(before?:Post)=>{if(!supabase||pageLock.current)return;pageLock.current=true;
 try{const {data,error}=await supabase.rpc('zion_feed_page',{p_before:before?.created_at??null,p_id:before?.id??null});if(error)throw error;if(live.current)setError('');
 const rows=(data??[]) as Post[];const paths=rows.flatMap(p=>p.media_path?[p.media_path]:[]);
 const signed=paths.length?await supabase.storage.from('zion-feed').createSignedUrls(paths,3600):null;
 const urls=new Map(signed?.data?.map(p=>[p.path,p.signedUrl]));const items=rows.map(p=>({...p,url:p.media_path?(urls.get(p.media_path)??undefined):undefined}));
 if(live.current){setPosts(old=>before?[...old,...items.filter(p=>!old.some(o=>o.id===p.id))]:items);setMore(rows.length===20);}
 }catch{if(live.current)setError('Feed could not load. Check your connection and retry. First setup requires SUPABASE_V67_FEED.sql.');}
 finally{pageLock.current=false;if(live.current)setLoading(false);}},[]);
 // Initial data fetch updates state only after network completion.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{live.current=true;void load();return()=>{live.current=false;abort.current?.abort();if(objectURL.current)URL.revokeObjectURL(objectURL.current);};},[load]);
 function choose(next:File|null){if(publishLock.current)return;if(next&&(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(next.type)||next.size>(next.type.startsWith('image/')?10:50)*1024*1024)){setError('Choose JPG/PNG/WebP up to 10 MB, or MP4/WebM up to 50 MB.');return;}
 if(objectURL.current)URL.revokeObjectURL(objectURL.current);objectURL.current=next?URL.createObjectURL(next):'';setPreview(objectURL.current);setFile(next);draft.current=null;setError('');}
 async function publish(){if(!supabase||publishLock.current||(!body.trim()&&!file))return;publishLock.current=true;setBusy(true);setError('');setProgress(0);abort.current=new AbortController();
 const pending=draft.current??{id:crypto.randomUUID(),path:null,uploaded:false};draft.current=pending;
 try{if(file&&!pending.uploaded){pending.path=`${user.id}/${pending.id}/media.${({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'} as Record<string,string>)[file.type]}`;
 await uploadResumable({bucket:'zion-feed',path:pending.path,body:file,contentType:file.type,signal:abort.current.signal,onProgress:p=>{if(live.current)setProgress(p);}});pending.uploaded=true;}
 if(abort.current.signal.aborted||!live.current)throw new Error('Upload cancelled');
 const result=await supabase.rpc('zion_feed_publish',{p_id:pending.id,p_body:body,p_path:pending.path,p_kind:file?(file.type.startsWith('image/')?'image':'video'):null});if(result.error)throw result.error;
 draft.current=null;if(live.current){setBody('');setFile(null);if(objectURL.current)URL.revokeObjectURL(objectURL.current);objectURL.current='';setPreview('');setStatus('Posted to the ZION community.');await load();}
 }catch(e){if(live.current)setError(e instanceof Error?e.message:'Post could not be published. Retry; your draft is retained.');}
 finally{publishLock.current=false;if(live.current)setBusy(false);}}
 async function like(p:Post){if(!supabase||likeLocks.current.has(p.id))return;likeLocks.current.add(p.id);const {data,error}=await supabase.rpc('zion_feed_like',{p_id:p.id,p_liked:!p.liked});likeLocks.current.delete(p.id);if(error){setError('Like could not be saved. Try again.');return;}setPosts(old=>old.map(o=>o.id===p.id?{...o,...data}:o));}
 async function remove(p:Post){if(!supabase||!confirm('Delete this public post?'))return;const {data,error}=await supabase.rpc('zion_feed_delete',{p_id:p.id});if(error){setError('Post could not be deleted.');return;}setPosts(old=>old.filter(o=>o.id!==p.id));if(data){const result=await supabase.storage.from('zion-feed').remove([data]);if(result.error)setStatus('Post removed. Its uploaded file still needs storage cleanup.');}}
 async function share(p:Post){const text=`${p.username} on ZION: ${p.body}`;try{if(navigator.share)await navigator.share({title:'ZION community',text,url:location.origin});else{await navigator.clipboard.writeText(`${text}\n${location.origin}`);setStatus('Post text and ZION link copied.');}}catch{setStatus('Sharing cancelled or unavailable.');}}
 return <section className={styles.shell} aria-label="ZION public feed"><div className={styles.wrap}>
 <header className={styles.header}><button onClick={onClose} aria-label="Back to ZION"><ArrowLeft/></button><div><small>ZION COMMUNITY</small><h1>Public feed</h1></div><button disabled={loading} onClick={()=>{setLoading(true);void load();}} aria-label="Refresh feed"><RefreshCw/></button></header>
 <p className={styles.info}><Globe2 size={16}/> Share with everyone on ZION. Posts here are visible to signed-in users.</p>
 <form className={styles.composer} onSubmit={e=>{e.preventDefault();void publish();}}><label htmlFor="feed-body">What’s happening?</label><textarea id="feed-body" maxLength={3000} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} placeholder="Share a thought, a moment, something worth seeing…"/>
 {preview&&<div className={styles.preview}>{file?.type.startsWith('video/')?<video src={preview} controls playsInline preload="metadata"/>:<img src={preview} alt="Your selected upload"/>}<button type="button" disabled={busy} onClick={()=>choose(null)} aria-label="Remove attachment"><X/></button></div>}
 <div className={styles.toolbar}><label className={styles.attach}><ImagePlus size={18}/> Photo / video<input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={e=>{choose(e.target.files?.[0]??null);e.target.value='';}}/></label><span>{body.length}/3000</span><button type="submit" disabled={busy||(!body.trim()&&!file)}>{busy?`Posting ${progress}%`:'Post'}</button></div>
 {busy&&file&&progress<100&&<div><progress max={100} value={progress}/><button type="button" onClick={()=>abort.current?.abort()}>Cancel upload</button></div>}<small>Photos ≤10 MB · Videos ≤50 MB · JPG, PNG, WebP, MP4, WebM</small></form>
 {error&&<p className={styles.error} role="alert">{error}</p>}{status&&<p role="status">{status}</p>}
 <div className={styles.posts}>{posts.map(p=><article className={styles.post} key={p.id}><header><div className={styles.avatar}>{p.username.slice(0,1).toUpperCase()}</div><div><b>@{p.username}</b><time dateTime={p.created_at}>{new Date(p.created_at).toLocaleString()}</time></div>{p.can_delete&&<button onClick={()=>void remove(p)} aria-label="Delete post"><Trash2 size={17}/></button>}</header>
 {p.body&&<p className={styles.body}>{p.body}</p>}{p.media_path&&(p.url?(p.media_kind==='video'?<video src={p.url} controls playsInline preload="none"/>:<img src={p.url} alt={`Photo shared by ${p.username}`} loading="lazy"/>):<p>Media unavailable. Refresh to retry.</p>)}
 <footer><button aria-pressed={p.liked} className={p.liked?styles.liked:''} onClick={()=>void like(p)}><Heart size={18} fill={p.liked?'currentColor':'none'}/>{p.likes} likes</button><button onClick={()=>void share(p)}><Share2 size={18}/> Share</button></footer></article>)}</div>
 {!loading&&!posts.length&&!error&&<p className={styles.empty}>The conversation starts with you. Share the first post.</p>}{loading&&<p role="status">Loading posts…</p>}{more&&posts.length>0&&<button className={styles.more} disabled={loading} onClick={()=>{setLoading(true);void load(posts.at(-1));}}>Load more</button>}
 </div></section>;
}

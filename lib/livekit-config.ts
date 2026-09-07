export function cleanSetting(value:string|undefined){
  const text=(value??'').trim();
  return ((text.startsWith('"')&&text.endsWith('"'))||(text.startsWith("'")&&text.endsWith("'")))?text.slice(1,-1).trim():text;
}
export function livekitConfig(env:Record<string,string|undefined>){
  const raw=cleanSetting(env.LIVEKIT_URL)||cleanSetting(env.NEXT_PUBLIC_LIVEKIT_URL);
  const apiKey=cleanSetting(env.LIVEKIT_API_KEY),apiSecret=cleanSetting(env.LIVEKIT_API_SECRET);
  if(!raw||!apiKey||!apiSecret)throw new Error('MEETING_CONFIG_MISSING');
  if(/\s/.test(apiKey)||/\s/.test(apiSecret))throw new Error('MEETING_CONFIG_INVALID');
  let url:URL;try{url=new URL(raw);}catch{throw new Error('MEETING_CONFIG_INVALID');}
  if(!['wss:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error('MEETING_CONFIG_INVALID');
  url.protocol='wss:';const serverUrl=url.toString().replace(/\/$/,'');
  url.protocol='https:';const apiUrl=url.toString().replace(/\/$/,'');
  return {serverUrl,apiUrl,apiKey,apiSecret};
}

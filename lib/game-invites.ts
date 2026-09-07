type Invite = { id:string;inviter_id:string;game_type:string;participant_ids:string[];status:string };
export function gameInviteKey(g:Pick<Invite,'inviter_id'|'game_type'|'participant_ids'>){return `${g.inviter_id}:${g.game_type}:${[...new Set(g.participant_ids)].sort().join(',')}`;}
export function uniqueGameInvites<T extends Invite>(rows:T[]):T[]{const seen=new Set<string>();return rows.filter(g=>{const key=g.status==='pending'?gameInviteKey(g):g.id;if(seen.has(key))return false;seen.add(key);return true;});}
export function shouldLaunchGame(pending:Set<string>,g:Invite&{accepted_ids:string[]},userId:string){
  if(!g.id||!g.participant_ids?.includes(userId)||!g.accepted_ids?.includes(userId))return false;
  if(g.status==='pending')pending.add(g.id);else if(g.status==='active')return pending.delete(g.id);else pending.delete(g.id);
  return false;
}

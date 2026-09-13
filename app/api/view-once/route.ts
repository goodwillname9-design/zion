import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
const fail = (code: string, error: string, status: number) => NextResponse.json({ code, error }, { status, headers });
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secret) return fail('ONCE_CONFIG', 'Secure media is not configured. Ask the ZION owner to check the server media key.', 503);
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) return fail('ONCE_LOGIN', 'Sign in again to open this media.', 401);
  try {
    const client = createClient(url, key, { global: { headers: { Authorization: token } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await client.auth.getUser(token.slice(7));
    if (authError || !auth.user) return fail('ONCE_LOGIN', 'Your session expired. Sign in again.', 401);
    let id: unknown;
    try { id = (await request.json()).id; } catch { return fail('ONCE_REQUEST', 'Invalid media request.', 400); }
    if (typeof id === 'string' && /^[1-9]\d*$/.test(id)) id = Number(id);
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return fail('ONCE_REQUEST', 'Invalid media ID.', 400);
    const { data: item, error: rowError } = await client.from('friend_messages').select('media_path,view_once,viewed_at,sender_id,friendship_id,deleted_at').eq('id', id).maybeSingle();
    if (rowError) return fail('ONCE_DATABASE', 'Secure media database access failed. Ask the owner to check the privacy migration.', 503);
    if (!item || !item.view_once || item.viewed_at || !item.media_path || item.deleted_at || item.sender_id === auth.user.id) return fail('ONCE_UNAVAILABLE', 'This media was already opened or is unavailable.', 410);
    const { data: member, error: memberError } = await client.rpc('is_friendship_member', { p_friendship_id: item.friendship_id, p_user_id: auth.user.id });
    if (memberError || member !== true) return fail('ONCE_ACCESS', 'This media is not available to this account.', 403);
    const service = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    // Download into server memory before consuming access. Nothing is sent to the browser yet.
    const { data: blob, error: downloadError } = await service.storage.from('chat-media').download(item.media_path);
    if (downloadError || !blob) return fail('ONCE_STORAGE', 'The server could not fetch this media. It has not been marked viewed by this request. Ask the owner to check storage access.', 502);
    if (blob.size > 4194304) return fail('ONCE_SIZE', 'View-once media must be under 4 MB. Ask the sender for a smaller file.', 413);
    const bytes = await blob.arrayBuffer();
    if (request.signal.aborted) return fail('ONCE_CANCELLED', 'Opening was cancelled before delivery.', 408);
    // Atomic claim still allows only ONE response to carry the bytes, even with concurrent requests.
    const { data: path, error: claimError } = await client.rpc('claim_zion_once', { p_id: id });
    if (claimError) {
      if (['PGRST202', '42883', '42501'].includes(claimError.code)) return fail('ONCE_MIGRATION', 'Secure media setup is incomplete. Ask the owner to apply the V68 privacy migration.', 503);
      return fail('ONCE_UNAVAILABLE', 'This media was already opened or is unavailable.', 410);
    }
    if (path !== item.media_path) return fail('ONCE_CHANGED', 'The media changed while opening. Ask the sender to send it again.', 409);
    // A deletion failure must not suppress an already-claimed, downloaded response.
    try { await service.storage.from('chat-media').remove([path]); } catch { /* consumed row and RLS still deny reopening */ }
    return new NextResponse(bytes, { headers: { ...headers, 'Content-Type': 'application/octet-stream' } });
  } catch {
    return fail('ONCE_NETWORK', 'Secure media connection failed. Check your connection and try again.', 503);
  }
}

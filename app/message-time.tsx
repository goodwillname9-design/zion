'use client';

/** Render the persisted send time in the reader's device timezone. */
export default function MessageTime({ sentAt }: { sentAt: string }) {
  const date = new Date(sentAt);
  if (!Number.isFinite(date.getTime())) return <span className="message-time" title="Send time unavailable">—</span>;
  return <time className="message-time" dateTime={date.toISOString()} title={date.toLocaleString()}>
    {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  </time>;
}

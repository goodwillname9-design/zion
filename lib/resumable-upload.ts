"use client";

import * as tus from "tus-js-client";

import { supabase } from "@/lib/supabase";

export async function uploadResumable({
  bucket,
  path,
  body,
  contentType,
  onProgress,
  signal,
}: {
  bucket: string;
  path: string;
  body: Blob;
  contentType: string;
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
}) {
  if (!supabase) throw new Error("Storage is not configured.");
  const client = supabase;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let { data } = await client.auth.getSession();
  if (!data.session?.access_token) {
    const refreshed = await client.auth.refreshSession();
    data = refreshed.data;
  }
  let accessToken = data.session?.access_token;
  if (!supabaseUrl || !anonKey)
    throw new Error("ZION storage configuration is missing.");

  const standardUpload = async () => {
    if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
    const { error } = await client.storage.from(bucket).upload(path, body, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    onProgress?.(100);
  };

  // The regular SDK upload remains a reliable fallback on browsers where the
  // resumable protocol cannot recover an auth session (private mode/WebView).
  if (!accessToken) return standardUpload();

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/upload/resumable`;
  try {
    await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(body, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10_000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "x-upsert": "false",
      },
      onBeforeRequest: async (request) => {
        const current = await client.auth.getSession();
        const expiresSoon = (current.data.session?.expires_at ?? 0) * 1000 < Date.now() + 60_000;
        if (expiresSoon) {
          const refreshed = await client.auth.refreshSession();
          accessToken = refreshed.data.session?.access_token ?? accessToken;
        } else {
          accessToken = current.data.session?.access_token ?? accessToken;
        }
        request.setHeader("authorization", `Bearer ${accessToken}`);
        request.setHeader("apikey", anonKey);
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType,
        cacheControl: "3600",
      },
      onError: (error) => reject(error),
      onProgress: (uploaded, total) =>
        onProgress?.(total ? Math.round((uploaded / total) * 100) : 0),
      onSuccess: () => resolve(),
    });
    const cancel = () => {
      void upload.abort(true);
      reject(new DOMException("Upload cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    void upload.findPreviousUploads().then((previous) => {
      if (signal?.aborted) return cancel();
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
    });
  } catch {
    await standardUpload();
  }
}

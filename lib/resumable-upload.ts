"use client";

import * as tus from "tus-js-client";

import { supabase } from "@/lib/supabase";

export async function uploadResumable({
  bucket,
  path,
  body,
  contentType,
  onProgress,
}: {
  bucket: string;
  path: string;
  body: Blob;
  contentType: string;
  onProgress?: (percentage: number) => void;
}) {
  if (!supabase) throw new Error("Storage is not configured.");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!supabaseUrl || !anonKey || !accessToken)
    throw new Error("Sign in again before uploading.");

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/upload/resumable`;
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(body, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000, 10_000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
        "x-upsert": "false",
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
    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}

"use client";

import { supabase } from "@/lib/supabase";

const PREFIX = "ZION1";
const DB_NAME = "zion-e2ee";
const STORE_NAME = "identity-keys";
const PBKDF2_ITERATIONS = 310_000;

type StoredIdentity = {
  userId: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
};

type KeyBackup = {
  v: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const derivedKeys = new Map<string, CryptoKey>();

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (let index = 0; index < bytes.length; index += 0x8000)
    value += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function openIdentityDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: "userId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIdentity(userId: string) {
  const database = await openIdentityDb();
  return new Promise<StoredIdentity | null>((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(userId);
    request.onsuccess = () => resolve((request.result as StoredIdentity) ?? null);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

async function saveIdentity(identity: StoredIdentity) {
  const database = await openIdentityDb();
  await new Promise<void>((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readwrite")
      .objectStore(STORE_NAME)
      .put(identity);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  database.close();
}

async function passwordKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function wrapPrivateKey(privateJwk: JsonWebKey, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(privateJwk)),
  );
  return {
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iterations: PBKDF2_ITERATIONS,
  } satisfies KeyBackup;
}

async function unwrapPrivateKey(backup: KeyBackup, password: string) {
  try {
    const key = await passwordKey(
      password,
      base64ToBytes(backup.salt),
      backup.iterations,
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(backup.iv) },
      key,
      base64ToBytes(backup.ciphertext),
    );
    return JSON.parse(decoder.decode(plaintext)) as JsonWebKey;
  } catch {
    throw new Error("Encryption vault could not be unlocked with this password.");
  }
}

async function importIdentity(
  userId: string,
  privateJwk: JsonWebKey,
  publicJwk: JsonWebKey,
) {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  const identity = { userId, privateKey, publicKey, publicJwk };
  await saveIdentity(identity);
  return identity;
}

export async function hasLocalE2EEIdentity(userId: string) {
  return Boolean(await readIdentity(userId));
}

export async function ensureE2EEIdentity(userId: string, password: string) {
  if (!supabase) throw new Error("Encryption service is not configured.");
  const [{ data: publicRow, error: publicError }, { data: backupRow, error: backupError }] =
    await Promise.all([
      supabase
        .from("e2ee_public_keys")
        .select("public_key")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("e2ee_key_backups")
        .select("key_backup")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  if (publicError || backupError)
    throw new Error("Run the ZION E2EE SQL update in Supabase, then try again.");

  if (publicRow?.public_key && backupRow?.key_backup) {
    const privateJwk = await unwrapPrivateKey(
      backupRow.key_backup as KeyBackup,
      password,
    );
    await importIdentity(userId, privateJwk, publicRow.public_key as JsonWebKey);
    derivedKeys.clear();
    return;
  }

  const pair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;
  const [privateJwk, publicJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.privateKey),
    crypto.subtle.exportKey("jwk", pair.publicKey),
  ]);
  const backup = await wrapPrivateKey(privateJwk, password);
  const { error } = await supabase.from("e2ee_public_keys").upsert({
    user_id: userId,
    public_key: publicJwk,
  });
  if (error) throw error;
  const { error: saveError } = await supabase.from("e2ee_key_backups").upsert({
    user_id: userId,
    key_backup: backup,
  });
  if (saveError) throw saveError;
  await importIdentity(userId, privateJwk, publicJwk);
  derivedKeys.clear();
}

async function conversationKey(userId: string, peerId: string, context: string) {
  const cacheId = `${userId}:${peerId}:${context}`;
  const cached = derivedKeys.get(cacheId);
  if (cached) return cached;
  if (!supabase) throw new Error("Encryption service is not configured.");
  const identity = await readIdentity(userId);
  if (!identity)
    throw new Error("Unlock your encrypted messages by logging in again.");
  const { data, error } = await supabase
    .from("e2ee_public_keys")
    .select("public_key")
    .eq("user_id", peerId)
    .maybeSingle();
  if (error || !data?.public_key)
    throw new Error("The other person must open the updated ZION app first.");
  const peerKey = await crypto.subtle.importKey(
    "jwk",
    data.public_key as JsonWebKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerKey },
    identity.privateKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, [
    "deriveKey",
  ]);
  const salt = await crypto.subtle.digest("SHA-256", encoder.encode(context));
  const key = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode("ZION end-to-end encryption v1"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  derivedKeys.set(cacheId, key);
  return key;
}

export function isE2EEEnvelope(value?: string | null) {
  return Boolean(value?.startsWith(`${PREFIX}.`));
}

export async function encryptText(
  value: string,
  userId: string,
  peerId: string,
  context: string,
) {
  const key = await conversationKey(userId, peerId, context);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(value),
  );
  return `${PREFIX}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptText(
  value: string | null,
  userId: string,
  peerId: string,
  context: string,
) {
  if (!value || !isE2EEEnvelope(value)) return value;
  const [, encodedIv, encodedCiphertext] = value.split(".");
  try {
    const key = await conversationKey(userId, peerId, context);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(encodedIv),
        additionalData: encoder.encode(context),
      },
      key,
      base64ToBytes(encodedCiphertext),
    );
    return decoder.decode(plaintext);
  } catch {
    return "🔒 Unable to decrypt this message";
  }
}

export async function encryptFile(
  file: File,
  userId: string,
  peerId: string,
  context: string,
) {
  const key = await conversationKey(userId, peerId, context);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    key,
    await file.arrayBuffer(),
  );
  const result = new Uint8Array(1 + iv.length + ciphertext.byteLength);
  result[0] = 1;
  result.set(iv, 1);
  result.set(new Uint8Array(ciphertext), 13);
  return new Blob([result], { type: "application/octet-stream" });
}

export async function decryptFile(
  encrypted: ArrayBuffer,
  mimeType: string,
  userId: string,
  peerId: string,
  context: string,
) {
  const bytes = new Uint8Array(encrypted);
  if (bytes[0] !== 1) throw new Error("Unsupported encrypted attachment.");
  const key = await conversationKey(userId, peerId, context);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes.slice(1, 13),
      additionalData: encoder.encode(context),
    },
    key,
    bytes.slice(13),
  );
  return new Blob([plaintext], { type: mimeType });
}

export function createGroupSecret() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

async function importedGroupKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptGroupText(
  value: string,
  secret: string,
  context: string,
) {
  const key = await importedGroupKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(value),
  );
  return `${PREFIX}G.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptGroupText(
  value: string,
  secret: string,
  context: string,
) {
  if (!value.startsWith(`${PREFIX}G.`)) return value;
  const [, encodedIv, encodedCiphertext] = value.split(".");
  try {
    const key = await importedGroupKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(encodedIv),
        additionalData: encoder.encode(context),
      },
      key,
      base64ToBytes(encodedCiphertext),
    );
    return decoder.decode(plaintext);
  } catch {
    return "🔒 Unable to decrypt this group message";
  }
}

export async function encryptGroupFile(
  file: File,
  secret: string,
  context: string,
) {
  const key = await importedGroupKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(context) },
    key,
    await file.arrayBuffer(),
  );
  const result = new Uint8Array(1 + iv.length + ciphertext.byteLength);
  result[0] = 1;
  result.set(iv, 1);
  result.set(new Uint8Array(ciphertext), 13);
  return new Blob([result], { type: "application/octet-stream" });
}

export async function decryptGroupFile(
  encrypted: ArrayBuffer,
  mimeType: string,
  secret: string,
  context: string,
) {
  const bytes = new Uint8Array(encrypted);
  if (bytes[0] !== 1) throw new Error("Unsupported encrypted group attachment.");
  const key = await importedGroupKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: bytes.slice(1, 13),
      additionalData: encoder.encode(context),
    },
    key,
    bytes.slice(13),
  );
  return new Blob([plaintext], { type: mimeType });
}

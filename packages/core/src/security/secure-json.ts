import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ENVELOPE_VERSION = 1;
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KEY_DERIVATION = "scrypt-sha256";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;

export type SecureJsonState = {
  path: string;
  exists: boolean;
  encrypted: boolean;
  encryptionAvailable: boolean;
  keyEnv: string;
  algorithm?: string;
  version?: number;
};

type EncryptedEnvelope = {
  specweftSecureJson: true;
  version: number;
  algorithm: typeof ENCRYPTION_ALGORITHM;
  keyDerivation: typeof KEY_DERIVATION;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

// 这些文件会保存需求、记忆和工作段，可能包含业务上下文。
// 设置 SPECWEFT_MEMORY_KEY 后，SpecWeft 会自动用本地密钥加密写入。
export async function writeSecureJsonFile(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const key = readMemoryKey();
  const payload = key ? encryptJson(value, key) : `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(filePath, payload, "utf-8");
}

export async function readSecureJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    if (isEncryptedEnvelope(parsed)) {
      const key = readMemoryKey();
      if (!key) {
        throw new Error(`SpecWeft memory is encrypted. Set SPECWEFT_MEMORY_KEY before reading ${filePath}.`);
      }
      return decryptJson<T>(parsed, key);
    }

    return parsed as T;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

export async function getSecureJsonState(filePath: string): Promise<SecureJsonState> {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    if (isEncryptedEnvelope(parsed)) {
      return {
        path: filePath,
        exists: true,
        encrypted: true,
        encryptionAvailable: Boolean(readMemoryKey()),
        keyEnv: "SPECWEFT_MEMORY_KEY",
        algorithm: parsed.algorithm,
        version: parsed.version,
      };
    }

    return {
      path: filePath,
      exists: true,
      encrypted: false,
      encryptionAvailable: Boolean(readMemoryKey()),
      keyEnv: "SPECWEFT_MEMORY_KEY",
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {
        path: filePath,
        exists: false,
        encrypted: false,
        encryptionAvailable: Boolean(readMemoryKey()),
        keyEnv: "SPECWEFT_MEMORY_KEY",
      };
    }
    throw error;
  }
}

export function hasMemoryEncryptionKey(): boolean {
  return Boolean(readMemoryKey());
}

function encryptJson(value: unknown, keyText: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(keyText, salt);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope: EncryptedEnvelope = {
    specweftSecureJson: true,
    version: ENVELOPE_VERSION,
    algorithm: ENCRYPTION_ALGORITHM,
    keyDerivation: KEY_DERIVATION,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}

function decryptJson<T>(envelope: EncryptedEnvelope, keyText: string): T {
  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  const key = deriveKey(keyText, salt);
  const decipher = crypto.createDecipheriv(envelope.algorithm, key, iv);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
    return JSON.parse(plaintext) as T;
  } catch {
    throw new Error("Unable to decrypt SpecWeft memory. Check that SPECWEFT_MEMORY_KEY is correct.");
  }
}

function deriveKey(keyText: string, salt: Buffer): Buffer {
  return crypto.scryptSync(keyText, salt, KEY_BYTES);
}

function readMemoryKey(): string | undefined {
  const key = process.env.SPECWEFT_MEMORY_KEY?.trim();
  return key || undefined;
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const envelope = value as Partial<EncryptedEnvelope>;
  return envelope.specweftSecureJson === true
    && envelope.version === ENVELOPE_VERSION
    && envelope.algorithm === ENCRYPTION_ALGORITHM
    && envelope.keyDerivation === KEY_DERIVATION
    && typeof envelope.salt === "string"
    && typeof envelope.iv === "string"
    && typeof envelope.tag === "string"
    && typeof envelope.ciphertext === "string";
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

const ITERATIONS = 100_000;
const HASH_ALGO = "SHA-256";
const KEY_LENGTH = 32; // bytes

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = bytesToHex(salt);
  const hashHex = bytesToHex(hashArray);
  return `${ITERATIONS}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [iterStr, saltHex, hashHex] = stored.split(":");
  const iterations = parseInt(iterStr, 10);
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: HASH_ALGO,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const newHashHex = bytesToHex(new Uint8Array(derivedBits));
  return timingSafeEqual(hashHex, newHashHex);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

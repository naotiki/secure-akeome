export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SHA-256 を利用できません (Web Crypto が利用不可)');
  }

  const digest = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  return new Uint8Array(digest);
}


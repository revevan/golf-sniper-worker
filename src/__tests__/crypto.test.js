import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../crypto.js';

const KEY = 'test-encryption-key-32-chars-long';

describe('encrypt / decrypt', () => {
  it('round-trips plaintext correctly', async () => {
    const plaintext = 'hello world';
    const ciphertext = await encrypt(plaintext, KEY);
    expect(await decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it('round-trips JSON credentials', async () => {
    const creds = JSON.stringify({ username: 'user@example.com', password: 'S3cur3P@ss!' });
    const ciphertext = await encrypt(creds, KEY);
    expect(await decrypt(ciphertext, KEY)).toBe(creds);
  });

  it('produces different ciphertext on each call (randomized IV)', async () => {
    const plaintext = 'same input';
    const a = await encrypt(plaintext, KEY);
    const b = await encrypt(plaintext, KEY);
    expect(a).not.toBe(b);
  });

  it('returns null for a tampered ciphertext', async () => {
    const ciphertext = await encrypt('secret', KEY);
    // Flip a character in the middle of the base64 string
    const tampered = ciphertext.slice(0, 20) + (ciphertext[20] === 'A' ? 'B' : 'A') + ciphertext.slice(21);
    expect(await decrypt(tampered, KEY)).toBeNull();
  });

  it('returns null when decrypting with the wrong key', async () => {
    const ciphertext = await encrypt('secret', KEY);
    expect(await decrypt(ciphertext, 'wrong-key')).toBeNull();
  });

  it('returns null for invalid base64 input', async () => {
    expect(await decrypt('not-valid-base64!!!', KEY)).toBeNull();
  });

  it('works with a short key (SHA-256 normalization)', async () => {
    const plaintext = 'short key test';
    const ciphertext = await encrypt(plaintext, 'abc');
    expect(await decrypt(ciphertext, 'abc')).toBe(plaintext);
  });

  it('works with a long key', async () => {
    const longKey = 'a'.repeat(64);
    const plaintext = 'long key test';
    const ciphertext = await encrypt(plaintext, longKey);
    expect(await decrypt(ciphertext, longKey)).toBe(plaintext);
  });
});

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128-bit IV — random per encryption
const KEY_LENGTH = 32;  // 256-bit key from ENCRYPTION_KEY env var

// AES-256-GCM symmetric encryption for sensitive fields stored in the DB:
// WhatsApp access tokens, WhatsApp App Secret.
//
// GCM (Galois/Counter Mode) provides both encryption AND authentication —
// if the ciphertext is tampered with, decryption throws, not silently returns garbage.
//
// Stored format: base64(iv):base64(authTag):base64(ciphertext)
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawKey = config.get<string>('ENCRYPTION_KEY', '');
    if (!rawKey) throw new Error('ENCRYPTION_KEY not set');

    // Accept base64 or hex 32-byte key
    this.key = Buffer.from(rawKey, 'base64');
    if (this.key.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must be 32 bytes (256-bit). Got ${this.key.length} bytes. ` +
          'Generate with: openssl rand -base64 32',
      );
    }
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag(); // 16-byte authentication tag

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');

    const [ivB64, authTagB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }

  // Returns null if value is null/undefined (for optional encrypted fields)
  encryptNullable(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.encrypt(value);
  }

  decryptNullable(value: string | null | undefined): string | null {
    if (!value) return null;
    return this.decrypt(value);
  }
}

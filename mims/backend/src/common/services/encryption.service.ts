import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * SECURITY: Encryption Service
 * 
 * Provides AES-256-GCM encryption for sensitive data:
 * - Biometric templates
 * - Phone numbers
 * - Health information
 * - Personal identifiable information (PII)
 * 
 * Uses:
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key derivation: PBKDF2 (password-based key derivation)
 * - IV: Random 16-byte initialization vector per encryption
 * - Auth Tag: GCM authentication tag for integrity verification
 * 
 * Format: iv:authTag:ciphertext (hex:hex:hex)
 * 
 * SECURITY CONSIDERATIONS:
 * - Each encryption uses a unique IV
 * - Authentication tag prevents tampering
 * - Key is derived from encryption key + salt
 * - Decryption verifies auth tag before returning data
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly saltLength = 16; // bytes
  private readonly ivLength = 16; // bytes
  private readonly tagLength = 16; // bytes
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const encryptionKey = this.configService.get<string>(
      'ENCRYPTION_KEY',
      'default-dev-key-change-in-production-immediately',
    );

    // Derive a 32-byte key from the configured key using PBKDF2
    this.key = crypto.pbkdf2Sync(encryptionKey, 'salt', 100000, 32, 'sha256');
  }

  /**
   * Encrypt sensitive data
   * 
   * @param plaintext Data to encrypt
   * @returns Encrypted data in format: iv:authTag:ciphertext (all hex-encoded)
   * 
   * @example
   * ```typescript
   * const encrypted = encryptionService.encrypt('fingerprint_template_data');
   * // Returns: "abcd1234ef5678...:12345678ef...:abcdef123456..."
   * ```
   */
  encrypt(plaintext: string): string {
    // Generate random IV for this encryption
    const iv = crypto.randomBytes(this.ivLength);

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:ciphertext (all hex-encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   * Verifies authentication tag to ensure data hasn't been tampered with
   * 
   * @param encryptedData Encrypted data in format: iv:authTag:ciphertext
   * @returns Decrypted plaintext
   * @throws Error if authentication tag verification fails (tampering detected)
   * 
   * @example
   * ```typescript
   * const decrypted = encryptionService.decrypt(encryptedData);
   * // Returns: original plaintext
   * ```
   */
  decrypt(encryptedData: string): string {
    try {
      // Parse encrypted data
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, ciphertextHex] = parts;

      // Convert from hex back to buffers
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      // Validate buffer sizes
      if (iv.length !== this.ivLength) {
        throw new Error('Invalid IV length');
      }
      if (authTag.length !== this.tagLength) {
        throw new Error('Invalid auth tag length');
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);

      // Set authentication tag (SECURITY: Must be done before decryption)
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(ciphertext).toString('utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      // Log encryption errors for security monitoring
      console.error('[ENCRYPTION_ERROR]', error.message);
      throw new Error('Decryption failed - data may have been tampered with');
    }
  }

  /**
   * Hash sensitive data using SHA-256
   * Used for storing hashed values where you don't need to decrypt
   * Examples: password hashes, biometric hashes
   * 
   * @param data Data to hash
   * @returns SHA-256 hash (hex-encoded)
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify a hash
   * Compare plaintext with stored hash
   * 
   * @param plaintext Original data
   * @param hash Stored hash to compare against
   * @returns True if hash matches
   */
  verifyHash(plaintext: string, hash: string): boolean {
    const computed = this.hash(plaintext);
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(hash),
    );
  }

  /**
   * Generate cryptographically secure random token
   * Used for API keys, reset tokens, etc.
   * 
   * @param length Token length in bytes (default 32 = 64 hex chars)
   * @returns Random token (hex-encoded)
   */
  generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

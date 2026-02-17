import { Injectable } from '@nestjs/common';
import { EncryptionService } from './encryption.service';

/**
 * SECURITY: Entity Encryption Helper
 * 
 * Provides convenient methods for encrypting/decrypting entity fields.
 * Works seamlessly with Prisma entities to provide transparent encryption.
 * 
 * Usage in services:
 * ```typescript
 * // Before saving
 * entity.templateData = await this.encryptionHelper.encrypt(
 *   entity.templateData,
 *   'BiometricEnrollment'
 * );
 * 
 * // After retrieving
 * entity.templateData = await this.encryptionHelper.decrypt(
 *   entity.templateData,
 *   'BiometricEnrollment'
 * );
 * ```
 */
@Injectable()
export class EntityEncryptionService {
  constructor(private encryptionService: EncryptionService) {}

  /**
   * Encrypt sensitive fields in an entity
   * 
   * @param entity Entity to encrypt
   * @param encryptedFields List of field names to encrypt
   * @returns Entity with encrypted fields
   */
  async encryptEntity<T extends Record<string, any>>(
    entity: T,
    encryptedFields: string[],
  ): Promise<T> {
    const encrypted = { ...entity } as any;

    for (const field of encryptedFields) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        try {
          encrypted[field] = this.encryptionService.encrypt(encrypted[field]);
        } catch (error) {
          console.error(`[ENCRYPTION_ERROR] Failed to encrypt field: ${field}`, error);
          throw new Error(`Encryption failed for field: ${field}`);
        }
      }
    }

    return encrypted as T;
  }

  /**
   * Decrypt sensitive fields in an entity
   * 
   * @param entity Entity to decrypt
   * @param encryptedFields List of field names to decrypt
   * @returns Entity with decrypted fields
   */
  async decryptEntity<T extends Record<string, any>>(
    entity: T,
    encryptedFields: string[],
  ): Promise<T> {
    const decrypted = { ...entity } as any;

    for (const field of encryptedFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          // Check if field looks encrypted (contains colons for format)
          if (decrypted[field].includes(':')) {
            decrypted[field] = this.encryptionService.decrypt(decrypted[field]);
          }
        } catch (error) {
          console.error(`[DECRYPTION_ERROR] Failed to decrypt field: ${field}`, error);
          // Return original value if decryption fails (for recovery)
          // But log for investigation
        }
      }
    }

    return decrypted as T;
  }

  /**
   * Encrypt array of entities
   * 
   * @param entities Array of entities
   * @param encryptedFields Fields to encrypt in each entity
   * @returns Array of encrypted entities
   */
  async encryptEntities<T extends Record<string, any>>(
    entities: T[],
    encryptedFields: string[],
  ): Promise<T[]> {
    return Promise.all(
      entities.map((entity: any) => this.encryptEntity(entity, encryptedFields)),
    );
  }

  /**
   * Decrypt array of entities
   * 
   * @param entities Array of entities
   * @param encryptedFields Fields to decrypt in each entity
   * @returns Array of decrypted entities
   */
  async decryptEntities<T extends Record<string, any>>(
    entities: T[],
    encryptedFields: string[],
  ): Promise<T[]> {
    return Promise.all(
      entities.map((entity: any) => this.decryptEntity(entity, encryptedFields)),
    );
  }

  /**
   * Encrypt single field value
   * Convenience method for encrypting a single value
   * 
   * @param value Value to encrypt
   * @return Encrypted value
   */
  encryptField(value: string): string {
    return this.encryptionService.encrypt(value);
  }

  /**
   * Decrypt single field value
   * Convenience method for decrypting a single value
   * 
   * @param encryptedValue Encrypted value
   * @returns Decrypted value
   */
  decryptField(encryptedValue: string): string {
    return this.encryptionService.decrypt(encryptedValue);
  }

  /**
   * Check if value looks encrypted
   * Returns true if value matches encrypted format (contains colons)
   * 
   * @param value Value to check
   * @returns True if looks encrypted
   */
  isEncrypted(value: any): boolean {
    if (typeof value !== 'string') return false;
    const parts = value.split(':');
    return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
  }

  /**
   * Generate hash of encrypted data for integrity verification
   * Useful for detecting corruption or tampering
   * 
   * @param encryptedValue Encrypted value
   * @returns SHA-256 hash
   */
  getEncryptedDataHash(encryptedValue: string): string {
    return this.encryptionService.hash(encryptedValue);
  }

  /**
   * Verify integrity of encrypted data
   * 
   * @param encryptedValue Current encrypted value
   * @param storedHash Previously stored hash
   * @returns True if hashes match
   */
  verifyEncryptedDataIntegrity(encryptedValue: string, storedHash: string): boolean {
    const currentHash = this.getEncryptedDataHash(encryptedValue);
    return this.encryptionService.verifyHash(currentHash, storedHash);
  }
}

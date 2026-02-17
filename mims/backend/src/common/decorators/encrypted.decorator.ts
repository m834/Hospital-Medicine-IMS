import { applyDecorators } from '@nestjs/common';
import { Exclude } from 'class-transformer';

/**
 * SECURITY: Entity Encryption Decorator
 * 
 * Marks fields that should be automatically encrypted/decrypted
 * when stored in/retrieved from the database.
 * 
 * Usage in entity:
 * ```typescript
 * export class BiometricEnrollment {
 *   @Encrypted()
 *   templateData: string; // Automatically encrypted
 * }
 * ```
 * 
 * The actual encryption/decryption happens in the service layer.
 */
export const Encrypted = () => {
  return applyDecorators(
    Exclude({ toPlainOnly: true }), // Don't expose in JSON responses
  );
};

/**
 * SECURITY: Encrypted Field Metadata
 * 
 * Use this to mark fields for encryption handling
 */
export const ENCRYPTED_FIELDS_KEY = '__encrypted_fields__';

/**
 * Get list of encrypted fields from an entity class
 */
export function getEncryptedFields(entity: any): string[] {
  return Reflect.getMetadata(ENCRYPTED_FIELDS_KEY, entity) || [];
}

/**
 * Mark a field as encrypted in metadata
 */
export function markFieldEncrypted(
  target: any,
  propertyKey: string,
): void {
  const existing = Reflect.getMetadata(ENCRYPTED_FIELDS_KEY, target) || [];
  Reflect.defineMetadata(
    ENCRYPTED_FIELDS_KEY,
    [...existing, propertyKey],
    target,
  );
}

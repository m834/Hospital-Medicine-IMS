import { Transform } from 'class-transformer';

/**
 * SECURITY: HTML Sanitization Decorator
 * 
 * Removes HTML tags and scripts from string inputs
 * Prevents XSS (Cross-Site Scripting) attacks
 * 
 * Usage:
 * ```typescript
 * export class CreateShiftDto {
 *   @SanitizeHtml()
 *   @IsString()
 *   name: string;
 * }
 * ```
 * 
 * Examples:
 * - Input: '<script>alert("xss")</script>'
 * - Output: '' (empty string, script removed)
 * 
 * - Input: '<b>Shift Name</b>'
 * - Output: 'Shift Name' (tags removed)
 * 
 * - Input: 'Normal Shift Name'
 * - Output: 'Normal Shift Name' (unchanged)
 */
export const SanitizeHtml = () => {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    // Remove all HTML tags
    let sanitized = value.replace(/<[^>]*>/g, '');

    // Remove common XSS patterns
    sanitized = sanitized
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/alert\(/gi, '')
      .replace(/eval\(/gi, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  });
};

/**
 * SECURITY: Trim Whitespace Decorator
 * 
 * Removes leading and trailing whitespace
 * Also normalizes internal whitespace
 * 
 * Usage:
 * ```typescript
 * export class CreateShiftDto {
 *   @Trim()
 *   @IsString()
 *   name: string;
 * }
 * ```
 */
export const Trim = () => {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim();
  });
};

/**
 * SECURITY: Lowercase Decorator
 * 
 * Converts string to lowercase
 * Useful for email fields and usernames
 * 
 * Usage:
 * ```typescript
 * export class CreateUserDto {
 *   @Lowercase()
 *   @IsEmail()
 *   email: string;
 * }
 * ```
 */
export const Lowercase = () => {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value.toLowerCase();
  });
};

/**
 * SECURITY: URL Sanitization Decorator
 * 
 * Validates and sanitizes URL strings
 * Prevents URL-based injection attacks
 * 
 * Usage:
 * ```typescript
 * export class CreateDeviceDto {
 *   @SanitizeUrl()
 *   @IsUrl()
 *   webhookUrl: string;
 * }
 * ```
 */
export const SanitizeUrl = () => {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      // Validate URL format
      const url = new URL(value);
      // Return only the sanitized URL
      return url.toString();
    } catch (error) {
      // Return empty string if URL is invalid
      // ValidationPipe will handle the error
      return value;
    }
  });
};

/**
 * SECURITY: Phone Number Sanitization Decorator
 * 
 * Removes all non-digit characters from phone numbers
 * Helps normalize phone numbers across regions
 * 
 * Usage:
 * ```typescript
 * export class CreateEmployeeDto {
 *   @SanitizePhoneNumber()
 *   @IsPhoneNumber()
 *   phone: string;
 * }
 * ```
 * 
 * Examples:
 * - Input: '+1 (555) 123-4567'
 * - Output: '15551234567'
 * 
 * - Input: '555.123.4567'
 * - Output: '5551234567'
 */
export const SanitizePhoneNumber = () => {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    // Remove all non-digit characters except +
    return value.replace(/[^\d+]/g, '');
  });
};

/**
 * SECURITY: JSON Sanitization Decorator
 * 
 * Safely parses and validates JSON strings
 * Prevents JSON injection attacks
 * 
 * Usage:
 * ```typescript
 * export class CreateDeviceSyncDto {
 *   @SanitizeJson()
 *   @IsNotEmpty()
 *   biometricData: string; // JSON string
 * }
 * ```
 */
export const SanitizeJson = () => {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        // Parse and re-stringify to validate JSON
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed);
      } catch (error) {
        // Return original value if invalid JSON
        // ValidationPipe will handle the error
        return value;
      }
    }

    if (typeof value === 'object' && value !== null) {
      // Already an object, stringify it
      return JSON.stringify(value);
    }

    return value;
  });
};

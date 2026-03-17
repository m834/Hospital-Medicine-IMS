-- Task 17: Add support for encrypted sensitive fields
-- Date: 2026-02-21
-- Status: Create encrypted indexes and update schema

-- Add encrypted_data_hash column for integrity verification
-- This allows us to quickly check if encrypted data is valid
-- without decrypting (useful for corruption detection)

-- Note: The actual encryption/decryption happens in the application layer
-- using the EncryptionService (AES-256-GCM)

-- Biometric enrollments: templateData is highly sensitive biometric information
-- Adding a hash column for integrity checking
ALTER TABLE biometric_enrollments 
ADD COLUMN IF NOT EXISTS template_data_hash VARCHAR(64),
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- Create index on encrypted status for quick queries
CREATE INDEX IF NOT EXISTS idx_biometric_enrollments_encrypted 
ON biometric_enrollments(is_encrypted);

-- Users: phone numbers should be encrypted (PII)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_encrypted BOOLEAN DEFAULT false;

-- Attendance records may contain sensitive metadata
ALTER TABLE attendance_records
ADD COLUMN IF NOT EXISTS notes_encrypted BOOLEAN DEFAULT false;

-- Leave requests may contain sensitive information
ALTER TABLE leaves
ADD COLUMN IF NOT EXISTS reason_encrypted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS remarks_encrypted BOOLEAN DEFAULT false;

-- Add audit log comment for schema change
INSERT INTO audit_logs (
  id,
  hospital_id,
  user_id,
  action,
  entity_type,
  entity_id,
  before_state,
  after_state,
  ip_address,
  user_agent,
  timestamp
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000', -- System migration
  '00000000-0000-0000-0000-000000000000', -- System
  'CREATE',
  'Schema',
  'Migration_20260221_encrypted_fields',
  NULL,
  '{"description": "Added encrypted field support and integrity checking columns", "tables_modified": 4}'::jsonb,
  '127.0.0.1',
  'Database Migration Tool',
  NOW()
WHERE EXISTS (
  SELECT 1 FROM hospitals WHERE id = '00000000-0000-0000-0000-000000000000'
)
AND EXISTS (
  SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT DO NOTHING;

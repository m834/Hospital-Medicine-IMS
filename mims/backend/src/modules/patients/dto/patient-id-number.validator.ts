import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PatientIdType } from './create-patient.dto';

const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;
const MIN_OTHER_ID_LENGTH = 4;

/**
 * The identifier is optional — full name is the only mandatory field — but an ID
 * that *is* supplied has to be well formed, and only a CNIC has a format to check
 * against. Passports and foreign IDs have no single format, so they are accepted
 * as entered beyond a minimum length.
 *
 * A blank value passes: @IsOptional only skips null/undefined, so an empty string
 * from a form field still lands here and must be treated as "not supplied".
 */
@ValidatorConstraint({ name: 'patientIdNumber', async: false })
export class PatientIdNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value !== 'string') return false;
    if (value.trim() === '') return true;

    const idType = (args.object as { idType?: PatientIdType }).idType ?? PatientIdType.CNIC;

    return idType === PatientIdType.CNIC
      ? CNIC_PATTERN.test(value.trim())
      : value.trim().length >= MIN_OTHER_ID_LENGTH;
  }

  defaultMessage(args: ValidationArguments): string {
    const idType = (args.object as { idType?: PatientIdType }).idType ?? PatientIdType.CNIC;

    return idType === PatientIdType.CNIC
      ? 'Enter a valid CNIC (XXXXX-XXXXXXX-X)'
      : `Enter a valid ID number (at least ${MIN_OTHER_ID_LENGTH} characters)`;
  }
}

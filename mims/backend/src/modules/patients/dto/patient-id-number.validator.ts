import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PatientIdType } from './create-patient.dto';

const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;
const MIN_OTHER_ID_LENGTH = 4;

/**
 * The identifier is always required, but only format-checked when it is a CNIC.
 * Passports and foreign IDs have no single format, so they are accepted as
 * entered beyond a minimum length.
 *
 * This is a single constraint rather than @ValidateIf + @Matches because
 * ValidateIf skips every validator on the property — including the
 * "is required" check — which would let an OTHER patient be saved with no ID.
 */
@ValidatorConstraint({ name: 'patientIdNumber', async: false })
export class PatientIdNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string' || value.trim() === '') return false;

    const idType = (args.object as { idType?: PatientIdType }).idType ?? PatientIdType.CNIC;

    return idType === PatientIdType.CNIC
      ? CNIC_PATTERN.test(value.trim())
      : value.trim().length >= MIN_OTHER_ID_LENGTH;
  }

  defaultMessage(args: ValidationArguments): string {
    const value = args.value;
    if (typeof value !== 'string' || value.trim() === '') {
      return 'ID number is required';
    }

    const idType = (args.object as { idType?: PatientIdType }).idType ?? PatientIdType.CNIC;

    return idType === PatientIdType.CNIC
      ? 'Enter a valid CNIC (XXXXX-XXXXXXX-X)'
      : `Enter a valid ID number (at least ${MIN_OTHER_ID_LENGTH} characters)`;
  }
}

import { IsArray, IsUUID } from 'class-validator';

export class SetSubPharmaciesDto {
  /**
   * The complete set of sub-pharmacies that should belong to this main pharmacy.
   * Anything currently attached but missing from this list is detached.
   */
  @IsArray()
  @IsUUID('4', { each: true })
  subPharmacyIds: string[];
}

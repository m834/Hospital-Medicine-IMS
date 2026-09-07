import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class PrintSlipDto {
  /**
   * The orders whose slips are going to the printer. One order is one slip, so
   * a six-test order sends six ids and each is counted separately.
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderIds: string[];
}

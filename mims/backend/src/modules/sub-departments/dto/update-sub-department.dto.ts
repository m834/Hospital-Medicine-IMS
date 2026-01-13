import { PartialType } from '@nestjs/mapped-types';
import { CreateSubDepartmentDto } from './create-sub-department.dto';

export class UpdateSubDepartmentDto extends PartialType(CreateSubDepartmentDto) {}

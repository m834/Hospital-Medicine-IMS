import { IsEnum, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class AssignPermissionDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  permissionId: string;
}

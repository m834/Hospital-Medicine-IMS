import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Hospital-scoped pharmacy views. Kept separate from PharmaciesController so the
 * existing flat /pharmacies endpoints stay untouched.
 */
@Controller('hospitals/:hospitalId/pharmacies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalPharmaciesController {
  constructor(private readonly pharmaciesService: PharmaciesService) {}

  /**
   * GET /hospitals/:hospitalId/pharmacies/tree
   * Main pharmacies with their sub-pharmacies nested underneath.
   */
  @Get('tree')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.AUDITOR,
  )
  getTree(@Param('hospitalId') hospitalId: string, @Request() req) {
    // Non-super-admins can only read their own hospital's tree
    if (
      req.user.role !== UserRole.SUPER_ADMIN &&
      hospitalId !== req.user.hospitalId
    ) {
      throw new ForbiddenException(
        'You can only view pharmacies in your own hospital',
      );
    }

    return this.pharmaciesService.getTree(hospitalId);
  }
}

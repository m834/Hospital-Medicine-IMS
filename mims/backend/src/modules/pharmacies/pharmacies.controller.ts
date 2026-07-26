import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { PharmaciesService } from './pharmacies.service';
import {
  CreatePharmacyDto,
  UpdatePharmacyDto,
  SetSubPharmaciesDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('pharmacies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PharmaciesController {
  constructor(private readonly pharmaciesService: PharmaciesService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  create(@Body() createPharmacyDto: CreatePharmacyDto, @Request() req) {
    // Hospital admins can only create pharmacies in their own hospital
    if (req.user.role === UserRole.HOSPITAL_ADMIN) {
      if (createPharmacyDto.hospitalId !== req.user.hospitalId) {
        throw new ForbiddenException('You can only create pharmacies in your own hospital');
      }
    }

    // For audit log: use user's hospitalId (Hospital Admin) or pharmacy's hospitalId (Super Admin)
    const auditHospitalId = req.user.hospitalId || createPharmacyDto.hospitalId;

    return this.pharmaciesService.create(
      createPharmacyDto,
      req.user.id,
      auditHospitalId,
    );
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.AUDITOR,
  )
  findAll(
    @Query('hospitalId') hospitalId?: string,
    @Query('type') type?: string,
    @Request() req?,
  ) {
    // Hospital users can only see pharmacies in their hospital
    if (req.user.role !== UserRole.SUPER_ADMIN) {
      hospitalId = req.user.hospitalId;
    }

    return this.pharmaciesService.findAll(hospitalId, type);
  }

  @Get('stats/:hospitalId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  getStats(@Param('hospitalId') hospitalId: string, @Request() req) {
    // Hospital admins can only get stats for their own hospital
    if (req.user.role === UserRole.HOSPITAL_ADMIN) {
      if (hospitalId !== req.user.hospitalId) {
        throw new ForbiddenException('You can only view stats for your own hospital');
      }
    }

    return this.pharmaciesService.getStats(hospitalId);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  findOne(@Param('id') id: string, @Request() req) {
    const userHospitalId =
      req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.hospitalId;
    return this.pharmaciesService.findOne(id, userHospitalId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updatePharmacyDto: UpdatePharmacyDto,
    @Request() req,
  ) {
    // Get pharmacy to determine hospitalId for audit log (needed for Super Admin)
    const userHospitalId = req.user.role === UserRole.SUPER_ADMIN 
      ? undefined 
      : req.user.hospitalId;
    
    const pharmacy = await this.pharmaciesService.findOne(id, userHospitalId);
    
    // For audit log: use user's hospitalId (Hospital Admin) or pharmacy's hospitalId (Super Admin)
    const auditHospitalId = req.user.hospitalId || pharmacy.hospitalId;
    
    return this.pharmaciesService.update(
      id,
      updatePharmacyDto,
      req.user.id,
      auditHospitalId,
    );
  }

  /**
   * PATCH /pharmacies/:id/sub-pharmacies
   * Replace the set of sub-pharmacies bundled under this main pharmacy.
   */
  @Patch(':id/sub-pharmacies')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async setSubPharmacies(
    @Param('id') id: string,
    @Body() setSubPharmaciesDto: SetSubPharmaciesDto,
    @Request() req,
  ) {
    const userHospitalId =
      req.user.role === UserRole.SUPER_ADMIN ? undefined : req.user.hospitalId;

    const pharmacy = await this.pharmaciesService.findOne(id, userHospitalId);
    const auditHospitalId = req.user.hospitalId || pharmacy.hospitalId;

    return this.pharmaciesService.setSubPharmacies(
      id,
      setSubPharmaciesDto.subPharmacyIds,
      req.user.id,
      auditHospitalId,
    );
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async remove(@Param('id') id: string, @Request() req) {
    // Get pharmacy to determine hospitalId for audit log (needed for Super Admin)
    const userHospitalId = req.user.role === UserRole.SUPER_ADMIN 
      ? undefined 
      : req.user.hospitalId;
    
    const pharmacy = await this.pharmaciesService.findOne(id, userHospitalId);
    
    // For audit log: use user's hospitalId (Hospital Admin) or pharmacy's hospitalId (Super Admin)
    const auditHospitalId = req.user.hospitalId || pharmacy.hospitalId;
    
    return this.pharmaciesService.remove(id, req.user.id, auditHospitalId);
  }
}

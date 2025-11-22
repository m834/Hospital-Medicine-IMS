import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IssuanceService } from './issuance.service';
import { CreateIssuanceDto } from './dto/create-issuance.dto';
import { SearchIssuanceDto } from './dto/search-issuance.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('issuance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuanceController {
  constructor(private readonly issuanceService: IssuanceService) {}

  @Post()
  @Roles(
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  create(@Body() createIssuanceDto: CreateIssuanceDto, @Request() req) {
    return this.issuanceService.create(
      createIssuanceDto,
      req.user.hospitalId,
      req.user.userId,
    );
  }

  @Get()
  @Roles(
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.AUDITOR,
  )
  findAll(@Query() searchDto: SearchIssuanceDto, @Request() req) {
    return this.issuanceService.findAll(searchDto, req.user.hospitalId);
  }

  @Get('stats')
  @Roles(
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  getStats(@Query('pharmacyId') pharmacyId: string, @Request() req) {
    return this.issuanceService.getStats(req.user.hospitalId, pharmacyId);
  }

  @Get(':id')
  @Roles(
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.AUDITOR,
  )
  findOne(@Param('id') id: string, @Request() req) {
    return this.issuanceService.findOne(id, req.user.hospitalId);
  }
}

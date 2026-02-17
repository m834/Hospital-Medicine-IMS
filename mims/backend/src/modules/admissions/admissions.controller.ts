import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdmissionsService } from './admissions.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';
import { DischargeAdmissionDto } from './dto/discharge-admission.dto';
import { AdmissionQueryDto } from './dto/admission-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Admissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admissions')
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Post()
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Create a new admission' })
  @ApiResponse({ status: 201, description: 'Admission created successfully' })
  @ApiResponse({ status: 409, description: 'Patient already has active admission' })
  create(@Body() createAdmissionDto: CreateAdmissionDto) {
    return this.admissionsService.create(createAdmissionDto);
  }

  @Get()
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get all admissions with filters' })
  @ApiResponse({ status: 200, description: 'Admissions retrieved successfully' })
  findAll(@Query() query: AdmissionQueryDto) {
    return this.admissionsService.findAll(query);
  }

  @Get('active/:hospitalId')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get all active admissions for a hospital' })
  @ApiResponse({ status: 200, description: 'Active admissions retrieved successfully' })
  getActiveAdmissions(@Param('hospitalId') hospitalId: string) {
    return this.admissionsService.getActiveAdmissions(hospitalId);
  }

  @Get(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get admission by ID with full details' })
  @ApiResponse({ status: 200, description: 'Admission retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Admission not found' })
  findOne(@Param('id') id: string) {
    return this.admissionsService.findOne(id);
  }

  @Patch(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Update admission details' })
  @ApiResponse({ status: 200, description: 'Admission updated successfully' })
  @ApiResponse({ status: 404, description: 'Admission not found' })
  update(@Param('id') id: string, @Body() updateAdmissionDto: UpdateAdmissionDto) {
    return this.admissionsService.update(id, updateAdmissionDto);
  }

  @Post(':id/discharge')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Discharge a patient' })
  @ApiResponse({ status: 200, description: 'Patient discharged successfully' })
  @ApiResponse({ status: 404, description: 'Admission not found' })
  @ApiResponse({ status: 400, description: 'Admission already discharged' })
  discharge(
    @Param('id') id: string,
    @Body() dischargeDto: DischargeAdmissionDto,
  ) {
    return this.admissionsService.discharge(id, dischargeDto);
  }
}

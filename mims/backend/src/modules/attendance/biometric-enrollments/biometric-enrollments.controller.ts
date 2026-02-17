import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BiometricEnrollmentsService } from './biometric-enrollments.service';
import {
  StartEnrollmentDto,
  EnrollBiometricDto,
  VerifyEnrollmentDto,
  RevokeEnrollmentDto,
  QueryEnrollmentsDto,
  UpdateEnrollmentMetadataDto,
} from './dto/biometric-enrollment.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';
import { EnrollmentType } from '@prisma/client';

@ApiTags('Biometric Enrollments')
@Controller('biometric-enrollments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class BiometricEnrollmentsController {
  constructor(private readonly enrollmentService: BiometricEnrollmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a new biometric enrollment' })
  @ApiResponse({ status: 201, description: 'Enrollment started successfully' })
  async startEnrollment(
    @CurrentHospital() hospitalId: string,
    @Body() dto: StartEnrollmentDto,
  ) {
    return this.enrollmentService.startEnrollment(hospitalId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Query biometric enrollments' })
  @ApiResponse({
    status: 200,
    description: 'Enrollments retrieved successfully',
    isArray: true,
  })
  async queryEnrollments(
    @CurrentHospital() hospitalId: string,
    @Query() query?: QueryEnrollmentsDto,
  ) {
    return this.enrollmentService.queryEnrollments(hospitalId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get enrollment by ID' })
  @ApiResponse({ status: 200, description: 'Enrollment retrieved successfully' })
  async getEnrollment(
    @CurrentHospital() hospitalId: string,
    @Param('id') enrollmentId: string,
  ) {
    return this.enrollmentService.getEnrollment(hospitalId, enrollmentId);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get all enrollments for an employee' })
  @ApiResponse({
    status: 200,
    description: 'Employee enrollments retrieved successfully',
    isArray: true,
  })
  async getEmployeeEnrollments(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.enrollmentService.getEmployeeEnrollments(hospitalId, employeeId);
  }

  @Get('employee/:employeeId/count')
  @ApiOperation({ summary: 'Get enrollment count for employee' })
  @ApiResponse({
    status: 200,
    description: 'Enrollment count retrieved successfully',
  })
  async getEmployeeEnrollmentCount(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
  ) {
    const count = await this.enrollmentService.getEmployeeEnrollmentCount(
      hospitalId,
      employeeId,
    );
    return { employeeId, enrollmentCount: count };
  }

  @Get('type/:enrollmentType/count')
  @ApiOperation({ summary: 'Get enrollment count by type' })
  @ApiResponse({
    status: 200,
    description: 'Enrollment count retrieved successfully',
  })
  async getEnrollmentCountByType(
    @CurrentHospital() hospitalId: string,
    @Param('enrollmentType') enrollmentType: EnrollmentType,
  ) {
    const count = await this.enrollmentService.getEnrollmentCountByType(
      hospitalId,
      enrollmentType as EnrollmentType,
    );
    return { enrollmentType, count };
  }

  @Post(':id/enroll')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enroll a biometric sample' })
  @ApiResponse({
    status: 200,
    description: 'Biometric enrolled successfully',
  })
  async enrollBiometric(
    @CurrentHospital() hospitalId: string,
    @Param('id') enrollmentId: string,
    @Body() dto: EnrollBiometricDto,
  ) {
    return this.enrollmentService.enrollBiometric(hospitalId, enrollmentId, dto);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify enrollment' })
  @ApiResponse({
    status: 200,
    description: 'Verification result returned',
  })
  async verifyEnrollment(
    @CurrentHospital() hospitalId: string,
    @Param('id') enrollmentId: string,
    @Body() dto: VerifyEnrollmentDto,
  ) {
    return this.enrollmentService.verifyEnrollment(hospitalId, enrollmentId, dto);
  }

  @Put(':id/metadata')
  @ApiOperation({ summary: 'Update enrollment metadata' })
  @ApiResponse({
    status: 200,
    description: 'Metadata updated successfully',
  })
  async updateMetadata(
    @CurrentHospital() hospitalId: string,
    @Param('id') enrollmentId: string,
    @Body() dto: UpdateEnrollmentMetadataDto,
  ) {
    return this.enrollmentService.updateEnrollmentMetadata(
      hospitalId,
      enrollmentId,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke enrollment' })
  @ApiResponse({
    status: 204,
    description: 'Enrollment revoked successfully',
  })
  async revokeEnrollment(
    @CurrentHospital() hospitalId: string,
    @Param('id') enrollmentId: string,
    @Body() dto: RevokeEnrollmentDto,
  ) {
    await this.enrollmentService.revokeEnrollment(hospitalId, enrollmentId, dto);
  }
}

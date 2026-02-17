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
import { BiometricDevicesService } from './biometric-devices.service';
import {
  CreateBiometricDeviceDto,
  UpdateBiometricDeviceDto,
  QueryBiometricDevicesDto,
} from './dto/create-biometric-device.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';

@ApiTags('Biometric Devices')
@Controller('biometric-devices')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class BiometricDevicesController {
  constructor(private readonly deviceService: BiometricDevicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new biometric device',
    description: 'Register a new biometric device at a hospital location. Supports fingerprint, face, and iris recognition devices.',
    operationId: 'registerBiometricDevice',
  })
  @ApiResponse({
    status: 201,
    description: 'Device registered successfully',
    schema: {
      example: {
        id: 'dev-12345678',
        name: 'Device 1 - Reception',
        deviceType: 'FINGERPRINT',
        status: 'ACTIVE',
        isOnline: true,
        createdAt: '2026-02-17T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid device data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async registerDevice(
    @CurrentHospital() hospitalId: string,
    @Body() dto: CreateBiometricDeviceDto,
  ) {
    return this.deviceService.registerDevice(hospitalId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all biometric devices',
    description: 'Retrieve all biometric devices registered at the hospital with optional filtering',
  })
  @ApiResponse({
    status: 200,
    description: 'Devices retrieved successfully',
    isArray: true,
    schema: {
      example: [
        {
          id: 'dev-12345678',
          name: 'Device 1 - Reception',
          deviceType: 'FINGERPRINT',
          status: 'ACTIVE',
          isOnline: true,
        },
      ],
    },
  })
  async getDevices(
    @CurrentHospital() hospitalId: string,
    @Query() query?: QueryBiometricDevicesDto,
  ) {
    return this.deviceService.getDevices(hospitalId, query);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active biometric devices' })
  @ApiResponse({
    status: 200,
    description: 'Active devices retrieved successfully',
    isArray: true,
  })
  async getActiveDevices(@CurrentHospital() hospitalId: string) {
    return this.deviceService.getActiveDevices(hospitalId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get device count' })
  @ApiResponse({
    status: 200,
    description: 'Device count retrieved successfully',
  })
  async getDeviceCount(@CurrentHospital() hospitalId: string) {
    const total = await this.deviceService.getDeviceCount(hospitalId);
    const active = await this.deviceService.getDeviceCount(hospitalId, 'ACTIVE');
    const inactive = await this.deviceService.getDeviceCount(hospitalId, 'INACTIVE');

    return {
      total,
      active,
      inactive,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiResponse({
    status: 200,
    description: 'Device retrieved successfully',
  })
  async getDeviceById(
    @CurrentHospital() hospitalId: string,
    @Param('id') deviceId: string,
  ) {
    return this.deviceService.getDeviceById(hospitalId, deviceId);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get device status' })
  @ApiResponse({
    status: 200,
    description: 'Device status retrieved successfully',
  })
  async getDeviceStatus(
    @CurrentHospital() hospitalId: string,
    @Param('id') deviceId: string,
  ) {
    const device = await this.deviceService.getDeviceById(hospitalId, deviceId);
    return {
      id: device.id,
      status: device.status,
      isOnline: device.isOnline,
      lastSyncTime: device.lastSyncTime,
      lastSyncStatus: device.lastSyncStatus,
    };
  }

  @Get(':id/enrollments/count')
  @ApiOperation({ summary: 'Get enrollment count for device' })
  @ApiResponse({
    status: 200,
    description: 'Enrollment count retrieved successfully',
  })
  async getEnrollmentCount(@Param('id') deviceId: string) {
    const count = await this.deviceService.getDeviceEnrollmentCount(deviceId);
    return { deviceId, enrollmentCount: count };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update device configuration' })
  @ApiResponse({
    status: 200,
    description: 'Device updated successfully',
  })
  async updateDevice(
    @CurrentHospital() hospitalId: string,
    @Param('id') deviceId: string,
    @Body() dto: UpdateBiometricDeviceDto,
  ) {
    return this.deviceService.updateDevice(hospitalId, deviceId, dto);
  }

  @Put(':id/online-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update device online status' })
  @ApiResponse({
    status: 200,
    description: 'Device online status updated successfully',
  })
  async setOnlineStatus(
    @CurrentHospital() hospitalId: string,
    @Param('id') deviceId: string,
    @Body() body: { isOnline: boolean },
  ) {
    return this.deviceService.setDeviceOnlineStatus(
      hospitalId,
      deviceId,
      body.isOnline,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete/disable device' })
  @ApiResponse({
    status: 204,
    description: 'Device deleted successfully',
  })
  async deleteDevice(
    @CurrentHospital() hospitalId: string,
    @Param('id') deviceId: string,
  ) {
    await this.deviceService.deleteDevice(hospitalId, deviceId);
  }
}

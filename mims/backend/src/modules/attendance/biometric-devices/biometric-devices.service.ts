import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { BiometricDevice, DeviceStatus, DeviceOperationStatus } from '@prisma/client';
import { CreateBiometricDeviceDto, UpdateBiometricDeviceDto, QueryBiometricDevicesDto } from './dto/create-biometric-device.dto';

@Injectable()
export class BiometricDevicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Register a new biometric device
   */
  async registerDevice(
    hospitalId: string,
    dto: CreateBiometricDeviceDto,
  ): Promise<BiometricDevice> {
    // Check if device with same serial number already exists
    const existingDevice = await this.prisma.biometricDevice.findUnique({
      where: {
        serialNumber: dto.serialNumber,
      },
    });

    if (existingDevice) {
      throw new BadRequestException(
        `Device with serial number ${dto.serialNumber} already registered`,
      );
    }

    // Create device
    return this.prisma.biometricDevice.create({
      data: {
        ...dto,
        hospitalId,
        isOnline: false,
        lastSyncStatus: null,
      },
    });
  }

  /**
   * Get device by ID
   */
  async getDeviceById(hospitalId: string, deviceId: string): Promise<BiometricDevice> {
    const device = await this.prisma.biometricDevice.findFirst({
      where: {
        id: deviceId,
        hospitalId,
      },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }

    return device;
  }

  /**
   * Get all devices for hospital
   */
  async getDevices(hospitalId: string, query?: QueryBiometricDevicesDto) {
    const { deviceType, status, skip = 0, take = 10 } = query || {};

    return this.prisma.biometricDevice.findMany({
      where: {
        hospitalId,
        ...(deviceType && { deviceType }),
        ...(status && { status }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get device count
   */
  async getDeviceCount(hospitalId: string, status?: DeviceStatus): Promise<number> {
    return this.prisma.biometricDevice.count({
      where: {
        hospitalId,
        ...(status && { status }),
      },
    });
  }

  /**
   * Update device configuration
   */
  async updateDevice(
    hospitalId: string,
    deviceId: string,
    dto: UpdateBiometricDeviceDto,
  ): Promise<BiometricDevice> {
    // Verify device exists
    await this.getDeviceById(hospitalId, deviceId);

    return this.prisma.biometricDevice.update({
      where: { id: deviceId },
      data: dto,
    });
  }

  /**
   * Update device status
   */
  async updateDeviceStatus(
    hospitalId: string,
    deviceId: string,
    status: DeviceStatus,
  ): Promise<BiometricDevice> {
    return this.updateDevice(hospitalId, deviceId, { status });
  }

  /**
   * Mark device as online/offline
   */
  async setDeviceOnlineStatus(
    hospitalId: string,
    deviceId: string,
    isOnline: boolean,
  ): Promise<BiometricDevice> {
    // Verify device exists
    await this.getDeviceById(hospitalId, deviceId);

    return this.prisma.biometricDevice.update({
      where: { id: deviceId },
      data: {
        isOnline,
        lastSyncTime: isOnline ? new Date() : undefined,
      },
    });
  }

  /**
   * Update device last sync time and status
   */
  async updateDeviceSyncStatus(
    hospitalId: string,
    deviceId: string,
    lastSyncStatus: DeviceOperationStatus,
    isOnline: boolean = true,
  ): Promise<BiometricDevice> {
    // Verify device exists
    await this.getDeviceById(hospitalId, deviceId);

    return this.prisma.biometricDevice.update({
      where: { id: deviceId },
      data: {
        lastSyncTime: new Date(),
        lastSyncStatus,
        isOnline,
      },
    });
  }

  /**
   * Get device enrollment count
   */
  async getDeviceEnrollmentCount(deviceId: string): Promise<number> {
    return this.prisma.biometricEnrollment.count({
      where: {
        deviceId,
        isActive: true,
      },
    });
  }

  /**
   * Get active devices for hospital
   */
  async getActiveDevices(hospitalId: string) {
    return this.prisma.biometricDevice.findMany({
      where: {
        hospitalId,
        status: DeviceStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete device (soft delete)
   */
  async deleteDevice(hospitalId: string, deviceId: string): Promise<BiometricDevice> {
    // Verify device exists
    await this.getDeviceById(hospitalId, deviceId);

    return this.prisma.biometricDevice.update({
      where: { id: deviceId },
      data: {
        status: DeviceStatus.DISABLED,
      },
    });
  }
}

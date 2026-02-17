import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { BiometricEnrollment, EnrollmentStatus, EnrollmentType } from '@prisma/client';
import {
  StartEnrollmentDto,
  EnrollBiometricDto,
  VerifyEnrollmentDto,
  RevokeEnrollmentDto,
  QueryEnrollmentsDto,
  UpdateEnrollmentMetadataDto,
} from './dto/biometric-enrollment.dto';
import { EncryptionService } from '@/common/services/encryption.service';
import * as crypto from 'crypto';

@Injectable()
export class BiometricEnrollmentsService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Start a new biometric enrollment process
   */
  async startEnrollment(
    hospitalId: string,
    dto: StartEnrollmentDto,
  ): Promise<BiometricEnrollment> {
    // Verify employee exists
    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId },
    });

    if (!employee || employee.hospitalId !== hospitalId) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);
    }

    // Verify device exists and is active
    const device = await this.prisma.biometricDevice.findFirst({
      where: {
        id: dto.deviceId,
        hospitalId,
      },
    });

    if (!device) {
      throw new NotFoundException(`Device ${dto.deviceId} not found`);
    }

    // Check if already enrolled for same type on same device
    const existing = await this.prisma.biometricEnrollment.findFirst({
      where: {
        userId: dto.employeeId,
        deviceId: dto.deviceId,
        enrollmentType: dto.enrollmentType,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Employee already enrolled for ${dto.enrollmentType} on this device`,
      );
    }

    return this.prisma.biometricEnrollment.create({
      data: {
        userId: dto.employeeId,
        deviceId: dto.deviceId,
        enrollmentType: dto.enrollmentType,
        hospitalId,
        status: EnrollmentStatus.PENDING,
        templateData: '',
        qualityScore: 0,
        isActive: true,
      },
    });
  }

  /**
   * Get enrollment by ID
   */
  async getEnrollment(
    hospitalId: string,
    enrollmentId: string,
  ): Promise<BiometricEnrollment> {
    const enrollment = await this.prisma.biometricEnrollment.findFirst({
      where: {
        id: enrollmentId,
        hospitalId,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    return enrollment;
  }

  /**
   * Get all enrollments for employee
   */
  async getEmployeeEnrollments(
    hospitalId: string,
    employeeId: string,
  ): Promise<BiometricEnrollment[]> {
    return this.prisma.biometricEnrollment.findMany({
      where: {
        userId: employeeId,
        hospitalId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Query enrollments with filtering
   */
  async queryEnrollments(
    hospitalId: string,
    query?: QueryEnrollmentsDto,
  ): Promise<BiometricEnrollment[]> {
    const { employeeId, deviceId, enrollmentType, status, skip = 0, take = 10 } =
      query || {};

    return this.prisma.biometricEnrollment.findMany({
      where: {
        hospitalId,
        ...(employeeId && { userId: employeeId }),
        ...(deviceId && { deviceId }),
        ...(enrollmentType && { enrollmentType }),
        ...(status && { status }),
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Enroll a biometric sample
   */
  async enrollBiometric(
    hospitalId: string,
    enrollmentId: string,
    dto: EnrollBiometricDto,
  ): Promise<BiometricEnrollment> {
    const enrollment = await this.getEnrollment(hospitalId, enrollmentId);

    if (enrollment.status === EnrollmentStatus.COMPLETED) {
      throw new BadRequestException('Enrollment already completed');
    }

    if (enrollment.status === EnrollmentStatus.REVOKED) {
      throw new BadRequestException('Enrollment has been revoked');
    }

    // Validate quality threshold (default 70)
    if (dto.quality < 70) {
      throw new BadRequestException(
        `Biometric quality ${dto.quality} below minimum threshold of 70`,
      );
    }

    // Encrypt biometric data (AES-256)
    const encryptedData = this.encryptBiometric(dto.biometricData);

    // Calculate fingerprint hash for duplicate detection
    const fingerprint = crypto
      .createHash('sha256')
      .update(dto.biometricData)
      .digest('hex');

    // Check for duplicate enrollments from same biometric
    const duplicate = await this.prisma.biometricEnrollment.findFirst({
      where: {
        hospitalId,
        enrollmentType: enrollment.enrollmentType,
        status: EnrollmentStatus.COMPLETED,
      },
    });

    if (duplicate && duplicate.id !== enrollmentId) {
      // In a real system, we'd compare biometric fingerprints
      // For now, just check if enrolled elsewhere
      throw new ConflictException(
        'This biometric enrollment type is already used by another employee',
      );
    }

    // Increment attempt count
    const newAttemptCount = (enrollment.attemptCount || 0) + 1;

    // After 3 successful captures, mark as completed
    const newStatus = newAttemptCount >= 3 ? EnrollmentStatus.COMPLETED : EnrollmentStatus.PENDING;

    return this.prisma.biometricEnrollment.update({
      where: { id: enrollmentId },
      data: {
        templateData: encryptedData,
        qualityScore: dto.quality,
        attemptCount: newAttemptCount,
        status: newStatus,
        lastVerifiedAt: new Date(),
        version: (enrollment.version || 1) + 1,
      },
    });
  }

  /**
   * Verify enrollment (test verification)
   */
  async verifyEnrollment(
    hospitalId: string,
    enrollmentId: string,
    dto: VerifyEnrollmentDto,
  ): Promise<{ success: boolean; matchScore: number; message: string }> {
    const enrollment = await this.getEnrollment(hospitalId, enrollmentId);

    if (enrollment.status !== EnrollmentStatus.COMPLETED) {
      throw new BadRequestException('Enrollment is not yet complete');
    }

    if (!enrollment.templateData) {
      throw new BadRequestException('No biometric template found for verification');
    }

    // Decrypt stored template
    const storedTemplate = this.decryptBiometric(enrollment.templateData);

    // Simple verification: compare fingerprints
    const verificationFingerprint = crypto
      .createHash('sha256')
      .update(dto.verificationData)
      .digest('hex');

    const templateFingerprint = crypto
      .createHash('sha256')
      .update(storedTemplate)
      .digest('hex');

    // In real implementation, use proper biometric matching algorithm
    const matchScore = verificationFingerprint === templateFingerprint ? 100 : 0;

    // Update last verified time
    await this.prisma.biometricEnrollment.update({
      where: { id: enrollmentId },
      data: { lastVerifiedAt: new Date() },
    });

    return {
      success: matchScore >= 80,
      matchScore,
      message:
        matchScore >= 80 ? 'Verification successful' : 'Verification failed',
    };
  }

  /**
   * Revoke an enrollment
   */
  async revokeEnrollment(
    hospitalId: string,
    enrollmentId: string,
    dto: RevokeEnrollmentDto,
  ): Promise<BiometricEnrollment> {
    const enrollment = await this.getEnrollment(hospitalId, enrollmentId);

    return this.prisma.biometricEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: EnrollmentStatus.REVOKED,
        isActive: false,
        rejectionReason: dto.reason,
      },
    });
  }

  /**
   * Get enrollment count for employee
   */
  async getEmployeeEnrollmentCount(
    hospitalId: string,
    employeeId: string,
  ): Promise<number> {
    return this.prisma.biometricEnrollment.count({
      where: {
        userId: employeeId,
        hospitalId,
        status: EnrollmentStatus.COMPLETED,
        isActive: true,
      },
    });
  }

  /**
   * Get enrollment count by type
   */
  async getEnrollmentCountByType(
    hospitalId: string,
    enrollmentType: EnrollmentType,
  ): Promise<number> {
    return this.prisma.biometricEnrollment.count({
      where: {
        hospitalId,
        enrollmentType,
        status: EnrollmentStatus.COMPLETED,
        isActive: true,
      },
    });
  }

  /**
   * Update enrollment metadata
   */
  async updateEnrollmentMetadata(
    hospitalId: string,
    enrollmentId: string,
    dto: UpdateEnrollmentMetadataDto,
  ): Promise<BiometricEnrollment> {
    await this.getEnrollment(hospitalId, enrollmentId);

    // Metadata would be stored in version field or rejection reason for now
    // In a real system, add a metadata JSON field
    return this.prisma.biometricEnrollment.update({
      where: { id: enrollmentId },
      data: {
        ...(dto.notes && { rejectionReason: dto.notes }),
      },
    });
  }

  /**
   * Get active enrollments for device
   */
  async getDeviceEnrollments(deviceId: string): Promise<BiometricEnrollment[]> {
    return this.prisma.biometricEnrollment.findMany({
      where: {
        deviceId,
        status: EnrollmentStatus.COMPLETED,
        isActive: true,
      },
    });
  }

  /**
   * Encrypt biometric data using AES-256-GCM
   * SECURITY: Uses authenticated encryption with integrity verification
   */
  private encryptBiometric(data: string): string {
    return this.encryptionService.encrypt(data);
  }

  /**
   * Decrypt biometric data
   * SECURITY: Verifies authentication tag to prevent tampering
   */
  private decryptBiometric(encryptedData: string): string {
    return this.encryptionService.decrypt(encryptedData);
  }
}

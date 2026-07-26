import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateHospitalDto, UpdateHospitalDto, CreateHospitalUserDto } from './dto';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all hospitals
   * @returns Array of hospitals
   */
  async findAll() {
    return this.prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            pharmacies: true,
            patients: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get single hospital by ID
   * @param id Hospital ID
   * @returns Hospital details
   */
  async findOne(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            pharmacies: true,
            patients: true,
            medicines: true,
            prescriptions: true,
            issueTransactions: true,
          },
        },
      },
    });

    if (!hospital) {
      throw new NotFoundException(`Hospital with ID ${id} not found`);
    }

    return hospital;
  }

  /**
   * Create new hospital
   * @param createHospitalDto Hospital data
   * @param userId User creating the hospital (for audit)
   * @returns Created hospital
   */
  async create(createHospitalDto: CreateHospitalDto, userId: string) {
    // Check if hospital code already exists
    const existingHospital = await this.prisma.hospital.findUnique({
      where: { code: createHospitalDto.code },
    });

    if (existingHospital) {
      throw new ConflictException(`Hospital with code ${createHospitalDto.code} already exists`);
    }

    // Create hospital
    const hospital = await this.prisma.hospital.create({
      data: createHospitalDto,
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create audit log separately (hospital ID needed)
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          hospitalId: hospital.id,
          userId,
          entityType: 'HOSPITAL',
          entityId: hospital.id,
          action: 'CREATE',
          beforeState: null,
          afterState: JSON.parse(JSON.stringify(createHospitalDto)),
          ipAddress: '0.0.0.0',
          userAgent: 'API',
        },
      });
    }

    return hospital;
  }

  /**
   * Update hospital
   * @param id Hospital ID
   * @param updateHospitalDto Updated data
   * @param userId User updating the hospital (for audit)
   * @returns Updated hospital
   */
  async update(id: string, updateHospitalDto: UpdateHospitalDto, userId: string) {
    // Check if hospital exists
    const existingHospital = await this.findOne(id);

    // If updating code, check for conflicts
    if (updateHospitalDto.code && updateHospitalDto.code !== existingHospital.code) {
      const codeExists = await this.prisma.hospital.findUnique({
        where: { code: updateHospitalDto.code },
      });

      if (codeExists) {
        throw new ConflictException(`Hospital with code ${updateHospitalDto.code} already exists`);
      }
    }

    // Update hospital
    const hospital = await this.prisma.hospital.update({
      where: { id },
      data: updateHospitalDto,
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create audit log
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          hospitalId: id,
          userId,
          entityType: 'HOSPITAL',
          entityId: id,
          action: 'UPDATE',
          beforeState: JSON.parse(JSON.stringify(existingHospital)),
          afterState: JSON.parse(JSON.stringify(updateHospitalDto)),
          ipAddress: '0.0.0.0',
          userAgent: 'API',
        },
      });
    }

    return hospital;
  }

  /**
   * Soft delete hospital (set status to INACTIVE)
   * @param id Hospital ID
   * @param userId User deleting the hospital (for audit)
   * @returns Deleted hospital
   */
  async remove(id: string, userId: string) {
    // Check if hospital exists
    await this.findOne(id);

    // Soft delete by setting status to INACTIVE
    const hospital = await this.prisma.hospital.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
      },
    });

    // Create audit log
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          hospitalId: id,
          userId,
          entityType: 'HOSPITAL',
          entityId: id,
          action: 'DELETE',
          beforeState: JSON.parse(JSON.stringify(hospital)),
          afterState: { status: 'INACTIVE' },
          ipAddress: '0.0.0.0',
          userAgent: 'API',
        },
      });
    }

    return hospital;
  }

  /**
   * Get users for a specific hospital
   * @param hospitalId Hospital ID
   * @returns Array of users
   */
  async findHospitalUsers(
    hospitalId: string,
    filters?: { role?: string; departmentId?: string; subDepartmentId?: string },
  ) {
    // Check if hospital exists
    await this.findOne(hospitalId);

    const where: any = { hospitalId };

    if (filters?.role) {
      where.role = filters.role;
    }

    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }

    if (filters?.subDepartmentId) {
      where.subDepartmentId = filters.subDepartmentId;
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        pharmacyId: true,
        departmentId: true,
        subDepartmentId: true,
        managedDepartmentId: true,
        pharmacy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subDepartment: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Add a new user to a hospital
   * Note: SUPER_ADMIN role is NOT allowed via this endpoint
   * @param hospitalId Hospital ID
   * @param createUserDto User data
   * @param createdBy User creating this user (for audit)
   * @returns Created user
   */
  async addUser(hospitalId: string, createUserDto: CreateHospitalUserDto, createdBy: string) {
    // Check if hospital exists
    await this.findOne(hospitalId);

    // Validate role - SUPER_ADMIN not allowed
    if (createUserDto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot create SUPER_ADMIN users via hospital user endpoint');
    }

    // Allowed hospital roles (exclude MASTER_ADMIN and SUPER_ADMIN)
    const allowedRoles: UserRole[] = [
      UserRole.HOSPITAL_ADMIN,
      UserRole.DEPARTMENT_ADMIN,
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.DOCTOR,
      UserRole.DOCTOR_ASSISTANT,
      UserRole.REGISTRATION_STAFF,
      UserRole.PHARMACY_STAFF,
      UserRole.AUDITOR,
      UserRole.LAB_TECHNICIAN,
      UserRole.RADIOLOGIST,
      UserRole.NURSE,
      UserRole.BILLING_STAFF,
      UserRole.RECEPTIONIST,
    ];

    if (!allowedRoles.includes(createUserDto.role as UserRole)) {
      throw new BadRequestException(`Invalid role. Allowed roles: ${allowedRoles.join(', ')}`);
    }

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException(`User with email ${createUserDto.email} already exists`);
    }

    // If pharmacy role, validate pharmacyId is provided and belongs to hospital
    const pharmacyRoles: UserRole[] = [
      UserRole.MAIN_PHARMACY_MANAGER,
      UserRole.SUB_PHARMACY_MANAGER,
      UserRole.PHARMACY_STAFF,
    ];

    if (pharmacyRoles.includes(createUserDto.role)) {
      if (!createUserDto.pharmacyId) {
        throw new BadRequestException(`Pharmacy ID is required for ${createUserDto.role} role`);
      }

      // Validate pharmacy belongs to hospital
      const pharmacy = await this.prisma.pharmacy.findFirst({
        where: {
          id: createUserDto.pharmacyId,
          hospitalId,
        },
      });

      if (!pharmacy) {
        throw new BadRequestException(
          `Pharmacy with ID ${createUserDto.pharmacyId} not found in this hospital`,
        );
      }

      // Validate pharmacy type matches role
      if (
        createUserDto.role === UserRole.MAIN_PHARMACY_MANAGER &&
        pharmacy.type !== 'MAIN'
      ) {
        throw new BadRequestException('MAIN_PHARMACY_MANAGER can only be assigned to MAIN pharmacy');
      }

      if (
        createUserDto.role === UserRole.SUB_PHARMACY_MANAGER &&
        pharmacy.type !== 'SUB'
      ) {
        throw new BadRequestException('SUB_PHARMACY_MANAGER can only be assigned to SUB pharmacy');
      }
    }

    // If department-scoped roles, validate departmentId and subDepartmentId (if provided)
    const departmentRoles: UserRole[] = [
      UserRole.DEPARTMENT_ADMIN,
      UserRole.DOCTOR,
      UserRole.DOCTOR_ASSISTANT,
      UserRole.REGISTRATION_STAFF,
      UserRole.AUDITOR,
      UserRole.LAB_TECHNICIAN,
      UserRole.RADIOLOGIST,
      UserRole.NURSE,
      UserRole.BILLING_STAFF,
      UserRole.RECEPTIONIST,
    ];

    if (departmentRoles.includes(createUserDto.role)) {
      if (!createUserDto.departmentId) {
        throw new BadRequestException(`Department ID is required for ${createUserDto.role} role`);
      }

      // Validate department belongs to hospital
      const department = await this.prisma.department.findFirst({
        where: {
          id: createUserDto.departmentId,
          hospitalId,
        },
      });

      if (!department) {
        throw new BadRequestException(
          `Department with ID ${createUserDto.departmentId} not found in this hospital`,
        );
      }

      // If subDepartmentId provided, validate it belongs to the department
      if (createUserDto.subDepartmentId) {
        const subDepartment = await this.prisma.subDepartment.findFirst({
          where: {
            id: createUserDto.subDepartmentId,
            departmentId: createUserDto.departmentId,
          },
        });

        if (!subDepartment) {
          throw new BadRequestException(
            `Sub-department with ID ${createUserDto.subDepartmentId} not found for the given department`,
          );
        }
      }
    }

    // Hash password
    const passwordHash = await argon2.hash(createUserDto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        fullName: createUserDto.fullName,
        phone: createUserDto.phone,
        role: createUserDto.role,
        hospitalId,
        pharmacyId: createUserDto.pharmacyId,
        departmentId: createUserDto.departmentId,
        subDepartmentId: createUserDto.subDepartmentId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        status: true,
        hospitalId: true,
        pharmacyId: true,
        departmentId: true,
        subDepartmentId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        createdAt: true,
      },
    });

    // Create audit log
    if (createdBy) {
      await this.prisma.auditLog.create({
        data: {
          hospitalId,
          userId: createdBy,
          entityType: 'USER',
          entityId: user.id,
          action: 'CREATE_USER',
          beforeState: null,
          afterState: {
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            hospitalId: user.hospitalId,
            pharmacyId: user.pharmacyId,
            departmentId: user.departmentId,
            subDepartmentId: user.subDepartmentId,
          },
          ipAddress: '0.0.0.0',
          userAgent: 'API',
        },
      });
    }

    return user;
  }

  /**
   * Assign Hospital Admin to a hospital
   * @param hospitalId Hospital ID
   * @param userId User ID to assign as admin
   * @param assignedByUserId User making the assignment (for audit)
   * @returns Updated user
   */
  async assignAdmin(hospitalId: string, userId: string, assignedByUserId: string) {
    // Check if hospital exists
    await this.findOne(hospitalId);

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if user is HOSPITAL_ADMIN role
    if (user.role !== UserRole.HOSPITAL_ADMIN) {
      throw new BadRequestException('User must have HOSPITAL_ADMIN role to be assigned');
    }

    // Assign hospital to user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        hospitalId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Create audit log
    if (assignedByUserId) {
      await this.prisma.auditLog.create({
        data: {
          hospitalId,
          userId: assignedByUserId,
          entityType: 'USER',
          entityId: userId,
          action: 'ASSIGN_HOSPITAL_ADMIN',
          beforeState: { hospitalId: user.hospitalId },
          afterState: { hospitalId },
          ipAddress: '0.0.0.0',
          userAgent: 'API',
        },
      });
    }

    return updatedUser;
  }
}

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { User, UserRole, DepartmentStatus } from '@prisma/client';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}


  /**
   * Create a new department
   * Only MASTER_ADMIN can create departments for any hospital
   * SUPER_ADMIN and HOSPITAL_ADMIN can create departments for their hospital
   */
  async create(hospitalId: string, createDepartmentDto: CreateDepartmentDto, user: User) {
    // Check if department code already exists in this hospital
    const existing = await this.prisma.department.findUnique({
      where: {
        hospitalId_code: {
          hospitalId,
          code: createDepartmentDto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Department with code '${createDepartmentDto.code}' already exists in this hospital`);
    }

    // Validate user has access to this hospital
    if (user.role !== UserRole.MASTER_ADMIN && user.hospitalId !== hospitalId) {
      throw new ForbiddenException('You can only create departments in your own hospital');
    }

    return this.prisma.department.create({
      data: {
        hospitalId,
        ...createDepartmentDto,
        status: createDepartmentDto.status || DepartmentStatus.ACTIVE,
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subDepartments: true,
        _count: {
          select: {
            users: true,
            subDepartments: true,
          },
        },
      },
    });
  }

  /**
   * Get all departments
   * Filters based on user's role and hospital
   */
  async findAll(user: User) {
    const where: any = {};

    // Filter based on user role
    if (user.role === UserRole.MASTER_ADMIN) {
      // MASTER_ADMIN can see all departments
    } else if (user.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN can see all departments
    } else if (user.role === UserRole.HOSPITAL_ADMIN || user.role === UserRole.MAIN_PHARMACY_MANAGER) {
      // Hospital-scoped roles see only their hospital's departments
      where.hospitalId = user.hospitalId;
    } else if (user.role === UserRole.DEPARTMENT_ADMIN) {
      // DEPARTMENT_ADMIN can only see their own department
      where.id = user.managedDepartmentId;
    } else {
      // Other roles see departments in their hospital
      where.hospitalId = user.hospitalId;
    }

    return this.prisma.department.findMany({
      where,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            users: true,
            subDepartments: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get a single department by ID
   */
  async findOne(id: string, user: User) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subDepartments: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        departmentAdmins: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            users: true,
            subDepartments: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    // Validate user has access to this department
    if (user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      if (user.hospitalId !== department.hospitalId) {
        throw new ForbiddenException('You do not have access to this department');
      }

      if (user.role === UserRole.DEPARTMENT_ADMIN && user.managedDepartmentId !== department.id) {
        throw new ForbiddenException('You can only access your own department');
      }
    }

    return department;
  }

  /**
   * Update a department
   * Only MASTER_ADMIN can update any department
   */
  async update(id: string, updateDepartmentDto: UpdateDepartmentDto, user: User) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    // Validate user has access
    if (user.role !== UserRole.MASTER_ADMIN) {
      throw new ForbiddenException('Only MASTER_ADMIN can update departments');
    }

    // If code is being updated, check for conflicts
    if (updateDepartmentDto.code && updateDepartmentDto.code !== department.code) {
      const existing = await this.prisma.department.findUnique({
        where: {
          hospitalId_code: {
            hospitalId: department.hospitalId,
            code: updateDepartmentDto.code,
          },
        },
      });

      if (existing) {
        throw new ConflictException(`Department with code '${updateDepartmentDto.code}' already exists in this hospital`);
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        subDepartments: true,
        _count: {
          select: {
            users: true,
            subDepartments: true,
          },
        },
      },
    });
  }

  /**
   * Delete a department
   * Only MASTER_ADMIN can delete departments
   */
  async remove(id: string, user: User) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            subDepartments: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${id} not found`);
    }

    // Only MASTER_ADMIN can delete
    if (user.role !== UserRole.MASTER_ADMIN) {
      throw new ForbiddenException('Only MASTER_ADMIN can delete departments');
    }

    // Check if department has users or sub-departments
    if (department._count.users > 0) {
      throw new ConflictException('Cannot delete department with assigned users. Please reassign users first.');
    }

    if (department._count.subDepartments > 0) {
      throw new ConflictException('Cannot delete department with sub-departments. Please delete sub-departments first.');
    }

    await this.prisma.department.delete({
      where: { id },
    });

    return { message: 'Department deleted successfully' };
  }

  /**
   * Get departments by hospital ID
   */
  async findByHospital(hospitalId: string, user: User) {
    // Validate user has access
    if (user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      if (user.hospitalId !== hospitalId) {
        throw new ForbiddenException('You do not have access to this hospital');
      }
    }

    return this.prisma.department.findMany({
      where: { hospitalId },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            users: true,
            subDepartments: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

}

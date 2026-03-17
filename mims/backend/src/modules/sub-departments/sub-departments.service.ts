import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSubDepartmentDto } from './dto/create-sub-department.dto';
import { UpdateSubDepartmentDto } from './dto/update-sub-department.dto';
import { User, UserRole, SubDepartmentStatus } from '@prisma/client';

@Injectable()
export class SubDepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new sub-department
   * Only MASTER_ADMIN, SUPER_ADMIN, HOSPITAL_ADMIN, and DEPARTMENT_ADMIN can create sub-departments
   */
  async create(departmentId: string, createSubDepartmentDto: CreateSubDepartmentDto, user: User) {
    // Verify department exists
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${departmentId} not found`);
    }

    // Check access
    if (user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      if (user.hospitalId !== department.hospitalId) {
        throw new ForbiddenException('You can only create sub-departments in your own hospital');
      }

      if (user.role === UserRole.DEPARTMENT_ADMIN && user.managedDepartmentId !== departmentId) {
        throw new ForbiddenException('You can only create sub-departments in your own department');
      }
    }

    // Check for duplicate code
    const existing = await this.prisma.subDepartment.findUnique({
      where: {
        departmentId_code: {
          departmentId,
          code: createSubDepartmentDto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Sub-department with code '${createSubDepartmentDto.code}' already exists in this department`);
    }

    return this.prisma.subDepartment.create({
      data: {
        departmentId,
        ...createSubDepartmentDto,
        status: createSubDepartmentDto.status || SubDepartmentStatus.ACTIVE,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            hospitalId: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  /**
   * Get all sub-departments
   * Filters based on user's role and department
   */
  async findAll(user: User) {
    const where: any = {};

    // Filter based on user role
    if (user.role === UserRole.MASTER_ADMIN || user.role === UserRole.SUPER_ADMIN) {
      // Can see all sub-departments
    } else if (user.role === UserRole.HOSPITAL_ADMIN) {
      // Hospital-scoped: see sub-departments in their hospital
      where.department = {
        hospitalId: user.hospitalId,
      };
    } else if (user.role === UserRole.DEPARTMENT_ADMIN) {
      // Department-scoped: see sub-departments in their department
      where.departmentId = user.managedDepartmentId;
    } else {
      // Other roles see sub-departments in their hospital
      where.department = {
        hospitalId: user.hospitalId,
      };
    }

    return this.prisma.subDepartment.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            hospitalId: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get sub-departments by department ID
   */
  async findByDepartment(departmentId: string, user: User) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID ${departmentId} not found`);
    }

    // Validate access
    if (user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      if (user.hospitalId !== department.hospitalId) {
        throw new ForbiddenException('You do not have access to this department');
      }

      if (user.role === UserRole.DEPARTMENT_ADMIN && user.managedDepartmentId !== departmentId) {
        throw new ForbiddenException('You can only access sub-departments in your own department');
      }
    }

    return this.prisma.subDepartment.findMany({
      where: { departmentId },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Get a single sub-department by ID
   */
  async findOne(id: string, user: User) {
    const subDepartment = await this.prisma.subDepartment.findUnique({
      where: { id },
      include: {
        department: {
          include: {
            hospital: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
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
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!subDepartment) {
      throw new NotFoundException(`Sub-department with ID ${id} not found`);
    }

    // Validate access
    if (user.role !== UserRole.MASTER_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      if (user.hospitalId !== subDepartment.department.hospitalId) {
        throw new ForbiddenException('You do not have access to this sub-department');
      }

      if (user.role === UserRole.DEPARTMENT_ADMIN && user.managedDepartmentId !== subDepartment.departmentId) {
        throw new ForbiddenException('You can only access sub-departments in your own department');
      }
    }

    return subDepartment;
  }

  /**
   * Update a sub-department
   * Only MASTER_ADMIN can update sub-departments
   */
  async update(id: string, updateSubDepartmentDto: UpdateSubDepartmentDto, user: User) {
    const subDepartment = await this.prisma.subDepartment.findUnique({
      where: { id },
    });

    if (!subDepartment) {
      throw new NotFoundException(`Sub-department with ID ${id} not found`);
    }

    // Only MASTER_ADMIN can update
    if (user.role !== UserRole.MASTER_ADMIN &&
        user.role !== UserRole.SUPER_ADMIN &&
        user.role !== UserRole.HOSPITAL_ADMIN) {
      throw new ForbiddenException('Only MASTER_ADMIN, SUPER_ADMIN, or HOSPITAL_ADMIN can update sub-departments');
    }

    // Check for code conflict if code is being updated
    if (updateSubDepartmentDto.code && updateSubDepartmentDto.code !== subDepartment.code) {
      const existing = await this.prisma.subDepartment.findUnique({
        where: {
          departmentId_code: {
            departmentId: subDepartment.departmentId,
            code: updateSubDepartmentDto.code,
          },
        },
      });

      if (existing) {
        throw new ConflictException(`Sub-department with code '${updateSubDepartmentDto.code}' already exists in this department`);
      }
    }

    return this.prisma.subDepartment.update({
      where: { id },
      data: updateSubDepartmentDto,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            hospitalId: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  /**
   * Delete a sub-department
   * Only MASTER_ADMIN can delete sub-departments
   */
  async remove(id: string, user: User) {
    const subDepartment = await this.prisma.subDepartment.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!subDepartment) {
      throw new NotFoundException(`Sub-department with ID ${id} not found`);
    }

    // Only MASTER_ADMIN can delete
    if (user.role !== UserRole.MASTER_ADMIN &&
        user.role !== UserRole.SUPER_ADMIN &&
        user.role !== UserRole.HOSPITAL_ADMIN) {
      throw new ForbiddenException('Only MASTER_ADMIN, SUPER_ADMIN, or HOSPITAL_ADMIN can delete sub-departments');
    }

    // Check if sub-department has users
    if (subDepartment._count.users > 0) {
      throw new ConflictException('Cannot delete sub-department with assigned users. Please reassign users first.');
    }

    await this.prisma.subDepartment.delete({
      where: { id },
    });

    return { message: 'Sub-department deleted successfully' };
  }
}

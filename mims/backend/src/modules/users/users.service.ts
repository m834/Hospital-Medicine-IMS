import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string, requestingUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
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
            locationWard: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, requestingUserId: string) {
    // Get requesting user to check permissions
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true, hospitalId: true },
    });

    if (!requestingUser) {
      throw new ForbiddenException('Invalid user');
    }

    // Get the user being updated
    const userToUpdate = await this.prisma.user.findUnique({
      where: { id },
      select: { hospitalId: true, role: true },
    });

    if (!userToUpdate) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Permission checks
    if (requestingUser.role === UserRole.HOSPITAL_ADMIN) {
      // Hospital Admin can only update users in their own hospital
      if (requestingUser.hospitalId !== userToUpdate.hospitalId) {
        throw new ForbiddenException('You can only update users in your own hospital');
      }

      // Hospital Admin cannot change user to SUPER_ADMIN
      if (updateUserDto.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot assign SUPER_ADMIN role');
      }

      // Hospital Admin cannot update SUPER_ADMIN users
      if (userToUpdate.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot update SUPER_ADMIN users');
      }
    }

    // If pharmacyId is being updated, validate it
    if (updateUserDto.pharmacyId !== undefined) {
      if (updateUserDto.pharmacyId) {
        const pharmacy = await this.prisma.pharmacy.findUnique({
          where: { id: updateUserDto.pharmacyId },
          select: { hospitalId: true, status: true },
        });

        if (!pharmacy) {
          throw new BadRequestException('Pharmacy not found');
        }

        if (pharmacy.hospitalId !== userToUpdate.hospitalId) {
          throw new BadRequestException('Pharmacy must belong to the same hospital as the user');
        }

        if (pharmacy.status !== 'ACTIVE') {
          throw new BadRequestException('Cannot assign user to inactive pharmacy');
        }
      }
    }

    // If email is being updated, check uniqueness
    if (updateUserDto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser && existingUser.id !== id) {
        throw new BadRequestException('Email already in use');
      }
    }

    // Update the user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...updateUserDto,
        version: { increment: 1 },
      },
      include: {
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
            locationWard: true,
            status: true,
          },
        },
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: updatedUser.hospitalId,
        userId: requestingUserId,
        action: 'UPDATE',
        entityType: 'User',
        entityId: id,
        afterState: JSON.stringify(updateUserDto),
      },
    });

    return updatedUser;
  }

  async remove(id: string, requestingUserId: string) {
    // Get requesting user to check permissions
    const requestingUser = await this.prisma.user.findUnique({
      where: { id: requestingUserId },
      select: { role: true, hospitalId: true },
    });

    if (!requestingUser) {
      throw new ForbiddenException('Invalid user');
    }

    // Get the user being deleted
    const userToDelete = await this.prisma.user.findUnique({
      where: { id },
      select: { hospitalId: true, role: true },
    });

    if (!userToDelete) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Permission checks
    if (requestingUser.role === UserRole.HOSPITAL_ADMIN) {
      // Hospital Admin can only delete users in their own hospital
      if (requestingUser.hospitalId !== userToDelete.hospitalId) {
        throw new ForbiddenException('You can only delete users in your own hospital');
      }

      // Hospital Admin cannot delete SUPER_ADMIN users
      if (userToDelete.role === UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot delete SUPER_ADMIN users');
      }
    }

    // Prevent self-deletion
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Soft delete by setting status to INACTIVE
    const deletedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        version: { increment: 1 },
      },
      select: {
        hospitalId: true,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: deletedUser.hospitalId,
        userId: requestingUserId,
        action: 'DELETE',
        entityType: 'User',
        entityId: id,
        afterState: JSON.stringify({ status: 'INACTIVE' }),
      },
    });

    return { message: 'User deleted successfully' };
  }
}

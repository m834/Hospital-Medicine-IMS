import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { UpdateUserDto } from './dto';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * The JWT strategy caches each signed-in user for two minutes. Drop that
   * entry after a change, so a deactivated user is signed out and a new role or
   * department applies on their next request, not two minutes later.
   */
  private async forgetSignedInUser(id: string) {
    await this.cacheService.delete(`user:auth:${id}`);
  }

  /**
   * Strip credential fields before a user record leaves the API. Prisma returns
   * every scalar by default, so without this the password hash and reset token
   * would be sent to the client.
   */
  private sanitize<T extends Record<string, any>>(user: T) {
    const { passwordHash, resetToken, resetTokenExpiry, ...safe } = user;
    return safe;
  }

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

    return this.sanitize(user);
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

    // A department, and a sub-department under it, must be this hospital's.
    if (updateUserDto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: updateUserDto.departmentId },
        select: { hospitalId: true },
      });

      if (!department || department.hospitalId !== userToUpdate.hospitalId) {
        throw new BadRequestException('Department must belong to the same hospital as the user');
      }
    }

    if (updateUserDto.subDepartmentId) {
      const subDepartment = await this.prisma.subDepartment.findUnique({
        where: { id: updateUserDto.subDepartmentId },
        select: { departmentId: true },
      });

      if (!subDepartment || subDepartment.departmentId !== updateUserDto.departmentId) {
        throw new BadRequestException('Sub-department must belong to the selected department');
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

    // Separate the raw password from everything else: it must never reach
    // Prisma as-is, nor the audit log. Absent password = unchanged password.
    const { password, ...userFields } = updateUserDto;
    const passwordHash = password ? await argon2.hash(password) : undefined;

    // Update the user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...userFields,
        ...(passwordHash ? { passwordHash } : {}),
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

    // Create audit log — a password reset is recorded, but never its value
    await this.prisma.auditLog.create({
      data: {
        hospitalId: updatedUser.hospitalId,
        userId: requestingUserId,
        action: 'UPDATE',
        module: 'Users',
        entityType: 'User',
        entityId: id,
        description: password
          ? `Updated user ${updatedUser.email} and reset their password`
          : `Updated user ${updatedUser.email}`,
        afterState: JSON.stringify({
          ...userFields,
          ...(password ? { password: '[REDACTED]' } : {}),
        }),
      },
    });

    await this.forgetSignedInUser(id);

    return this.sanitize(updatedUser);
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
        email: true,
        fullName: true,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: deletedUser.hospitalId,
        userId: requestingUserId,
        action: 'DELETE',
        module: 'Users',
        entityType: 'User',
        entityId: id,
        description: `Deleted user ${deletedUser.fullName} (${deletedUser.email}) — set to INACTIVE`,
        afterState: JSON.stringify({ status: 'INACTIVE' }),
      },
    });

    await this.forgetSignedInUser(id);

    return { message: 'User deleted successfully' };
  }

  /**
   * The records a user can be named on that must outlive them: hospital and
   * stock data. While any exist the user cannot be erased — most of these links
   * are RESTRICT in the database anyway, and the rest would silently lose who
   * did the work. Personal rows (notifications, attendance, shifts, leave,
   * payroll, biometrics, clinics) cascade with the user and are not listed.
   */
  private async countRecordsKeepingUser(id: string) {
    const counts = await Promise.all([
      ['patients registered', this.prisma.patient.count({ where: { registeredBy: id } })],
      ['patients as attending doctor', this.prisma.patient.count({ where: { attendingDoctorId: id } })],
      ['receipts', this.prisma.receipt.count({ where: { generatedById: id } })],
      ['lab orders', this.prisma.labOrder.count({ where: { orderedById: id } })],
      [
        'lab results collected, entered or approved',
        this.prisma.labOrder.count({
          where: {
            OR: [{ sampleCollectedById: id }, { resultsEnteredById: id }, { resultsApprovedById: id }],
          },
        }),
      ],
      [
        'visits',
        this.prisma.visit.count({
          where: { OR: [{ registrarId: id }, { consultantId: id }, { attendingDoctorId: id }] },
        }),
      ],
      ['referrals', this.prisma.referral.count({ where: { referrerId: id } })],
      [
        'admissions',
        this.prisma.admission.count({
          where: {
            OR: [{ attendingDoctorId: id }, { admittingUserId: id }, { dischargingUserId: id }],
          },
        }),
      ],
      ['operations', this.prisma.operation.count({ where: { surgeonId: id } })],
      [
        'prescriptions',
        this.prisma.prescription.count({ where: { OR: [{ doctorId: id }, { createdBy: id }] } }),
      ],
      ['prescription medicines added', this.prisma.prescriptionMedicine.count({ where: { addedBy: id } })],
      ['prescription dispatches', this.prisma.prescriptionDispatch.count({ where: { dispatchedBy: id } })],
      ['medicine templates', this.prisma.medicineTemplate.count({ where: { createdBy: id } })],
      ['medicine issues', this.prisma.issueTransaction.count({ where: { issuedBy: id } })],
      ['medicine returns', this.prisma.returnTransaction.count({ where: { returnedBy: id } })],
      ['disposals', this.prisma.disposalTransaction.count({ where: { disposedBy: id } })],
      [
        'transfers',
        this.prisma.transferRequest.count({
          where: { OR: [{ requestedBy: id }, { approvedBy: id }, { receivedBy: id }] },
        }),
      ],
      ['purchase orders', this.prisma.purchaseOrder.count({ where: { createdBy: id } })],
      ['goods received notes', this.prisma.gRN.count({ where: { receivedBy: id } })],
      ['expenditures', this.prisma.expenditure.count({ where: { createdBy: id } })],
      ['shifts assigned to others', this.prisma.employeeShift.count({ where: { assignedBy: id } })],
    ].map(async ([label, count]) => [label, await count] as [string, number]));

    return counts.filter(([, count]) => count > 0);
  }

  /**
   * Erase a user for good — for clearing test accounts. Only a user with no
   * records attached can go; their own activity-log entries go with them, and
   * the erasure itself is logged under the Super Admin who did it.
   */
  async removePermanently(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, hospitalId: true, role: true, email: true, fullName: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.role === UserRole.MASTER_ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be permanently deleted');
    }

    const records = await this.countRecordsKeepingUser(id);
    if (records.length > 0) {
      const list = records.map(([label, count]) => `${count} ${label}`).join(', ');
      throw new ConflictException(
        `${user.fullName} cannot be permanently deleted: they have ${list}. ` +
          'Those records must keep their author — deactivate this user instead.',
      );
    }

    const auditEntries = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.auditLog.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });

      if (user.hospitalId) {
        await tx.auditLog.create({
          data: {
            hospitalId: user.hospitalId,
            userId: requestingUserId,
            action: 'DELETE',
            module: 'Users',
            entityType: 'User',
            entityId: id,
            description:
              `Permanently deleted user ${user.fullName} (${user.email}), ` +
              `with ${count} of their activity-log entries`,
            beforeState: JSON.stringify({ email: user.email, fullName: user.fullName, role: user.role }),
          },
        });
      }

      return count;
    });

    await this.forgetSignedInUser(id);

    return { message: 'User permanently deleted', auditEntriesRemoved: auditEntries };
  }
}

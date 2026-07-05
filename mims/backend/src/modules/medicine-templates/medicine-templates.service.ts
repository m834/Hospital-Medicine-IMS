import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { CreateMedicineTemplateDto } from './dto/create-medicine-template.dto';
import { UpdateMedicineTemplateDto } from './dto/update-medicine-template.dto';

type AuthUser = { id?: string; hospitalId?: string; pharmacyId?: string; role?: UserRole };

// Roles that only ever see/manage their own pharmacy's templates.
const PHARMACY_SCOPED_ROLES: UserRole[] = [UserRole.SUB_PHARMACY_MANAGER, UserRole.PHARMACY_STAFF];

const TEMPLATE_INCLUDE = {
  pharmacy: { select: { id: true, name: true } },
  creator: { select: { id: true, fullName: true } },
  items: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      medicine: { select: { id: true, name: true, genericName: true, strength: true, form: true } },
    },
  },
};

@Injectable()
export class MedicineTemplatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * The set of templates a user is allowed to see. Pharmacy staff see only their
   * own pharmacy's templates; main-pharmacy managers and admins see every
   * template in the hospital (i.e. those created by all pharmacies).
   */
  private visibilityWhere(user: AuthUser, hospitalIdParam?: string): Prisma.MedicineTemplateWhereInput {
    const base: Prisma.MedicineTemplateWhereInput = { isActive: true };

    if (user.role && PHARMACY_SCOPED_ROLES.includes(user.role)) {
      if (!user.pharmacyId) {
        // No pharmacy assigned → nothing to show.
        return { ...base, pharmacyId: '__none__' };
      }
      return { ...base, pharmacyId: user.pharmacyId };
    }

    // Hospital-wide roles (main pharmacy, admins, doctors applying a template).
    const hospitalId = user.hospitalId ?? hospitalIdParam;
    if (hospitalId) {
      return { ...base, hospitalId };
    }
    // Super admin with no hospital context: allow an explicit filter or all.
    return base;
  }

  async create(dto: CreateMedicineTemplateDto, user: AuthUser) {
    // Pharmacy staff always create under their own pharmacy; higher roles may
    // target a specific pharmacy (falling back to their own assignment).
    const isPharmacyScoped = user.role && PHARMACY_SCOPED_ROLES.includes(user.role);
    const targetPharmacyId = isPharmacyScoped ? user.pharmacyId : dto.pharmacyId ?? user.pharmacyId;

    if (!targetPharmacyId) {
      throw new BadRequestException('A pharmacy is required to create a template.');
    }

    const pharmacy = await this.prisma.pharmacy.findUnique({ where: { id: targetPharmacyId } });
    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }
    if (user.hospitalId && pharmacy.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Pharmacy belongs to another hospital');
    }

    await this.assertMedicinesInHospital(dto.items.map((i) => i.medicineId), pharmacy.hospitalId);

    try {
      return await this.prisma.medicineTemplate.create({
        data: {
          hospitalId: pharmacy.hospitalId,
          pharmacyId: targetPharmacyId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          createdBy: user.id!,
          items: {
            create: dto.items.map((item, index) => ({
              medicineId: item.medicineId,
              dosageFrequency: item.dosageFrequency ?? null,
              quantity: item.quantity ?? null,
              category: item.category ?? 'NORMAL',
              instructions: item.instructions?.trim() || null,
              sortOrder: index,
            })),
          },
        },
        include: TEMPLATE_INCLUDE,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A template with this title already exists for this pharmacy.');
      }
      throw e;
    }
  }

  async findAll(user: AuthUser, hospitalIdParam?: string) {
    return this.prisma.medicineTemplate.findMany({
      where: this.visibilityWhere(user, hospitalIdParam),
      include: TEMPLATE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const template = await this.prisma.medicineTemplate.findFirst({
      where: { id, ...this.visibilityWhere(user) },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async update(id: string, dto: UpdateMedicineTemplateDto, user: AuthUser) {
    const existing = await this.findOne(id, user); // enforces visibility

    if (dto.items) {
      await this.assertMedicinesInHospital(dto.items.map((i) => i.medicineId), existing.hospitalId);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.items) {
          // Replace the item set wholesale.
          await tx.medicineTemplateItem.deleteMany({ where: { templateId: id } });
          await tx.medicineTemplateItem.createMany({
            data: dto.items.map((item, index) => ({
              templateId: id,
              medicineId: item.medicineId,
              dosageFrequency: item.dosageFrequency ?? null,
              quantity: item.quantity ?? null,
              category: item.category ?? 'NORMAL',
              instructions: item.instructions?.trim() || null,
              sortOrder: index,
            })),
          });
        }
        await tx.medicineTemplate.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          },
        });
        return tx.medicineTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('A template with this title already exists for this pharmacy.');
      }
      throw e;
    }
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user); // enforces visibility
    await this.prisma.medicineTemplate.update({ where: { id }, data: { isActive: false } });
    return { message: 'Template deleted' };
  }

  /** Guard against templates referencing medicines from a different hospital. */
  private async assertMedicinesInHospital(medicineIds: string[], hospitalId: string) {
    const unique = [...new Set(medicineIds)];
    const count = await this.prisma.medicine.count({
      where: { id: { in: unique }, hospitalId },
    });
    if (count !== unique.length) {
      throw new BadRequestException('One or more medicines are invalid for this hospital.');
    }
  }
}

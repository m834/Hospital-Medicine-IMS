import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePharmacyDto, UpdatePharmacyDto } from './dto';
import { PharmacyStatus, PharmacyType } from '@prisma/client';

@Injectable()
export class PharmaciesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates a requested parent for a sub pharmacy and returns the resolved
   * hierarchy fields. Enforces: parent exists, max depth of 2, same hospital,
   * and no self-parenting.
   */
  private async resolveParent(
    parentPharmacyId: string,
    hospitalId: string,
    selfId?: string,
  ): Promise<{ type: PharmacyType; parentPharmacyId: string }> {
    if (selfId && selfId === parentPharmacyId) {
      throw new BadRequestException('A pharmacy cannot be its own parent');
    }

    const parent = await this.prisma.pharmacy.findUnique({
      where: { id: parentPharmacyId },
      select: {
        id: true,
        name: true,
        type: true,
        hospitalId: true,
        parentPharmacyId: true,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent pharmacy not found');
    }

    // Max depth = 2: a sub can never become a parent.
    if (parent.parentPharmacyId !== null || parent.type !== PharmacyType.MAIN) {
      throw new BadRequestException(
        `'${parent.name}' is a sub pharmacy. Sub pharmacies cannot have sub pharmacies of their own`,
      );
    }

    if (parent.hospitalId !== hospitalId) {
      throw new BadRequestException(
        'A sub pharmacy must belong to the same hospital as its main pharmacy',
      );
    }

    return { type: PharmacyType.SUB, parentPharmacyId: parent.id };
  }

  /**
   * Blocks deactivating/soft-deleting a main pharmacy that still has ACTIVE subs,
   * so subs are never silently orphaned.
   */
  private async assertNoActiveSubPharmacies(id: string) {
    const activeSubs = await this.prisma.pharmacy.count({
      where: { parentPharmacyId: id, status: PharmacyStatus.ACTIVE },
    });

    if (activeSubs > 0) {
      throw new ConflictException(
        `This main pharmacy has ${activeSubs} active sub-pharmac${
          activeSubs === 1 ? 'y' : 'ies'
        }. Deactivate its sub-pharmacies first`,
      );
    }
  }

  async create(createPharmacyDto: CreatePharmacyDto, createdByUserId: string, userHospitalId: string) {
    // Verify hospital exists
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: createPharmacyDto.hospitalId },
    });

    if (!hospital) {
      throw new NotFoundException('Hospital not found');
    }

    // Check if code already exists for this hospital
    const existingPharmacy = await this.prisma.pharmacy.findUnique({
      where: {
        hospitalId_code: {
          hospitalId: createPharmacyDto.hospitalId,
          code: createPharmacyDto.code,
        },
      },
    });

    if (existingPharmacy) {
      throw new ConflictException(
        `Pharmacy with code '${createPharmacyDto.code}' already exists in this hospital`,
      );
    }

    // Resolve hierarchy: a parent makes this a SUB, otherwise keep the
    // explicit type (defaulting to MAIN) so existing callers are unaffected.
    const hierarchy = createPharmacyDto.parentPharmacyId
      ? await this.resolveParent(
          createPharmacyDto.parentPharmacyId,
          createPharmacyDto.hospitalId,
        )
      : {
          type: createPharmacyDto.type ?? PharmacyType.MAIN,
          parentPharmacyId: null,
        };

    // Create pharmacy
    const pharmacy = await this.prisma.pharmacy.create({
      data: {
        name: createPharmacyDto.name,
        code: createPharmacyDto.code,
        type: hierarchy.type,
        parentPharmacyId: hierarchy.parentPharmacyId,
        locationWard: createPharmacyDto.locationWard,
        hospitalId: createPharmacyDto.hospitalId,
        status: PharmacyStatus.ACTIVE,
      },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: userHospitalId,
        userId: createdByUserId,
        action: 'CREATE',
        entityType: 'Pharmacy',
        entityId: pharmacy.id,
        afterState: pharmacy,
      },
    });

    return pharmacy;
  }

  async findAll(hospitalId?: string, type?: string) {
    const where: any = {};

    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (type) {
      where.type = type;
    }

    return this.prisma.pharmacy.findMany({
      where,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
          where: {
            role: {
              in: ['MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER'],
            },
          },
          take: 1,
        },
        _count: {
          select: {
            stockBatches: true,
            users: true,
            subPharmacies: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Hospital pharmacies as a two-level tree: main pharmacies with their subs
   * nested underneath. Pre-existing SUB rows that have no parent yet are
   * returned separately so they stay visible in the UI.
   */
  async getTree(hospitalId: string) {
    const pharmacies = await this.prisma.pharmacy.findMany({
      where: { hospitalId },
      include: {
        _count: {
          select: {
            stockBatches: true,
            users: true,
            subPharmacies: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const subsByParent = new Map<string, typeof pharmacies>();
    for (const pharmacy of pharmacies) {
      if (!pharmacy.parentPharmacyId) continue;
      const siblings = subsByParent.get(pharmacy.parentPharmacyId) ?? [];
      siblings.push(pharmacy);
      subsByParent.set(pharmacy.parentPharmacyId, siblings);
    }

    const mainPharmacies = pharmacies
      .filter((p) => !p.parentPharmacyId && p.type === PharmacyType.MAIN)
      .map((main) => ({
        ...main,
        subPharmacies: subsByParent.get(main.id) ?? [],
      }));

    const unassignedSubPharmacies = pharmacies.filter(
      (p) => !p.parentPharmacyId && p.type === PharmacyType.SUB,
    );

    return { mainPharmacies, unassignedSubPharmacies };
  }

  async findOne(id: string, userHospitalId?: string) {
    const pharmacy = await this.prisma.pharmacy.findUnique({
      where: { id },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        users: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        parentPharmacy: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            stockBatches: true,
            purchaseOrders: true,
            transfersFrom: true,
            transfersTo: true,
            subPharmacies: true,
          },
        },
      },
    });

    if (!pharmacy) {
      throw new NotFoundException('Pharmacy not found');
    }

    // Hospital context validation
    if (userHospitalId && pharmacy.hospitalId !== userHospitalId) {
      throw new ForbiddenException('Access denied to this pharmacy');
    }

    return pharmacy;
  }

  async update(
    id: string,
    updatePharmacyDto: UpdatePharmacyDto,
    updatedByUserId: string,
    userHospitalId: string,
  ) {
    const pharmacy = await this.findOne(id, userHospitalId);

    // If updating code, check for uniqueness
    if (updatePharmacyDto.code && updatePharmacyDto.code !== pharmacy.code) {
      const existingPharmacy = await this.prisma.pharmacy.findUnique({
        where: {
          hospitalId_code: {
            hospitalId: pharmacy.hospitalId,
            code: updatePharmacyDto.code,
          },
        },
      });

      if (existingPharmacy) {
        throw new ConflictException(
          `Pharmacy with code '${updatePharmacyDto.code}' already exists in this hospital`,
        );
      }
    }

    // Do not orphan subs by deactivating their main pharmacy
    if (
      updatePharmacyDto.status === PharmacyStatus.INACTIVE &&
      pharmacy.status !== PharmacyStatus.INACTIVE
    ) {
      await this.assertNoActiveSubPharmacies(id);
    }

    // Re-parenting: attaching to a main forces type SUB, null detaches to top level
    const { parentPharmacyId, ...rest } = updatePharmacyDto;
    const data: Record<string, unknown> = { ...rest };

    if (parentPharmacyId !== undefined) {
      if (parentPharmacyId === null) {
        data.parentPharmacyId = null;
      } else {
        const resolved = await this.resolveParent(
          parentPharmacyId,
          pharmacy.hospitalId,
          id,
        );
        data.parentPharmacyId = resolved.parentPharmacyId;
        data.type = resolved.type;
      }
    }

    // Max depth = 2: a pharmacy that owns subs cannot itself become a sub
    if (
      data.type === PharmacyType.SUB &&
      pharmacy.type !== PharmacyType.SUB &&
      pharmacy._count.subPharmacies > 0
    ) {
      throw new BadRequestException(
        `'${pharmacy.name}' has ${pharmacy._count.subPharmacies} sub-pharmac${
          pharmacy._count.subPharmacies === 1 ? 'y' : 'ies'
        } and cannot be converted into a sub pharmacy`,
      );
    }

    const updatedPharmacy = await this.prisma.pharmacy.update({
      where: { id },
      data,
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: userHospitalId,
        userId: updatedByUserId,
        action: 'UPDATE',
        entityType: 'Pharmacy',
        entityId: id,
        beforeState: pharmacy,
        afterState: updatedPharmacy,
      },
    });

    return updatedPharmacy;
  }

  async remove(id: string, deletedByUserId: string, userHospitalId: string) {
    const pharmacy = await this.findOne(id, userHospitalId);

    // Do not orphan subs by soft-deleting their main pharmacy
    await this.assertNoActiveSubPharmacies(id);

    // Soft delete - set status to INACTIVE
    const updatedPharmacy = await this.prisma.pharmacy.update({
      where: { id },
      data: { status: PharmacyStatus.INACTIVE },
      include: {
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        hospitalId: userHospitalId,
        userId: deletedByUserId,
        action: 'DELETE',
        entityType: 'Pharmacy',
        entityId: id,
        beforeState: pharmacy,
        afterState: updatedPharmacy,
      },
    });

    return updatedPharmacy;
  }

  /**
   * Replaces the set of sub-pharmacies bundled under a main pharmacy.
   * Ticked pharmacies are attached (type forced to SUB); anything previously
   * attached but no longer listed is detached back to top level.
   */
  async setSubPharmacies(
    mainPharmacyId: string,
    subPharmacyIds: string[],
    actingUserId: string,
    userHospitalId: string,
  ) {
    const main = await this.findOne(mainPharmacyId, userHospitalId);

    if (main.parentPharmacyId !== null || main.type !== PharmacyType.MAIN) {
      throw new BadRequestException(
        `'${main.name}' is a sub pharmacy and cannot own sub-pharmacies`,
      );
    }

    const requested = [...new Set(subPharmacyIds)];

    if (requested.includes(main.id)) {
      throw new BadRequestException('A pharmacy cannot be its own sub-pharmacy');
    }

    // Validate every requested candidate before changing anything
    const candidates = await this.prisma.pharmacy.findMany({
      where: { id: { in: requested } },
      select: {
        id: true,
        name: true,
        hospitalId: true,
        _count: { select: { subPharmacies: true } },
      },
    });

    if (candidates.length !== requested.length) {
      const found = new Set(candidates.map((c) => c.id));
      const missing = requested.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Sub-pharmacy not found: ${missing.join(', ')}`,
      );
    }

    for (const candidate of candidates) {
      if (candidate.hospitalId !== main.hospitalId) {
        throw new BadRequestException(
          `'${candidate.name}' belongs to a different hospital`,
        );
      }

      // Max depth = 2: something that already owns subs cannot become a sub
      if (candidate._count.subPharmacies > 0) {
        throw new BadRequestException(
          `'${candidate.name}' already has its own sub-pharmacies and cannot be nested`,
        );
      }
    }

    const currentlyAttached = await this.prisma.pharmacy.findMany({
      where: { parentPharmacyId: main.id },
      select: { id: true },
    });
    const currentIds = currentlyAttached.map((p) => p.id);
    const toAttach = requested.filter((id) => !currentIds.includes(id));
    const toDetach = currentIds.filter((id) => !requested.includes(id));

    await this.prisma.$transaction([
      ...(toAttach.length
        ? [
            this.prisma.pharmacy.updateMany({
              where: { id: { in: toAttach } },
              data: { parentPharmacyId: main.id, type: PharmacyType.SUB },
            }),
          ]
        : []),
      ...(toDetach.length
        ? [
            this.prisma.pharmacy.updateMany({
              where: { id: { in: toDetach } },
              data: { parentPharmacyId: null },
            }),
          ]
        : []),
    ]);

    await this.prisma.auditLog.create({
      data: {
        hospitalId: userHospitalId,
        userId: actingUserId,
        action: 'UPDATE',
        module: 'Pharmacies',
        entityType: 'Pharmacy',
        entityId: main.id,
        description:
          `Updated sub-pharmacy bundle for '${main.name}': ` +
          `${toAttach.length} added, ${toDetach.length} removed ` +
          `(${requested.length} total)`,
        beforeState: { subPharmacyIds: currentIds },
        afterState: { subPharmacyIds: requested },
      },
    });

    return this.findOne(main.id, userHospitalId);
  }

  async getStats(hospitalId: string) {
    const [total, main, sub, active, inactive] = await Promise.all([
      this.prisma.pharmacy.count({
        where: { hospitalId },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, type: 'MAIN' },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, type: 'SUB' },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, status: PharmacyStatus.ACTIVE },
      }),
      this.prisma.pharmacy.count({
        where: { hospitalId, status: PharmacyStatus.INACTIVE },
      }),
    ]);

    return {
      total,
      main,
      sub,
      active,
      inactive,
    };
  }
}

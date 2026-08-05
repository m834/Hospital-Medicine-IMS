import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientsDto } from './dto/search-patients.dto';
import { VisitsService } from '../visits/visits.service';
import { AdmissionsService } from '../admissions/admissions.service';
import { AdmissionType, VisitType } from '@prisma/client';
import { mrnFilter } from '../../common/utils/mrn.util';

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private readonly visitsService: VisitsService,
    private readonly admissionsService: AdmissionsService,
  ) {}

  private async createVisitForRegistration(
    patientId: string,
    createPatientDto: CreatePatientDto,
    userId: string,
    hospitalId: string,
  ) {
    return this.visitsService.create({
      hospitalId,
      patientId,
      registrarId: userId,
      visitType: createPatientDto.visitType as VisitType,
      clinicId: createPatientDto.clinicId,
      departmentId: createPatientDto.department || undefined,
      wardId: createPatientDto.ward || undefined,
      bedId: createPatientDto.bed || undefined,
      attendingDoctorId: createPatientDto.attendingDoctorId || undefined,
      chiefComplaint: createPatientDto.chiefComplaint,
      vitalSigns: createPatientDto.vitalSigns,
      notes: createPatientDto.notes,
    });
  }

  private async createAdmissionForRegistration(
    patientId: string,
    visitId: string | undefined,
    createPatientDto: CreatePatientDto,
    userId: string,
    hospitalId: string,
  ) {
    if (createPatientDto.visitType !== 'WARD_INDOOR') {
      return null;
    }

    // Skip admission creation if minimum required fields are absent
    if (!createPatientDto.department || !createPatientDto.attendingDoctorId) {
      return null;
    }

    return this.admissionsService.create({
      hospitalId,
      patientId,
      visitId,
      departmentId: createPatientDto.department,
      roomId: createPatientDto.ward || undefined,
      bedId: createPatientDto.bed || undefined,
      attendingDoctorId: createPatientDto.attendingDoctorId,
      admittingUserId: userId,
      admissionType: AdmissionType.PLANNED,
      diagnosisOnAdmission: createPatientDto.chiefComplaint,
      notes: createPatientDto.notes,
    });
  }

  /**
   * Normalize a name for guardian de-duplication: lowercase, strip anything
   * that isn't a letter/number, and collapse runs of whitespace. This makes
   * "Wajiha  Moiz", "wajiha moiz." and "WAJIHA MOIZ" compare equal. It does NOT
   * reconcile genuinely different spellings (e.g. "Wajiha" vs "Wajeeha").
   */
  private normalizeName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Random, non-sequential numeric code. Staff read this code out and type it
   * on its own, so it is digits only — no letters to spell out or mishear.
   */
  private randomCode(length: number): string {
    const alphabet = '0123456789';
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }

  /**
   * Generate MRN in format: MRN-YYYYMMDD-XXXXXX
   * The suffix is RANDOM (not sequential), so MRNs can't be guessed or
   * reconstructed from outside the system. Example: MRN-20260629-482913
   *
   * Only the suffix is shown to users, so the suffix itself — not just the
   * full MRN — must be unique; we check it against every existing MRN and
   * retry on collision.
   */
  private async generateNRNumber(_hospitalId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.randomCode(6);
      const existing = await this.prisma.patient.findFirst({
        where: { nrNumber: { endsWith: `-${code}` } },
        select: { id: true },
      });
      if (!existing) return `MRN-${datePrefix}-${code}`;
    }
    // Fallback with a longer code — effectively impossible to reach
    return `MRN-${datePrefix}-${this.randomCode(10)}`;
  }

  /**
   * Register a new patient
   */
  async create(createPatientDto: CreatePatientDto, userId: string, hospitalId: string) {
    // Verify attending doctor if provided
    if (createPatientDto.attendingDoctorId) {
      const doctor = await this.prisma.user.findFirst({
        where: {
          id: createPatientDto.attendingDoctorId,
          hospitalId,
          role: 'DOCTOR',
        },
      });

      if (!doctor) {
        throw new BadRequestException('Invalid attending doctor');
      }
    }

    // Decide whether this registration is a returning patient (record a new
    // visit against their MRN) or a brand-new patient.
    //
    // A CNIC is a family key: the CNIC holder plus any WIFE/CHILD registered
    // under it. Each family member gets their own MRN, so we never collapse a
    // guardian onto the CNIC holder. Matching therefore:
    //   - self (no guardianType): match the CNIC/MRN whose guardianType is null
    //   - guardian (WIFE/CHILD):  match the same CNIC + guardianType, then match
    //     the name auto-normalized (case/spacing/punctuation-insensitive) so
    //     "Wajiha  Moiz" and "wajiha moiz." resolve to the same person. Genuinely
    //     different spellings ("Wajiha" vs "Wajeeha") still yield a new MRN.
    const patientInclude = {
      attendingDoctor: { select: { id: true, fullName: true, email: true } },
      registeredByUser: { select: { id: true, fullName: true, email: true } },
    };

    let existingPatient: any = null;
    if (createPatientDto.guardianType) {
      if (createPatientDto.cnic) {
        const candidates = await this.prisma.patient.findMany({
          where: {
            hospitalId,
            cnic: createPatientDto.cnic,
            // Two different ID schemes can produce the same string, so the type
            // is part of the family key, not just the number.
            idType: createPatientDto.idType ?? 'CNIC',
            guardianType: createPatientDto.guardianType,
          },
          include: patientInclude,
        });
        const target = this.normalizeName(createPatientDto.fullName);
        existingPatient = candidates.find((c) => this.normalizeName(c.fullName) === target) ?? null;
      }
    } else {
      const identifierFilters = [];
      if (createPatientDto.cnic) {
        identifierFilters.push({
          cnic: createPatientDto.cnic,
          idType: createPatientDto.idType ?? 'CNIC',
        });
      }
      if (createPatientDto.nrNumber) {
        identifierFilters.push({ nrNumber: mrnFilter(createPatientDto.nrNumber) });
      }
      if (identifierFilters.length > 0) {
        existingPatient = await this.prisma.patient.findFirst({
          where: { hospitalId, guardianType: null, OR: identifierFilters },
          include: patientInclude,
        });
      }
    }

    if (existingPatient) {
      // Create visit for all types
      const visitResult = await this.createVisitForRegistration(existingPatient.id, createPatientDto, userId, hospitalId);
      const visitId = visitResult?.visit?.id;

      // Create admission for WARD_INDOOR
      if (createPatientDto.visitType === VisitType.WARD_INDOOR && visitId) {
        await this.createAdmissionForRegistration(existingPatient.id, visitId, createPatientDto, userId, hospitalId);
      }

      return existingPatient;
    }

    // Generate MRN
    const nrNumber = await this.generateNRNumber(hospitalId);

    // Create patient
    const patient = await this.prisma.patient.create({
      data: {
        hospitalId,
        nrNumber,
        fullName: createPatientDto.fullName,
        mobile: createPatientDto.mobile ?? null,
        cnic: createPatientDto.cnic,
        idType: createPatientDto.idType ?? 'CNIC',
        dob: createPatientDto.dob ? new Date(createPatientDto.dob) : null,
        age: createPatientDto.age ?? null,
        guardianType: createPatientDto.guardianType ?? null,
        gender: createPatientDto.gender ?? 'MALE',
        address: createPatientDto.address,
        visitType: createPatientDto.visitType ?? 'OPD',
        department: createPatientDto.department,
        ward: createPatientDto.ward,
        bed: createPatientDto.bed,
        attendingDoctorId: createPatientDto.attendingDoctorId || null,
        registeredBy: userId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        registeredByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    // Create visit for all types
    const visitResult = await this.createVisitForRegistration(patient.id, createPatientDto, userId, hospitalId);
    const visitId = visitResult?.visit?.id;
    
    // Create admission for WARD_INDOOR
    if (createPatientDto.visitType === VisitType.WARD_INDOOR && visitId) {
      await this.createAdmissionForRegistration(patient.id, visitId, createPatientDto, userId, hospitalId);
    }

    return patient;
  }

  /**
   * Search and list patients with pagination
   */
  async findAll(searchDto: SearchPatientsDto, hospitalId: string) {
    const { search, nrNumber, cnic, mobile, gender, visitType, attendingDoctorId, limit = 50, page = 1, sortBy = 'registeredAt', sortOrder = 'desc' } = searchDto;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      hospitalId,
    };

    if (search) {
      where.OR = [
        { nrNumber: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { cnic: { contains: search } },
      ];
    }

    if (nrNumber) {
      where.nrNumber = { contains: nrNumber, mode: 'insensitive' };
    }

    if (cnic) {
      where.cnic = { contains: cnic };
    }

    if (mobile) {
      where.mobile = { contains: mobile };
    }

    if (gender) {
      where.gender = gender;
    }

    if (visitType) {
      where.visitType = visitType;
    }

    if (attendingDoctorId) {
      where.attendingDoctorId = attendingDoctorId;
    }

    // Get total count
    const total = await this.prisma.patient.count({ where });

    // Get patients
    const patients = await this.prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        registeredByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        _count: {
          select: {
            visits: true,
          },
        },
        visits: {
          where: {
            status: { in: ['WAITING', 'IN_PROGRESS', 'CALLED'] },
          },
          include: {
            clinic: {
              select: {
                id: true,
                name: true,
                opdFee: true,
                doctor: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Add department info for each patient
    const patientsWithDept = await Promise.all(
      patients.map(async (patient) => {
        let departmentInfo = null;
        if (patient.department) {
          departmentInfo = await this.prisma.department.findUnique({
            where: { id: patient.department },
            select: { id: true, name: true, code: true },
          });
        }
        let roomInfo = null;
        let bedInfo = null;
        let admissionInfo = null;
        if (patient.visitType === 'WARD_INDOOR') {
          const activeAdmission = await this.prisma.admission.findFirst({
            where: {
              patientId: patient.id,
              status: 'ADMITTED',
            },
            orderBy: { admittedAt: 'desc' },
            include: {
              room: { select: { id: true, roomNumber: true, roomType: true } },
              bed: { select: { id: true, bedNumber: true, bedType: true } },
              department: { select: { id: true, name: true, code: true } },
            },
          });
          if (activeAdmission) {
            admissionInfo = {
              id: activeAdmission.id,
              admissionNumber: activeAdmission.admissionNumber,
              admittedAt: activeAdmission.admittedAt,
              department: activeAdmission.department,
            };
            roomInfo = activeAdmission.room;
            bedInfo = activeAdmission.bed;
            if (!departmentInfo && activeAdmission.department) {
              departmentInfo = activeAdmission.department;
            }
          }
        }
        return {
          ...patient,
          departmentInfo,
          admissionInfo,
          roomInfo,
          bedInfo,
        };
      }),
    );

    return {
      data: patientsWithDept,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find patient by ID
   */
  async findOne(id: string, hospitalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        hospitalId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        registeredByUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        prescriptions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        issueTransactions: {
          orderBy: { issuedAt: 'desc' },
          take: 5,
        },
        visits: {
          include: {
            clinic: {
              select: {
                id: true,
                name: true,
                opdFee: true,
                doctor: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Add department info
    let departmentInfo = null;
    if (patient.department) {
      departmentInfo = await this.prisma.department.findUnique({
        where: { id: patient.department },
        select: { id: true, name: true, code: true },
      });
    }

    let roomInfo = null;
    let bedInfo = null;
    let admissionInfo = null;
    if (patient.visitType === 'WARD_INDOOR') {
      const activeAdmission = await this.prisma.admission.findFirst({
        where: {
          patientId: patient.id,
          status: 'ADMITTED',
        },
        orderBy: { admittedAt: 'desc' },
        include: {
          room: { select: { id: true, roomNumber: true, roomType: true } },
          bed: { select: { id: true, bedNumber: true, bedType: true } },
          department: { select: { id: true, name: true, code: true } },
        },
      });
      if (activeAdmission) {
        admissionInfo = {
          id: activeAdmission.id,
          admissionNumber: activeAdmission.admissionNumber,
          admittedAt: activeAdmission.admittedAt,
          department: activeAdmission.department,
        };
        roomInfo = activeAdmission.room;
        bedInfo = activeAdmission.bed;
        if (!departmentInfo && activeAdmission.department) {
          departmentInfo = activeAdmission.department;
        }
      }
    }

    return {
      ...patient,
      departmentInfo,
      admissionInfo,
      roomInfo,
      bedInfo,
    };
  }

  /**
   * Find patient by MRN
   */
  async findByNRNumber(nrNumber: string, hospitalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        nrNumber: mrnFilter(nrNumber),
        hospitalId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Patient with MRN ${nrNumber} not found`);
    }

    return patient;
  }

  /**
   * Update patient
   */
  async update(id: string, updatePatientDto: UpdatePatientDto, hospitalId: string) {
    // Check if patient exists
    const existingPatient = await this.prisma.patient.findFirst({
      where: {
        id,
        hospitalId,
      },
    });

    if (!existingPatient) {
      throw new NotFoundException('Patient not found');
    }

    // Verify attending doctor if provided
    if (updatePatientDto.attendingDoctorId) {
      const doctor = await this.prisma.user.findFirst({
        where: {
          id: updatePatientDto.attendingDoctorId,
          hospitalId,
          role: 'DOCTOR',
        },
      });

      if (!doctor) {
        throw new BadRequestException('Invalid attending doctor');
      }
    }

    // Update patient
    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        fullName: updatePatientDto.fullName,
        mobile: updatePatientDto.mobile,
        cnic: updatePatientDto.cnic,
        dob: updatePatientDto.dob ? new Date(updatePatientDto.dob) : undefined,
        age: updatePatientDto.age,
        guardianType: updatePatientDto.guardianType,
        gender: updatePatientDto.gender,
        address: updatePatientDto.address,
        visitType: updatePatientDto.visitType,
        department: updatePatientDto.department,
        ward: updatePatientDto.ward,
        bed: updatePatientDto.bed,
        attendingDoctorId: updatePatientDto.attendingDoctorId,
      },
      include: {
        attendingDoctor: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return patient;
  }

  /**
   * Delete patient (soft delete by removing from active list)
   */
  async remove(id: string, hospitalId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: {
        id,
        hospitalId,
      },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Check if patient has any active prescriptions or transactions
    const hasActiveRecords = await this.prisma.prescription.count({
      where: { nrNumber: patient.nrNumber },
    });

    if (hasActiveRecords > 0) {
      throw new BadRequestException('Cannot delete patient with existing prescriptions or transactions');
    }

    // Delete patient
    await this.prisma.patient.delete({
      where: { id },
    });

    return { message: 'Patient deleted successfully' };
  }

  /**
   * Get patient statistics for dashboard
   */
  async getStats(hospitalId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const [total, todayRegistrations, byVisitType, byGender] = await Promise.all([
      // Total patients
      this.prisma.patient.count({ where: { hospitalId } }),

      // Today's registrations
      this.prisma.patient.count({
        where: {
          hospitalId,
          registeredAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),

      // By visit type
      this.prisma.patient.groupBy({
        by: ['visitType'],
        where: { hospitalId },
        _count: true,
      }),

      // By gender
      this.prisma.patient.groupBy({
        by: ['gender'],
        where: { hospitalId },
        _count: true,
      }),
    ]);

    return {
      total,
      todayRegistrations,
      byVisitType: byVisitType.reduce((acc, item) => {
        acc[item.visitType] = item._count;
        return acc;
      }, {}),
      byGender: byGender.reduce((acc, item) => {
        acc[item.gender] = item._count;
        return acc;
      }, {}),
    };
  }
}

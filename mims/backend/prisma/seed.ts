import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedShifts } from './seeds/seed-shifts';
import { seedLeaveTypes } from './seeds/seed-leave-types';
import { seedHolidays } from './seeds/seed-holidays';
import { seedAttendanceConfig } from './seeds/seed-attendance-config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // 1. CREATE DEFAULT SUPER ADMIN
  // ============================================
  console.log('Creating Super Admin...');
  
  const superAdminEmail = 'admin@mims.com';
  const superAdminPassword = 'Admin@12345';
  
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await argon2.hash(superAdminPassword);
    
    const superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: hashedPassword,
        fullName: 'Super Administrator',
        phone: '+92-300-1234567',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        hospitalId: null, // SUPER_ADMIN is not tied to any hospital
        pharmacyId: null,
      },
    });

    console.log('✅ Super Admin created:');
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Password: ${superAdminPassword}`);
    console.log(`   Role: SUPER_ADMIN`);
    console.log(`   ID: ${superAdmin.id}\n`);
  } else {
    console.log('⚠️  Super Admin already exists. Skipping...\n');
  }

  // ============================================
  // 2. CREATE SAMPLE HOSPITALS
  // ============================================
  console.log('Creating sample hospitals...');

  const hospitals = [
    {
      name: 'City General Hospital',
      code: 'CGH001',
      address: '123 Main Street, Karachi, Pakistan',
      phone: '+92-21-1111111',
      email: 'info@cgh.com',
      status: 'ACTIVE' as const,
    },
    {
      name: 'District Medical Center',
      code: 'DMC002',
      address: '456 Hospital Road, Lahore, Pakistan',
      phone: '+92-42-2222222',
      email: 'contact@dmc.com',
      status: 'ACTIVE' as const,
    },
  ];

  const createdHospitals = [];
  for (const hospitalData of hospitals) {
    const existingHospital = await prisma.hospital.findUnique({
      where: { code: hospitalData.code },
    });

    if (!existingHospital) {
      const hospital = await prisma.hospital.create({
        data: hospitalData,
      });
      createdHospitals.push(hospital);
      console.log(`✅ Created hospital: ${hospital.name} (${hospital.code})`);
    } else {
      createdHospitals.push(existingHospital);
      console.log(`⚠️  Hospital ${hospitalData.name} already exists. Skipping...`);
    }
  }

  console.log('');

  // ============================================
  // 3. CREATE PHARMACIES FOR EACH HOSPITAL
  // ============================================
  console.log('Creating pharmacies...');

  for (const hospital of createdHospitals) {
    // Main Pharmacy
    const mainPharmacyCode = `${hospital.code}-MAIN`;
    const existingMainPharmacy = await prisma.pharmacy.findFirst({
      where: {
        code: mainPharmacyCode,
        hospitalId: hospital.id,
      },
    });

    if (!existingMainPharmacy) {
      const mainPharmacy = await prisma.pharmacy.create({
        data: {
          hospitalId: hospital.id,
          name: 'Main Pharmacy',
          code: mainPharmacyCode,
          type: 'MAIN',
          locationWard: 'Ground Floor',
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Created main pharmacy for ${hospital.name}`);
    } else {
      console.log(`⚠️  Main pharmacy for ${hospital.name} already exists. Skipping...`);
    }

    // Sub Pharmacies
    const subPharmacies = [
      { name: 'Emergency Pharmacy', ward: 'Emergency Wing', code: `${hospital.code}-EMRG` },
      { name: 'Ward Pharmacy', ward: 'Ward Block A', code: `${hospital.code}-WARD` },
    ];

    for (const subPharmacyData of subPharmacies) {
      const existingSubPharmacy = await prisma.pharmacy.findFirst({
        where: {
          code: subPharmacyData.code,
          hospitalId: hospital.id,
        },
      });

      if (!existingSubPharmacy) {
        await prisma.pharmacy.create({
          data: {
            hospitalId: hospital.id,
            name: subPharmacyData.name,
            code: subPharmacyData.code,
            type: 'SUB',
            locationWard: subPharmacyData.ward,
            status: 'ACTIVE',
          },
        });
        console.log(`✅ Created ${subPharmacyData.name} for ${hospital.name}`);
      } else {
        console.log(`⚠️  ${subPharmacyData.name} for ${hospital.name} already exists. Skipping...`);
      }
    }
  }

  console.log('');

  // ============================================
  // 4. CREATE SAMPLE HOSPITAL ADMINS
  // ============================================
  console.log('Creating Hospital Admins...');

  for (const hospital of createdHospitals) {
    const adminEmail = `admin@${hospital.code.toLowerCase()}.com`;
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const hashedPassword = await argon2.hash('Admin@12345');
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashedPassword,
          fullName: `${hospital.name} Administrator`,
          phone: hospital.phone,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
          hospitalId: hospital.id,
          pharmacyId: null,
        },
      });
      console.log(`✅ Created Hospital Admin for ${hospital.name}`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: Admin@12345`);
    } else {
      console.log(`⚠️  Hospital Admin for ${hospital.name} already exists. Skipping...`);
    }
  }

  console.log('');

  // ============================================
  // 5. CREATE POPULAR MEDICINES
  // ============================================
  console.log('Seeding popular medicines for each hospital...');

  const popularMedicines = [
    { name: 'Paracetamol', genericName: 'Paracetamol', strength: '500mg', form: 'TABLET' },
    { name: 'Ibuprofen', genericName: 'Ibuprofen', strength: '200mg', form: 'TABLET' },
    { name: 'Amoxicillin', genericName: 'Amoxicillin', strength: '500mg', form: 'CAPSULE' },
    { name: 'Metformin', genericName: 'Metformin', strength: '500mg', form: 'TABLET' },
    { name: 'Omeprazole', genericName: 'Omeprazole', strength: '20mg', form: 'CAPSULE' },
    { name: 'Ciprofloxacin', genericName: 'Ciprofloxacin', strength: '500mg', form: 'TABLET' },
    { name: 'Salbutamol Syrup', genericName: 'Salbutamol', strength: '2mg/5ml', form: 'SYRUP' },
    { name: 'Amoxicillin-Clavulanate', genericName: 'Amoxicillin/Clavulanate', strength: '625mg', form: 'TABLET' },
  ];

  for (const hospital of createdHospitals) {
    for (const med of popularMedicines) {
      const exists = await prisma.medicine.findFirst({
        where: { name: med.name, hospitalId: hospital.id },
      });

      if (!exists) {
        await prisma.medicine.create({
          data: {
            hospitalId: hospital.id,
            name: med.name,
            genericName: med.genericName,
            strength: med.strength,
            form: med.form as any,
            manufacturer: 'Generic Manufacturer',
            status: 'ACTIVE',
          },
        });
        console.log(`✅ Seeded medicine ${med.name} for ${hospital.name}`);
      } else {
        console.log(`⚠️  Medicine ${med.name} already exists for ${hospital.name}. Skipping...`);
      }
    }
  }


  // ============================================
  // 6. SEED SAMPLE DATA FOR DASHBOARD TESTING
  // ============================================
  console.log('\n📦 Seeding sample pharmacy data for dashboard testing...\n');

  for (const hospital of createdHospitals) {
    // Fetch pharmacies and users created above
    const allPharmacies = await prisma.pharmacy.findMany({ where: { hospitalId: hospital.id } });
    const mainPharmacy = allPharmacies.find((p) => p.type === 'MAIN');
    const subPharmacies = allPharmacies.filter((p) => p.type === 'SUB');

    if (!mainPharmacy) continue;

    // Find or create a pharmacy manager user for issuance
    let managerUser = await prisma.user.findFirst({
      where: { hospitalId: hospital.id, role: 'MAIN_PHARMACY_MANAGER' },
    });
    if (!managerUser) {
      const managerEmail = `manager@${hospital.code.toLowerCase()}.com`;
      managerUser = await prisma.user.findUnique({ where: { email: managerEmail } });
      if (!managerUser) {
        managerUser = await prisma.user.create({
          data: {
            email: managerEmail,
            passwordHash: await argon2.hash('Admin@12345'),
            fullName: `Main Pharmacy Manager - ${hospital.name}`,
            phone: hospital.phone,
            role: 'MAIN_PHARMACY_MANAGER',
            status: 'ACTIVE',
            hospitalId: hospital.id,
            pharmacyId: mainPharmacy.id,
          },
        });
        console.log(`✅ Created Main Pharmacy Manager for ${hospital.name} (Email: ${managerEmail})`);
      }
    }

    // Find or create sub-pharmacy manager
    let subManager = await prisma.user.findFirst({
      where: { hospitalId: hospital.id, role: 'SUB_PHARMACY_MANAGER' },
    });
    if (!subManager && subPharmacies.length > 0) {
      const subManagerEmail = `submanager@${hospital.code.toLowerCase()}.com`;
      subManager = await prisma.user.findUnique({ where: { email: subManagerEmail } });
      if (!subManager) {
        subManager = await prisma.user.create({
          data: {
            email: subManagerEmail,
            passwordHash: await argon2.hash('Admin@12345'),
            fullName: `Sub Pharmacy Manager - ${hospital.name}`,
            phone: hospital.phone,
            role: 'SUB_PHARMACY_MANAGER',
            status: 'ACTIVE',
            hospitalId: hospital.id,
            pharmacyId: subPharmacies[0].id,
          },
        });
        console.log(`✅ Created Sub Pharmacy Manager for ${hospital.name} (Email: ${subManagerEmail})`);
      }
    }

    // Get medicines for this hospital
    const medicines = await prisma.medicine.findMany({ where: { hospitalId: hospital.id } });
    if (medicines.length === 0) continue;

    const today = new Date();
    const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

    // ── Helper: create batch if not exists ──
    const ensureBatch = async (params: {
      pharmacyId: string;
      medicineId: string;
      batchNo: string;
      qtyReceived: number;
      qtyAvailable: number;
      expiryDate: Date;
      purchasePrice: number;
      governmentPrice: number;
      retailPrice: number;
      reorderLevel?: number;
      status?: string;
      receivedDate?: Date;
    }) => {
      const existing = await prisma.stockBatch.findFirst({
        where: { batchNo: params.batchNo, pharmacyId: params.pharmacyId },
      });
      if (existing) return existing;
      return prisma.stockBatch.create({
        data: {
          hospitalId: hospital.id,
          pharmacyId: params.pharmacyId,
          medicineId: params.medicineId,
          batchNo: params.batchNo,
          qtyReceived: params.qtyReceived,
          qtyAvailable: params.qtyAvailable,
          expiryDate: params.expiryDate,
          purchasePrice: params.purchasePrice,
          governmentPrice: params.governmentPrice,
          retailPrice: params.retailPrice,
          storageType: 'ROOM_TEMPERATURE',
          status: (params.status || 'AVAILABLE') as any,
          reorderLevel: params.reorderLevel ?? 10,
          receivedDate: params.receivedDate ?? daysAgo(7),
        },
      });
    };

    // ── Create sample patients ──
    const samplePatients = [
      { nr: `NR-${hospital.code}-001`, name: 'Ali Hassan', gender: 'MALE', visitType: 'OPD' },
      { nr: `NR-${hospital.code}-002`, name: 'Fatima Noor', gender: 'FEMALE', visitType: 'IPD' },
      { nr: `NR-${hospital.code}-003`, name: 'Muhammad Tariq', gender: 'MALE', visitType: 'EMERGENCY' },
      { nr: `NR-${hospital.code}-004`, name: 'Ayesha Bibi', gender: 'FEMALE', visitType: 'OPD' },
      { nr: `NR-${hospital.code}-005`, name: 'Usman Ghani', gender: 'MALE', visitType: 'IPD' },
    ];
    const patientRecs: any[] = [];
    for (const p of samplePatients) {
      let patient = await prisma.patient.findUnique({ where: { nrNumber: p.nr } });
      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            hospitalId: hospital.id,
            nrNumber: p.nr,
            fullName: p.name,
            gender: p.gender as any,
            visitType: p.visitType as any,
            registeredBy: managerUser!.id,
            department: 'General',
            registeredAt: daysAgo(30),
          },
        });
      }
      patientRecs.push(patient);
    }
    console.log(`✅ Sample patients ready for ${hospital.name}`);

    // ── MAIN PHARMACY BATCHES ──
    // Large well-stocked batches for main pharmacy
    const mainBatches: any[] = [];
    const mainBatchDefs = [
      { med: 0, suffix: 'A', qty: 500, price: 5, gov: 4, ret: 7, exp: daysFromNow(180), reorder: 50 },
      { med: 0, suffix: 'B', qty: 300, price: 5.5, gov: 4, ret: 7, exp: daysFromNow(90), reorder: 50 },
      { med: 1, suffix: 'A', qty: 400, price: 12, gov: 10, ret: 15, exp: daysFromNow(200), reorder: 40 },
      { med: 2, suffix: 'A', qty: 200, price: 35, gov: 30, ret: 45, exp: daysFromNow(150), reorder: 30 },
      { med: 2, suffix: 'B', qty: 100, price: 36, gov: 30, ret: 45, exp: daysFromNow(60), reorder: 30 },
      { med: 3, suffix: 'A', qty: 350, price: 8, gov: 6, ret: 10, exp: daysFromNow(365), reorder: 35 },
      { med: 4, suffix: 'A', qty: 250, price: 22, gov: 18, ret: 28, exp: daysFromNow(240), reorder: 25 },
      { med: 5, suffix: 'A', qty: 180, price: 40, gov: 35, ret: 50, exp: daysFromNow(120), reorder: 20 },
      { med: 6, suffix: 'A', qty: 120, price: 55, gov: 48, ret: 70, exp: daysFromNow(300), reorder: 15 },
      { med: 7, suffix: 'A', qty: 160, price: 80, gov: 70, ret: 100, exp: daysFromNow(180), reorder: 20 },
      // Low stock batch
      { med: 1, suffix: 'LOW', qty: 5, price: 12, gov: 10, ret: 15, exp: daysFromNow(100), reorder: 20 },
      // Expiring soon
      { med: 3, suffix: 'EXP', qty: 30, price: 8, gov: 6, ret: 10, exp: daysFromNow(5), reorder: 10 },
    ];
    for (const def of mainBatchDefs) {
      if (def.med >= medicines.length) continue;
      const med = medicines[def.med];
      const batch = await ensureBatch({
        pharmacyId: mainPharmacy.id,
        medicineId: med.id,
        batchNo: `MAIN-${hospital.code}-${med.name.substring(0, 3).toUpperCase()}-${def.suffix}`,
        qtyReceived: def.qty,
        qtyAvailable: def.qty,
        expiryDate: def.exp,
        purchasePrice: def.price,
        governmentPrice: def.gov,
        retailPrice: def.ret,
        reorderLevel: def.reorder,
        receivedDate: daysAgo(10),
      });
      mainBatches.push({ batch, med });
    }
    console.log(`✅ Main pharmacy batches seeded for ${hospital.name}`);

    // ── SUB PHARMACY BATCHES ──
    for (const sub of subPharmacies) {
      const subBatchDefs = [
        { med: 0, suffix: 'S1', qty: 100, price: 5, gov: 4, ret: 7, exp: daysFromNow(150) },
        { med: 1, suffix: 'S1', qty: 80, price: 12, gov: 10, ret: 15, exp: daysFromNow(200) },
        { med: 2, suffix: 'S1', qty: 50, price: 35, gov: 30, ret: 45, exp: daysFromNow(120) },
        { med: 3, suffix: 'S1', qty: 60, price: 8, gov: 6, ret: 10, exp: daysFromNow(90) },
        { med: 4, suffix: 'S1', qty: 40, price: 22, gov: 18, ret: 28, exp: daysFromNow(180) },
        // Expiring soon in sub
        { med: 0, suffix: 'SEXP', qty: 15, price: 5, gov: 4, ret: 7, exp: daysFromNow(3) },
      ];
      for (const def of subBatchDefs) {
        if (def.med >= medicines.length) continue;
        const med = medicines[def.med];
        await ensureBatch({
          pharmacyId: sub.id,
          medicineId: med.id,
          batchNo: `SUB-${sub.code}-${med.name.substring(0, 3).toUpperCase()}-${def.suffix}`,
          qtyReceived: def.qty,
          qtyAvailable: def.qty,
          expiryDate: def.exp,
          purchasePrice: def.price,
          governmentPrice: def.gov,
          retailPrice: def.ret,
          reorderLevel: 15,
          receivedDate: daysAgo(5),
        });
      }
      console.log(`✅ Sub pharmacy (${sub.name}) batches seeded for ${hospital.name}`);
    }

    // ── SAMPLE ISSUANCES (past 7 days) ──
    // Issue from main pharmacy
    if (mainBatches.length >= 3) {
      for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
        const issueDate = daysAgo(dayOffset);
        issueDate.setHours(10, 30, 0, 0);
        const patIdx = dayOffset % patientRecs.length;
        const patient = patientRecs[patIdx];

        const existingIssue = await prisma.issueTransaction.findFirst({
          where: {
            pharmacyId: mainPharmacy.id,
            nrNumber: patient.nrNumber,
            issuedAt: { gte: new Date(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate()), lt: new Date(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate() + 1) },
          },
        });
        if (existingIssue) continue;

        // Pick 2 batches to issue from
        const itemsToIssue = mainBatches.slice(0, 2).map(({ batch, med }) => ({
          batch,
          med,
          qty: 5 + (dayOffset % 3),
          unitPrice: 5.0,
        }));
        const totalAmount = itemsToIssue.reduce((s, i) => s + i.qty * i.unitPrice, 0);

        const tx = await prisma.issueTransaction.create({
          data: {
            hospitalId: hospital.id,
            pharmacyId: mainPharmacy.id,
            nrNumber: patient.nrNumber,
            issuedBy: managerUser!.id,
            totalAmount,
            priceType: 'GOVERNMENT',
            status: 'COMPLETED',
            issuedAt: issueDate,
            items: {
              create: itemsToIssue.map((i) => ({
                batchId: i.batch.id,
                medicineId: i.med.id,
                qtyIssued: i.qty,
                unitPrice: i.unitPrice,
                totalPrice: i.qty * i.unitPrice,
              })),
            },
          },
        });

        // Decrement qtyAvailable
        for (const item of itemsToIssue) {
          await prisma.stockBatch.update({
            where: { id: item.batch.id },
            data: { qtyAvailable: { decrement: item.qty } },
          });
        }
      }
      console.log(`✅ Sample issuances created for main pharmacy (${hospital.name})`);
    }

    // Issue from sub pharmacy
    if (subPharmacies.length > 0 && subManager) {
      const subPh = subPharmacies[0];
      const subBatches = await prisma.stockBatch.findMany({
        where: { pharmacyId: subPh.id, status: 'AVAILABLE' },
        take: 2,
      });
      if (subBatches.length >= 1) {
        for (let dayOffset = 5; dayOffset >= 0; dayOffset--) {
          const issueDate = daysAgo(dayOffset);
          issueDate.setHours(14, 0, 0, 0);
          const patient = patientRecs[(dayOffset + 2) % patientRecs.length];

          const existingIssue = await prisma.issueTransaction.findFirst({
            where: {
              pharmacyId: subPh.id,
              nrNumber: patient.nrNumber,
              issuedAt: { gte: new Date(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate()), lt: new Date(issueDate.getFullYear(), issueDate.getMonth(), issueDate.getDate() + 1) },
            },
          });
          if (existingIssue) continue;

          const subBatch = subBatches[dayOffset % subBatches.length];
          const qty = 3 + (dayOffset % 4);
          await prisma.issueTransaction.create({
            data: {
              hospitalId: hospital.id,
              pharmacyId: subPh.id,
              nrNumber: patient.nrNumber,
              issuedBy: subManager.id,
              totalAmount: qty * 4.5,
              priceType: 'GOVERNMENT',
              status: 'COMPLETED',
              issuedAt: issueDate,
              items: {
                create: [{
                  batchId: subBatch.id,
                  medicineId: subBatch.medicineId,
                  qtyIssued: qty,
                  unitPrice: 4.5,
                  totalPrice: qty * 4.5,
                }],
              },
            },
          });
          await prisma.stockBatch.update({
            where: { id: subBatch.id },
            data: { qtyAvailable: { decrement: qty } },
          });
        }
        console.log(`✅ Sample issuances created for sub pharmacy (${hospital.name})`);
      }
    }

    // ── SAMPLE PENDING TRANSFER (Sub → Main approval) ──
    if (subPharmacies.length > 0 && subManager) {
      const subPh = subPharmacies[0];
      const existingTransfer = await prisma.transferRequest.findFirst({
        where: { hospitalId: hospital.id, status: 'PENDING' },
      });
      if (!existingTransfer && medicines.length >= 2) {
        await prisma.transferRequest.create({
          data: {
            hospitalId: hospital.id,
            fromPharmacyId: mainPharmacy.id,
            toPharmacyId: subPh.id,
            requestNumber: `TRF-${hospital.code}-${Date.now()}`,
            status: 'PENDING',
            requestedBy: subManager.id,
            notes: 'Routine stock replenishment request',
            items: {
              create: [
                { medicineId: medicines[0].id, qtyRequested: 50 },
                { medicineId: medicines[1].id, qtyRequested: 30 },
              ],
            },
          },
        });
        console.log(`✅ Sample pending transfer created for ${hospital.name}`);
      }
    }
  }

  console.log('\n✅ Database seeding completed successfully!\n');
  console.log('='.repeat(60));
  console.log('DEFAULT CREDENTIALS:');
  console.log('='.repeat(60));
  console.log('\n🔐 SUPER ADMIN:');
  console.log('   Email: admin@mims.com');
  console.log('   Password: Admin@12345');
  console.log('   Access: All hospitals\n');
  
  for (const hospital of createdHospitals) {
    console.log(`🏥 HOSPITAL ADMIN - ${hospital.name}:`);
    console.log(`   Email: admin@${hospital.code.toLowerCase()}.com`);
    console.log(`   Password: Admin@12345`);
    console.log(`   Hospital: ${hospital.name} (${hospital.code})\n`);
    console.log(`💊 MAIN PHARMACY MANAGER - ${hospital.name}:`);
    console.log(`   Email: manager@${hospital.code.toLowerCase()}.com`);
    console.log(`   Password: Admin@12345\n`);
    console.log(`🏪 SUB PHARMACY MANAGER - ${hospital.name}:`);
    console.log(`   Email: submanager@${hospital.code.toLowerCase()}.com`);
    console.log(`   Password: Admin@12345\n`);
  }
  console.log('='.repeat(60));

  // ============================================
  // ATTENDANCE MODULE SEEDING
  // ============================================
  console.log('\n🎯 ATTENDANCE MODULE INITIALIZATION\n');
  
  // Seed shifts
  await seedShifts();
  
  // Seed leave types
  await seedLeaveTypes();
  
  // Seed holidays
  await seedHolidays();
  
  // Seed attendance configuration
  await seedAttendanceConfig();

  console.log('✅ All attendance module seeds completed successfully!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

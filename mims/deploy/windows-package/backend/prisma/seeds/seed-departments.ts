/**
 * Department and Sub-Department Seed Data
 * Seeds comprehensive hospital department structure with sub-departments
 */

import { PrismaClient, DepartmentStatus, SubDepartmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Comprehensive department structure for a hospital
const DEPARTMENTS_DATA = [
  {
    name: 'Radiology',
    code: 'RAD',
    description: 'Diagnostic imaging and radiology services',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'X-ray', code: 'XRAY', description: 'X-ray imaging services' },
      { name: 'Ultrasound', code: 'US', description: 'Ultrasound imaging services' },
      { name: 'CT Scan', code: 'CT', description: 'Computed Tomography services' },
      { name: 'MRI', code: 'MRI', description: 'Magnetic Resonance Imaging services' },
      { name: 'Mammography', code: 'MAMMO', description: 'Breast imaging services' },
    ],
  },
  {
    name: 'Laboratory',
    code: 'LAB',
    description: 'Medical laboratory and diagnostic tests',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Clinical Pathology', code: 'CPATH', description: 'Blood tests, urine analysis' },
      { name: 'Microbiology', code: 'MICRO', description: 'Culture and sensitivity tests' },
      { name: 'Biochemistry', code: 'BIOCHEM', description: 'Chemical analysis of body fluids' },
      { name: 'Hematology', code: 'HEMA', description: 'Blood cell analysis' },
      { name: 'Immunology', code: 'IMMUNO', description: 'Immune system tests' },
    ],
  },
  {
    name: 'Cardiology',
    code: 'CARD',
    description: 'Heart and cardiovascular care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'ECG', code: 'ECG', description: 'Electrocardiogram services' },
      { name: 'Echo', code: 'ECHO', description: 'Echocardiography services' },
      { name: 'Cardiac Catheterization', code: 'CATH', description: 'Invasive cardiac procedures' },
      { name: 'Cardiac ICU', code: 'CICU', description: 'Cardiac intensive care' },
    ],
  },
  {
    name: 'Emergency',
    code: 'EMER',
    description: 'Emergency and trauma care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Triage', code: 'TRIAGE', description: 'Patient assessment and prioritization' },
      { name: 'Trauma', code: 'TRAUMA', description: 'Trauma care' },
      { name: 'Resuscitation', code: 'RESUS', description: 'Critical emergency care' },
    ],
  },
  {
    name: 'Gynecology',
    code: 'GYNE',
    description: 'Women\'s health and reproductive care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'OPD', code: 'GYNEOPD', description: 'Outpatient gynecology' },
      { name: 'Obstetrics', code: 'OBS', description: 'Pregnancy and childbirth care' },
      { name: 'Labor Room', code: 'LABOR', description: 'Labor and delivery' },
      { name: 'NICU', code: 'NICU', description: 'Neonatal intensive care' },
    ],
  },
  {
    name: 'Neurology',
    code: 'NEURO',
    description: 'Brain and nervous system care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'EEG', code: 'EEG', description: 'Electroencephalogram services' },
      { name: 'EMG', code: 'EMG', description: 'Electromyography services' },
      { name: 'Neurosurgery', code: 'NSURG', description: 'Surgical neurology' },
    ],
  },
  {
    name: 'Orthopedics',
    code: 'ORTHO',
    description: 'Bone, joint, and musculoskeletal care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Joint Clinic', code: 'JOINT', description: 'Joint disorders and replacement' },
      { name: 'Spine Clinic', code: 'SPINE', description: 'Spinal disorders' },
      { name: 'Sports Medicine', code: 'SPORTS', description: 'Sports injuries' },
      { name: 'Fracture Clinic', code: 'FRACT', description: 'Fracture management' },
    ],
  },
  {
    name: 'Pediatrics',
    code: 'PEDI',
    description: 'Child healthcare',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'General Pediatrics', code: 'GENPEDI', description: 'General child care' },
      { name: 'PICU', code: 'PICU', description: 'Pediatric intensive care' },
      { name: 'Neonatology', code: 'NEONATO', description: 'Newborn care' },
    ],
  },
  {
    name: 'Surgery',
    code: 'SURG',
    description: 'General and specialized surgery',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'General Surgery', code: 'GSURG', description: 'General surgical procedures' },
      { name: 'Laparoscopy', code: 'LAPARO', description: 'Minimally invasive surgery' },
      { name: 'Operating Theater', code: 'OT', description: 'Surgical operations' },
      { name: 'Post-Op Ward', code: 'POSTOP', description: 'Post-operative care' },
    ],
  },
  {
    name: 'Internal Medicine',
    code: 'MED',
    description: 'General medicine and internal disorders',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'General Medicine', code: 'GENMED', description: 'General medical care' },
      { name: 'Medical ICU', code: 'MICU', description: 'Medical intensive care' },
      { name: 'Gastroenterology', code: 'GASTRO', description: 'Digestive system disorders' },
    ],
  },
  {
    name: 'Burn Unit',
    code: 'BURN',
    description: 'Burn injury treatment and care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Acute Burn Care', code: 'BURNACUTE', description: 'Immediate burn treatment' },
      { name: 'Burn ICU', code: 'BURNICU', description: 'Critical burn care' },
      { name: 'Rehabilitation', code: 'BURNREHAB', description: 'Burn recovery and therapy' },
    ],
  },
  {
    name: 'Psychiatry',
    code: 'PSYCH',
    description: 'Mental health and psychiatric care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Outpatient Psychiatry', code: 'PSYCHOPD', description: 'Outpatient mental health' },
      { name: 'Addiction Treatment', code: 'ADDICT', description: 'Substance abuse treatment' },
    ],
  },
  {
    name: 'Dermatology',
    code: 'DERM',
    description: 'Skin and related disorders',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'General Dermatology', code: 'GENDERM', description: 'General skin care' },
      { name: 'Cosmetic Dermatology', code: 'COSMDERM', description: 'Cosmetic procedures' },
    ],
  },
  {
    name: 'ENT',
    code: 'ENT',
    description: 'Ear, Nose, and Throat care',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Audiology', code: 'AUDIO', description: 'Hearing tests and treatment' },
      { name: 'Rhinology', code: 'RHINO', description: 'Nasal and sinus disorders' },
    ],
  },
  {
    name: 'Ophthalmology',
    code: 'EYE',
    description: 'Eye care and vision services',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'General Ophthalmology', code: 'GENEYE', description: 'General eye care' },
      { name: 'Retina Clinic', code: 'RETINA', description: 'Retinal disorders' },
      { name: 'Cataract Surgery', code: 'CATARACT', description: 'Cataract procedures' },
    ],
  },
  {
    name: 'Pharmacy',
    code: 'PHAR',
    description: 'Medication dispensing and management',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Main Pharmacy', code: 'MAINPHAR', description: 'Central pharmacy services' },
      { name: 'Emergency Pharmacy', code: 'EMERPHAR', description: 'Emergency medication dispensing' },
      { name: 'OPD Pharmacy', code: 'OPDPHAR', description: 'Outpatient pharmacy' },
    ],
  },
  {
    name: 'Physiotherapy',
    code: 'PHYSIO',
    description: 'Physical therapy and rehabilitation',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'General Physiotherapy', code: 'GENPHYSIO', description: 'General physical therapy' },
      { name: 'Rehabilitation', code: 'REHAB', description: 'Rehabilitation services' },
    ],
  },
  {
    name: 'Billing',
    code: 'BILL',
    description: 'Billing and financial services',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'OPD Billing', code: 'OPDBILL', description: 'Outpatient billing' },
      { name: 'IPD Billing', code: 'IPDBILL', description: 'Inpatient billing' },
      { name: 'Insurance', code: 'INS', description: 'Insurance claims' },
    ],
  },
  {
    name: 'Reception',
    code: 'RECEP',
    description: 'Patient reception and registration',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'Main Reception', code: 'MAINRECEP', description: 'Main reception desk' },
      { name: 'OPD Registration', code: 'OPDREG', description: 'Outpatient registration' },
      { name: 'Emergency Registration', code: 'EMERREG', description: 'Emergency registration' },
    ],
  },
  {
    name: 'Administration',
    code: 'ADMIN',
    description: 'Hospital administration and management',
    status: DepartmentStatus.ACTIVE,
    subDepartments: [
      { name: 'General Administration', code: 'GENADMIN', description: 'General admin services' },
      { name: 'HR', code: 'HR', description: 'Human resources' },
      { name: 'IT', code: 'IT', description: 'Information technology' },
    ],
  },
];

export async function seedDepartments(hospitalId: string) {
  console.log('🏥 Seeding departments and sub-departments...');

  for (const deptData of DEPARTMENTS_DATA) {
    const { subDepartments, ...departmentFields } = deptData;

    // Create or update department
    const department = await prisma.department.upsert({
      where: {
        hospitalId_code: {
          hospitalId,
          code: departmentFields.code,
        },
      },
      update: {
        name: departmentFields.name,
        description: departmentFields.description,
        status: departmentFields.status,
      },
      create: {
        hospitalId,
        ...departmentFields,
      },
    });

    console.log(`  ✓ ${departmentFields.name} (${departmentFields.code})`);

    // Create or update sub-departments
    if (subDepartments && subDepartments.length > 0) {
      for (const subDept of subDepartments) {
        await prisma.subDepartment.upsert({
          where: {
            departmentId_code: {
              departmentId: department.id,
              code: subDept.code,
            },
          },
          update: {
            name: subDept.name,
            description: subDept.description,
            status: SubDepartmentStatus.ACTIVE,
          },
          create: {
            departmentId: department.id,
            name: subDept.name,
            code: subDept.code,
            description: subDept.description,
            status: SubDepartmentStatus.ACTIVE,
          },
        });
        console.log(`    → ${subDept.name} (${subDept.code})`);
      }
    }
  }

  console.log('✅ Departments and sub-departments seeded successfully!');
}

// If run directly
if (require.main === module) {
  (async () => {
    try {
      // Get first hospital or create a default one
      let hospital = await prisma.hospital.findFirst();
      
      if (!hospital) {
        console.log('⚠️  No hospital found. Creating default hospital...');
        hospital = await prisma.hospital.create({
          data: {
            name: 'General Hospital',
            code: 'GH001',
            address: '123 Medical Street',
            phone: '+1234567890',
            email: 'admin@generalhospital.com',
          },
        });
        console.log('✓ Default hospital created');
      }

      await seedDepartments(hospital.id);
      
      console.log('\n📊 Summary:');
      const deptCount = await prisma.department.count({ where: { hospitalId: hospital.id } });
      const subDeptCount = await prisma.subDepartment.count();
      console.log(`  • Departments: ${deptCount}`);
      console.log(`  • Sub-departments: ${subDeptCount}`);
      
    } catch (error) {
      console.error('❌ Error seeding departments:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  })();
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDepartments() {
  try {
    console.log('Starting to clear departments and sub-departments...');

    // First, delete all sub-departments (they have foreign key to departments)
    const deletedSubDepts = await prisma.subDepartment.deleteMany({});
    console.log(`✅ Deleted ${deletedSubDepts.count} sub-departments`);

    // Then, delete all departments
    const deletedDepts = await prisma.department.deleteMany({});
    console.log(`✅ Deleted ${deletedDepts.count} departments`);

    console.log('✨ All departments and sub-departments have been cleared!');
  } catch (error) {
    console.error('❌ Error clearing departments:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearDepartments()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

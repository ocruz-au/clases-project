import { PrismaClient, RoleKey } from '@prisma/client';
import * as argon2 from 'argon2';
import { DateTime } from 'luxon';

const prisma = new PrismaClient();
const PERTH_TZ = 'Australia/Perth';

async function main() {
  console.log('🌱 Seeding database...');

  // ── Roles ───────────────────────────────────────────────────────────────────
  const roles: { key: RoleKey; description: string }[] = [
    { key: 'STUDENT', description: 'Can browse, book, and manage their own bookings' },
    { key: 'INSTRUCTOR', description: 'Can view assigned classes and manage attendance' },
    { key: 'ADMIN', description: 'Can manage catalog, schedules, users, and reports' },
    { key: 'SUPER_ADMIN', description: 'Can manage global and security settings' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { description: role.description },
      create: role,
    });
  }
  console.log('  ✓ Roles');

  // ── Default Cancellation Policy ──────────────────────────────────────────────
  const defaultPolicy = await prisma.cancellationPolicy.upsert({
    where: { id: 'default-cancellation-policy' },
    update: {},
    create: {
      id: 'default-cancellation-policy',
      name: 'Standard 24h Policy',
      isDefault: true,
      rules: [
        { hoursBefore: 24, refundPercent: 100 },
        { hoursBefore: 2, refundPercent: 50 },
        { hoursBefore: 0, refundPercent: 0 },
      ],
    },
  });
  console.log('  ✓ Default cancellation policy');

  // ── Default Settings ─────────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: 'seatHoldWindowMinutes' },
    update: {},
    create: { key: 'seatHoldWindowMinutes', value: 10, scope: 'GLOBAL' },
  });
  await prisma.setting.upsert({
    where: { key: 'reminderLeadHours' },
    update: {},
    create: { key: 'reminderLeadHours', value: 24, scope: 'GLOBAL' },
  });
  await prisma.setting.upsert({
    where: { key: 'defaultCancellationPolicyId' },
    update: {},
    create: { key: 'defaultCancellationPolicyId', value: defaultPolicy.id, scope: 'GLOBAL' },
  });
  console.log('  ✓ Default settings');

  // ── Test Users ────────────────────────────────────────────────────────────────
  const testPassword = await argon2.hash('Password123!');

  const studentUser = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      name: 'Alice Student',
      passwordHash: testPassword,
      userRoles: { create: { role: { connect: { key: 'STUDENT' } } } },
    },
  });

  const instructorUser = await prisma.user.upsert({
    where: { email: 'instructor@example.com' },
    update: {},
    create: {
      email: 'instructor@example.com',
      name: 'Bob Instructor',
      passwordHash: testPassword,
      userRoles: { create: { role: { connect: { key: 'INSTRUCTOR' } } } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Carol Admin',
      passwordHash: testPassword,
      mfaEnabled: false,
      userRoles: { create: { role: { connect: { key: 'ADMIN' } } } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'superadmin@example.com' },
    update: {},
    create: {
      email: 'superadmin@example.com',
      name: 'Dave SuperAdmin',
      passwordHash: testPassword,
      mfaEnabled: false,
      userRoles: { create: { role: { connect: { key: 'SUPER_ADMIN' } } } },
    },
  });
  console.log('  ✓ Test users (student / instructor / admin / super admin)');

  // ── Instructor Profile ────────────────────────────────────────────────────────
  const instructorProfile = await prisma.instructorProfile.upsert({
    where: { userId: instructorUser.id },
    update: {},
    create: {
      userId: instructorUser.id,
      bio: 'Certified yoga and pilates instructor with 10 years experience.',
    },
  });
  console.log('  ✓ Instructor profile');

  // ── Location & Room ───────────────────────────────────────────────────────────
  const location = await prisma.location.upsert({
    where: { id: 'seed-location-perth' },
    update: {},
    create: {
      id: 'seed-location-perth',
      name: 'Perth CBD Studio',
      address: '123 Murray Street, Perth WA 6000',
      timezone: PERTH_TZ,
    },
  });

  const room = await prisma.room.upsert({
    where: { id: 'seed-room-main' },
    update: {},
    create: {
      id: 'seed-room-main',
      locationId: location.id,
      name: 'Main Studio',
      capacity: 20,
    },
  });
  console.log('  ✓ Location + room');

  // ── Category ──────────────────────────────────────────────────────────────────
  const category = await prisma.category.upsert({
    where: { slug: 'yoga' },
    update: {},
    create: {
      name: 'Yoga',
      slug: 'yoga',
      description: 'All levels yoga classes',
    },
  });
  console.log('  ✓ Category');

  // ── Class ─────────────────────────────────────────────────────────────────────
  const klass = await prisma.class.upsert({
    where: { id: 'seed-class-yoga' },
    update: {},
    create: {
      id: 'seed-class-yoga',
      title: 'Morning Yoga Flow',
      description: 'A gentle morning yoga class for all levels.',
      categoryId: category.id,
      priceCents: 2500, // $25.00 AUD
      currency: 'AUD',
      defaultCapacity: 15,
      cancellationPolicyId: defaultPolicy.id,
    },
  });
  console.log('  ✓ Class');

  // ── 10 Class Sessions (next 10 Mondays at 07:00 Perth local) ──────────────────
  const now = DateTime.now().setZone(PERTH_TZ);
  let nextMonday = now.startOf('week').plus({ days: 1 }); // Monday of current week
  if (nextMonday <= now) nextMonday = nextMonday.plus({ weeks: 1 });

  const sessionIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const sessionDate = nextMonday.plus({ weeks: i });
    const startsAt = sessionDate.set({ hour: 7, minute: 0, second: 0, millisecond: 0 }).toUTC().toJSDate();
    const endsAt = sessionDate.set({ hour: 8, minute: 0, second: 0, millisecond: 0 }).toUTC().toJSDate();
    const sessionId = `seed-session-${i + 1}`;
    sessionIds.push(sessionId);

    await prisma.classSession.upsert({
      where: { id: sessionId },
      update: {},
      create: {
        id: sessionId,
        classId: klass.id,
        roomId: room.id,
        instructorId: instructorProfile.id,
        startsAt,
        endsAt,
        capacity: 15,
        status: 'SCHEDULED',
        cancellationPolicyId: defaultPolicy.id,
      },
    });
  }
  console.log(`  ✓ ${sessionIds.length} class sessions (next 10 Monday mornings, 07:00 Perth)`);

  console.log('\n✅ Seed complete.');
  console.log('\nTest credentials (password: Password123!):');
  console.log('  student@example.com');
  console.log('  instructor@example.com');
  console.log('  admin@example.com');
  console.log('  superadmin@example.com');
  console.log(`\nFirst session ID: ${sessionIds[0] ?? 'none'}`);
  console.log(`Student user ID:  ${studentUser.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void prisma.$disconnect());

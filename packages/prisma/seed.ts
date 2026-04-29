import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding plans...');

  await prisma.plan.upsert({
    where: { name: 'Free' },
    update: {},
    create: {
      name: 'Free',
      stripePriceId: null,
      stripeProductId: null,
      description: 'Para probar la plataforma',
      priceMonthly: 0,
      currency: 'USD',
      isActive: true,
      maxAgents: 1,
      maxConversationsPerMonth: 50,
      maxMessagesPerMonth: 500,
      maxContacts: 200,
      maxTeamMembers: 1,
      features: ['lead_capture'],
    },
  });

  await prisma.plan.upsert({
    where: { name: 'Starter' },
    update: {},
    create: {
      name: 'Starter',
      description: 'Para negocios en crecimiento',
      priceMonthly: 29,
      currency: 'USD',
      isActive: true,
      maxAgents: 3,
      maxConversationsPerMonth: 500,
      maxMessagesPerMonth: 5000,
      maxContacts: 2000,
      maxTeamMembers: 5,
      features: ['lead_capture', 'appointments', 'analytics', 'team_inbox'],
    },
  });

  console.log('Plans seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const failed = await prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
  `;
  console.log("Rows needing attention:", failed);

  const del = await prisma.$executeRaw`
    DELETE FROM "_prisma_migrations"
    WHERE migration_name = '20261019000000_add_social_fields_and_social_clicks'
  `;
  console.log("Deleted failed migration marker rows:", del);

  const pending = await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM "_prisma_migrations"
    ORDER BY finished_at ASC
  `;
  console.log("All migration rows:", pending);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

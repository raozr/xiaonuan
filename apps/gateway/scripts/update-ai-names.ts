import { prisma } from '@xiaonuan/prisma';

async function main() {
  console.log('查找需要更新的 AI 名称...');

  const aiPersonas = await prisma.aIPersona.findMany({
    where: {
      name: { in: ['我', '贴心小暖'] },
    },
    include: {
      pairing: {
        include: {
          participants: {
            where: { role: 'STEWARD', isAI: false },
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  });

  console.log(`找到 ${aiPersonas.length} 条需要更新的记录\n`);

  let updated = 0;
  let skipped = 0;

  for (const ap of aiPersonas) {
    const steward = ap.pairing.participants[0];
    const stewardName = steward?.user?.name;

    if (!stewardName) {
      console.log(`  ⏭️  ${ap.pairingId}: 未找到照管者名字，跳过`);
      skipped++;
      continue;
    }

    // 更新 AIPersona 名称
    await prisma.aIPersona.update({
      where: { id: ap.id },
      data: { name: stewardName },
    });

    // 更新 AI Participant 名称
    await prisma.participant.updateMany({
      where: { pairingId: ap.pairingId, isAI: true },
      data: { name: stewardName },
    });

    console.log(`  ✅ ${ap.pairingId}: "${ap.name}" → "${stewardName}"`);
    updated++;
  }

  console.log(`\n完成：更新 ${updated} 条，跳过 ${skipped} 条`);
}

main()
  .catch((err) => {
    console.error('失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

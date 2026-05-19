import { createPiAgent } from './agent/pi-agent.js';
import { prisma } from '@xiaonuan/prisma';

async function run() {
  console.log('--- 启动小暖 Tool Calling 测试 ---');

  let pairing = await prisma.pairing.findFirst();
  if (!pairing) {
    pairing = await prisma.pairing.create({
      data: {
        name: 'Test Pairing',
        inviteCode: 'TEST-' + Date.now(),
        inviteCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        participants: {
          create: [
            { name: 'Test Elder', role: 'ELDER', isAI: false },
            { name: '小暖', role: 'ELDER', isAI: true },
          ],
        },
      },
    });
    console.log(`创建了测试配对: ${pairing.id}`);
  } else {
    console.log(`使用已有配对: ${pairing.id}`);
  }

  const agent = await createPiAgent({
    pairingId: pairing.id,
    phase: 'active_chat',
  });

  const sessionId = 'test-session-' + Date.now();

  // Test Case 1: Memory Note
  const testInput1 = '哎，我胃痛得吃不下肉，太难受了。不想活了，觉得活着没意思。';

  console.log(`\n[User]: ${testInput1}`);

  const start = Date.now();
  const reply = await agent.processMessage(testInput1, {
    sessionId,
    turnCount: 1,
  });

  console.log(`\n[Agent]: ${reply}`);
  console.log(`耗时: ${Date.now() - start}ms`);

  // Check the event stream to see if anything was written
  const events = await prisma.eventStream.findMany({
    where: { pairingId: pairing.id },
    orderBy: { eventTime: 'desc' },
    take: 3,
  });

  console.log('\n--- 最新 EventStream ---');
  console.log(events);

  await prisma.$disconnect();
}

run().catch(console.error);

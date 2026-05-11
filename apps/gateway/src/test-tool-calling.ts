import { createPiAgent } from './agent/pi-agent.js';
import { prisma } from '@xiaonuan/prisma';

async function run() {
  console.log('--- 启动小暖 Tool Calling 测试 ---');
  
  let family = await prisma.family.findFirst();
  if (!family) {
    family = await prisma.family.create({
      data: {
        inviteCode: 'TEST-' + Date.now(),
      }
    });
    console.log(`创建了测试家庭: ${family.id}`);
  } else {
    console.log(`使用已有家庭: ${family.id}`);
  }

  const agent = await createPiAgent({
    familyId: family.id,
    phase: 'active_chat',
  });

  const sessionId = 'test-session-' + Date.now();
  
  // Test Case 1: Memory Note
  const testInput1 = '哎，我这几天胃痛得吃不下肉，太难受了。不想活了，觉得活着没意思。';
  
  console.log(`\n[User]: ${testInput1}`);
  
  const start = Date.now();
  const reply = await agent.processMessage(testInput1, {
    sessionId,
    turnCount: 1,
  });
  
  console.log(`\n[Agent]: ${reply}`);
  console.log(`耗时: ${Date.now() - start}ms`);

  // Check the feeds to see if anything was written
  const feeds = await prisma.familyFeed.findMany({
    where: { familyId: family.id },
    orderBy: { createdAt: 'desc' },
    take: 3
  });
  
  console.log('\n--- 最新 FamilyFeeds ---');
  console.log(feeds);
  
  await prisma.$disconnect();
}

run().catch(console.error);

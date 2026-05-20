import { getQueue, type ExtractionJob } from './extraction-queue.js';

export async function enqueueExtraction(
  source: ExtractionJob['source'],
  pairingId: string,
  content: string,
  senderRole?: string,
  context?: string
) {
  const queue = await getQueue();
  const job = await queue.add(`${source}-extraction`, {
    source,
    pairingId,
    content,
    senderRole,
    context,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
  return job.id;
}

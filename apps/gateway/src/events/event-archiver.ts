import { prisma } from '@xiaonuan/prisma';

const ARCHIVE_CUTOFF_DAYS = 30;
const DELETE_CUTOFF_DAYS = 90;

export async function pruneEvents(): Promise<{ archivedCount: number; deletedCount: number }> {
  const archiveCutoff = new Date();
  archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_CUTOFF_DAYS);

  const deleteCutoff = new Date();
  deleteCutoff.setDate(deleteCutoff.getDate() - DELETE_CUTOFF_DAYS);

  // Delete events older than 90 days
  const deleteResult = await prisma.eventStream.deleteMany({
    where: {
      eventTime: { lt: deleteCutoff },
    },
  });

  return {
    archivedCount: 0, // No separate archive table, events >30 days stay in place
    deletedCount: deleteResult.count,
  };
}

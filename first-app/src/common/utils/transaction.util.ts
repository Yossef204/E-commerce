import { Connection, ClientSession } from 'mongoose';
import { Logger } from '@nestjs/common';

/**
 * Executes operations in a MongoDB transaction if replica set is available,
 * or gracefully falls back to sequential atomic execution if standalone MongoDB.
 */
export async function runSafeTransaction<T>(
  connection: Connection,
  work: (session?: ClientSession) => Promise<T>,
  logger?: Logger,
): Promise<T> {
  const client = (connection as any)?.client;
  const topologyType = client?.topology?.description?.type;
  const replicaSetName = client?.topology?.description?.setName;

  // In Standalone Mongo (local dev), topology type is 'Single' and setName is undefined.
  const isStandalone =
    topologyType === 'Single' ||
    (!replicaSetName &&
      topologyType !== 'ReplicaSetWithPrimary' &&
      topologyType !== 'Sharded');

  if (isStandalone) {
    if (logger) {
      logger.log(
        `[MongoDB Standalone] Instance type is "${topologyType}". Executing operations sequentially without transaction session.`,
      );
    }
    return await work(undefined);
  }

  let session: ClientSession | null = null;
  try {
    session = await connection.startSession();
    session.startTransaction();

    const result = await work(session);

    await session.commitTransaction();
    return result;
  } catch (err: any) {
    if (session && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (_) {}
    }

    const isStandaloneError =
      err?.message?.includes('replica set') ||
      err?.message?.includes('Transaction numbers') ||
      err?.codeName === 'IllegalOperation' ||
      err?.code === 20;

    if (isStandaloneError) {
      if (logger) {
        logger.warn(
          `[MongoDB Fallback] Transactions unsupported on this instance. Executing atomically without session.`,
        );
      }
      return await work(undefined);
    }

    throw err;
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (_) {}
    }
  }
}


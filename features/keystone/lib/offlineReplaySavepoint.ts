type SavepointTransaction = {
  $executeRawUnsafe(query: string): PromiseLike<unknown>;
};

/** Keep one nested replay operation behind its own SQL savepoint. */
export async function runOfflineOperationSavepoint<T>({
  transaction,
  index,
  sequence,
  execute,
}: {
  transaction: SavepointTransaction;
  index: number;
  sequence: number;
  execute: () => Promise<T>;
}): Promise<T> {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error("Offline operation savepoint index is invalid");
  }

  const savepoint = `offline_operation_${index}`;
  await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    const result = await execute();
    await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch {
    await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
    throw new Error(
      `Offline operation sequence ${sequence} was rejected; the batch was not acknowledged`,
    );
  }
}

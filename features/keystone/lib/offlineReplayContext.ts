/**
 * Route nested offline operations through the batch transaction, while keeping
 * manager-PIN admission on the original client so throttle evidence survives a
 * rejected operation/batch.
 */
export function createOfflineReplayTransactionContext<
  TContext extends { prisma: unknown },
>(context: TContext, transaction: object): TContext {
  const prisma = new Proxy(transaction, {
    get(target, property, receiver) {
      if (property === "__ofcIndependentManagerAuthorityClient") {
        return context.prisma;
      }
      if (property === "$transaction") {
        return async (callback: (client: object) => unknown) =>
          callback(transaction);
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return new Proxy(context as object, {
    get(target, property, receiver) {
      if (property === "prisma") return prisma as TContext["prisma"];
      if (property === "__ofcNestedOperationTransaction") return true;
      return Reflect.get(target, property, receiver);
    },
  }) as TContext;
}

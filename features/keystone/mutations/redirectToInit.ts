import type { Context } from '.keystone/types';

async function redirectToInit(_root: unknown, _args: Record<string, never>, context: Context) {
  const userCount = await context.sudo().query.User.count({});

  if (userCount === 0) {
    return true;
  }
  return false;
}

export default redirectToInit;

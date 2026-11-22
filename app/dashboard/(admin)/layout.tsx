export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/features/dashboard/components/DashboardLayout';
import { getAdminMetaAction, getAuthenticatedUser } from '@/features/dashboard/actions';

export default async function ListLayout({ children }: { children: React.ReactNode }) {
  // Fetch adminMeta and user data server-side to avoid loading states
  const [adminMetaResponse, userResponse] = await Promise.all([
    getAdminMetaAction(),
    getAuthenticatedUser()
  ]);
  
  // The layout only needs each list's name and visibility (the sidebar). The full field metadata
  // (~1 MB) is loaded on demand by the editors that need it (useList), not sent with every page.
  const full = adminMetaResponse.success ? adminMetaResponse.data : null;
  const adminMeta = full
    ? {
        ...full,
        lists: Object.values(full.lists ?? {}).map((list: any) => ({
          key: list.key, path: list.path, label: list.label, isHidden: list.isHidden, fields: [],
        })),
        isSlim: true,
      }
    : null;
  const user = userResponse.success ? userResponse.data?.authenticatedItem : null;

  return (
    <DashboardLayout adminMeta={adminMeta} authenticatedItem={user}>
      {children}
    </DashboardLayout>
  );
}
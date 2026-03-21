import { AuthGuard } from '@/components/AuthGuard';

export default function DashboardPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}

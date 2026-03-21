import { AuthGuard } from '@/components/AuthGuard';

export default function MilestonesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}

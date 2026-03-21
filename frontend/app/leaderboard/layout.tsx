import { AuthGuard } from '@/components/AuthGuard';

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}

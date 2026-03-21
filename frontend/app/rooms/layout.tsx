import { AuthGuard } from '@/components/AuthGuard';

export default function RoomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}

import { AuthGuard } from '@/components/AuthGuard';

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}

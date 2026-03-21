import { AuthGuard } from '@/components/AuthGuard';

export default function HeatmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}

import { AuthGuard } from '@/components/AuthGuard';

export default function LessonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}

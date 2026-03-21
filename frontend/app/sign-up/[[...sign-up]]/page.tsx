import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-950 gap-4">
      <div className="mb-4 text-center">
        <h1 className="text-3xl font-bold text-white">DevPath</h1>
        <p className="text-gray-400 mt-1">Start your coding journey today</p>
      </div>
      <SignUp />
    </main>
  );
}

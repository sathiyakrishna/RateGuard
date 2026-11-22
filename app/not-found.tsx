import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1>Page not found</h1>
      <p className="text-ink-500">This page doesn’t exist.</p>
      <Link href="/" className="btn-primary mt-2">Back to RateGuard</Link>
    </main>
  );
}

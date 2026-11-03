import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-4xl font-extrabold text-blue-500">404</div>
        <h2 className="text-xl font-bold text-white">Page Not Found</h2>
        <p className="text-sm text-slate-400">
          The interview or dashboard page you are looking for does not exist or may have been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          Access Restricted
        </p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">You do not have access to this route</h1>
        <p className="mt-3 text-sm text-slate-600">
          Your account role does not include permission for this page. Sign in with a different
          clinic role or return to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign In Again
          </Link>
        </div>
      </div>
    </main>
  );
}

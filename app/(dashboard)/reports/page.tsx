export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Clinical and financial reports dashboard</p>
        </div>
        <button className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800">
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Patients</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">1,644</p>
          <p className="mt-1 text-xs text-emerald-600">↑ 10% vs last month</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Revenue</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">$145k</p>
          <p className="mt-1 text-xs text-emerald-600">↑ 8% vs last month</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Appointments</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">355</p>
          <p className="mt-1 text-xs text-red-600">↓ 10% vs last month</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Avg Rating</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">4.8/5</p>
          <p className="mt-1 text-xs text-slate-500">256 reviews</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">Monthly Overview</h2>
        <div className="mt-6 grid h-64 grid-cols-12 items-end gap-2 rounded-lg bg-slate-50 p-4">
          {[42, 58, 49, 72, 66, 74, 69, 88, 84, 95, 92, 98].map((height, idx) => (
            <div key={idx} className="relative h-full">
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-red-600 to-red-400"
                style={{ height: `${height}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

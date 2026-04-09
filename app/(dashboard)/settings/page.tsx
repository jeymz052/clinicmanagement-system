export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">System and account settings</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">General Settings</h2>
        <form className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700">Clinic Name</label>
            <input
              type="text"
              defaultValue="City Medical Clinic"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                defaultValue="admin@clinic.com"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                defaultValue="+1 (555) 123-4567"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Address</label>
            <input
              type="text"
              defaultValue="123 Medical Avenue"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <button
            type="button"
            className="rounded-lg bg-teal-700 px-6 py-2 font-semibold text-white hover:bg-teal-800"
          >
            Save Changes
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">Security</h2>
        <div className="mt-6 space-y-4">
          <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <span className="font-medium text-slate-900">Change Password</span>
            <span>→</span>
          </button>
          <button className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <span className="font-medium text-slate-900">Two-Factor Authentication</span>
            <span>Enabled</span>
          </button>
        </div>
      </div>
    </div>
  );
}

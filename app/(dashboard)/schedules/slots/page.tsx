export default function TimeSlotsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Time Slots Management</h1>
          <p className="mt-1 text-sm text-slate-500">Configure and manage available time slots</p>
        </div>
        <button className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700">
          Add Time Slot
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="mb-6 text-lg font-bold text-slate-900">Create New Time Slot</h2>
        <form className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Doctor</label>
              <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option>Dr. Lina Fox</option>
                <option>Dr. Omar Reed</option>
                <option>Dr. Amara Singh</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Start Time</label>
              <input
                type="time"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">End Time</label>
              <input
                type="time"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Max Capacity (per hour)</label>
            <input
              type="number"
              placeholder="5"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-6 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Create Slot
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-6 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

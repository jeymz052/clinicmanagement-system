"use client";

export default function SchedulesPage() {
  const timeSlots = [
    { time: "08:00 - 09:00", capacity: "5/5", status: "Full" },
    { time: "09:00 - 10:00", capacity: "3/5", status: "Available" },
    { time: "10:00 - 11:00", capacity: "5/5", status: "Full" },
    { time: "11:00 - 12:00", capacity: "2/5", status: "Available" },
    { time: "01:00 - 02:00", capacity: "4/5", status: "Available" },
    { time: "02:00 - 03:00", capacity: "5/5", status: "Full" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Doctor Schedules</h1>
        <p className="mt-1 text-sm text-slate-500">Manage daily doctor schedules and availability</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Select Doctor</label>
            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option>Dr. Lina Fox</option>
              <option>Dr. Omar Reed</option>
              <option>Dr. Amara Singh</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Select Date</label>
            <input
              type="date"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold text-slate-900">Daily Time Slots</h2>
        <p className="mt-1 text-sm text-slate-500">Max 5 patients per hour per doctor</p>

        <div className="mt-6 space-y-2">
          {timeSlots.map((slot, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
              <div>
                <p className="font-semibold text-slate-900">{slot.time}</p>
                <p className="text-sm text-slate-500">Capacity: {slot.capacity}</p>
              </div>
              <span
                className={`rounded-full px-4 py-1 text-sm font-semibold ${
                  slot.status === "Full"
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {slot.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

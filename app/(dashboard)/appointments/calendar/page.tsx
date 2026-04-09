export default function CalendarViewPage() {
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dates = ["4", "5", "6", "7", "8", "9", "10"];
  const timeSlots = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Calendar View</h1>
        <p className="mt-1 text-sm text-slate-500">Appointment calendar by doctor and time slot</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">November 2025</h2>
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-50">
              &lt; Back
            </button>
            <button className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm hover:bg-slate-50">
              Next &gt;
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr>
                <th className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
                  Time
                </th>
                {daysOfWeek.map((day, idx) => (
                  <th
                    key={day}
                    className="border border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700"
                  >
                    {day} {dates[idx]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time) => (
                <tr key={time}>
                  <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">
                    {time}
                  </td>
                  {daysOfWeek.map((day) => (
                    <td
                      key={`${day}-${time}`}
                      className="border border-slate-200 px-3 py-2 hover:bg-red-50"
                    >
                      <button className="w-full rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">
                        Dr.Fox
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
            <span className="text-sm text-slate-600">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-slate-300"></div>
            <span className="text-sm text-slate-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-slate-600">Blocked</span>
          </div>
        </div>
      </div>
    </div>
  );
}

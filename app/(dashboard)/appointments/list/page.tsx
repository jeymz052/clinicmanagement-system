"use client";

const APPOINTMENTS = [
  {
    id: 1,
    patient: "John Doe",
    doctor: "Dr. Lina Fox",
    date: "Nov 8, 2025",
    time: "09:00 AM",
    type: "Clinic",
    status: "Confirmed",
    color: "emerald",
  },
  {
    id: 2,
    patient: "Jane Smith",
    doctor: "Dr. Omar Reed",
    date: "Nov 8, 2025",
    time: "10:00 AM",
    type: "Online",
    status: "Paid",
    color: "blue",
  },
  {
    id: 3,
    patient: "Michael Brown",
    doctor: "Dr. Lina Fox",
    date: "Nov 8, 2025",
    time: "11:00 AM",
    type: "Clinic",
    status: "Confirmed",
    color: "emerald",
  },
  {
    id: 4,
    patient: "Sarah Wilson",
    doctor: "Dr. Amara Singh",
    date: "Nov 9, 2025",
    time: "02:00 PM",
    type: "Online",
    status: "Pending Payment",
    color: "yellow",
  },
];

export default function AppointmentListPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Appointment List</h1>
          <p className="mt-1 text-sm text-slate-500">View and manage all appointments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">42</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Confirmed</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">28</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Pending</p>
          <p className="mt-2 text-2xl font-bold text-yellow-600">8</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Cancelled</p>
          <p className="mt-2 text-2xl font-bold text-red-600">6</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Patient</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Doctor</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Date & Time</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Type</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {APPOINTMENTS.map((apt) => (
              <tr key={apt.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{apt.patient}</td>
                <td className="px-6 py-3 text-slate-600">{apt.doctor}</td>
                <td className="px-6 py-3 text-slate-600">
                  {apt.date} {apt.time}
                </td>
                <td className="px-6 py-3 text-slate-600">{apt.type}</td>
                <td className="px-6 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      apt.color === "emerald"
                        ? "bg-emerald-100 text-emerald-700"
                        : apt.color === "blue"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {apt.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

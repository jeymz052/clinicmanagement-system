export default function ConsultationHistoryPage() {
  const consultations = [
    {
      id: 1,
      doctor: "Dr. Lina Fox",
      date: "Nov 10, 2025",
      time: "2:00 PM",
      type: "Online",
      status: "Completed",
      notes: "Follow-up for hypertension",
    },
    {
      id: 2,
      doctor: "Dr. Omar Reed",
      date: "Nov 5, 2025",
      time: "10:30 AM",
      type: "Online",
      status: "Completed",
      notes: "Initial consultation for headaches",
    },
    {
      id: 3,
      doctor: "Dr. Amara Singh",
      date: "Oct 28, 2025",
      time: "3:15 PM",
      type: "Online",
      status: "Completed",
      notes: "Post-surgery check-up",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Consultation History</h1>
        <p className="mt-1 text-sm text-slate-500">View all past consultations and notes</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-6 py-3 font-semibold text-slate-700">Doctor</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Date & Time</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Type</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Notes</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-6 py-3 font-semibold text-slate-700">Action</th>
            </tr>
          </thead>
          <tbody>
            {consultations.map((consultation) => (
              <tr key={consultation.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-6 py-3 font-medium text-slate-900">{consultation.doctor}</td>
                <td className="px-6 py-3 text-slate-600">
                  {consultation.date} {consultation.time}
                </td>
                <td className="px-6 py-3 text-slate-600">{consultation.type}</td>
                <td className="px-6 py-3 text-slate-600">{consultation.notes}</td>
                <td className="px-6 py-3">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {consultation.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <button className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    View Details
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

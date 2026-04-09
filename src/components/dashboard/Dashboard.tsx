type StatCard = {
  label: string;
  value: string;
  trend: string;
};

const STAT_CARDS: StatCard[] = [
  { label: "Today Appointments", value: "42", trend: "+12%" },
  { label: "Online Consultations", value: "18", trend: "+7%" },
  { label: "Pending Invoices", value: "$4,820", trend: "-3%" },
  { label: "New Patients", value: "26", trend: "+14%" },
];

const CALENDAR_DAYS = [
  "Mon 08",
  "Tue 09",
  "Wed 10",
  "Thu 11",
  "Fri 12",
  "Sat 13",
  "Sun 14",
];

const TIME_SLOTS = [
  { doctor: "Dr. Lina Fox", slot: "09:00", type: "Clinic", state: "Booked" },
  { doctor: "Dr. Omar Reed", slot: "09:00", type: "Online", state: "Paid" },
  { doctor: "Dr. Lina Fox", slot: "10:00", type: "Clinic", state: "Booked" },
  { doctor: "Dr. Amara Singh", slot: "11:00", type: "Online", state: "Awaiting Payment" },
  { doctor: "Dr. Omar Reed", slot: "11:00", type: "Clinic", state: "Booked" },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-4 lg:grid-cols-2">
        {STAT_CARDS.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
            <p className="mt-2 text-xs font-semibold text-emerald-600">{card.trend} vs last week</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <Card title="Revenue and Visit Trend">
            <div className="grid h-64 grid-cols-12 items-end gap-2 rounded-xl bg-slate-50 p-4">
              {[42, 58, 49, 72, 66, 74, 69, 88, 84, 95, 92, 98].map((height, index) => (
                <div key={index} className="relative h-full">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-md bg-gradient-to-t from-sky-600 to-cyan-400"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Appointment Calendar">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
                {CALENDAR_DAYS.map((day, index) => (
                  <button
                    key={day}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      index === 2
                        ? "border-sky-500 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-4 py-2">Doctor</th>
                      <th className="px-4 py-2">Time Slot</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS.map((slot) => (
                      <tr key={`${slot.doctor}-${slot.slot}-${slot.type}`} className="border-t border-slate-200">
                        <td className="px-4 py-2 font-medium text-slate-800">{slot.doctor}</td>
                        <td className="px-4 py-2 text-slate-700">{slot.slot}</td>
                        <td className="px-4 py-2 text-slate-700">{slot.type}</td>
                        <td className="px-4 py-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {slot.state}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-4">
          <Card title="Book Appointment Form">
            <form className="space-y-3">
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Patient Name" />
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" defaultValue="">
                <option value="" disabled>Select Doctor</option>
                <option>Dr. Lina Fox</option>
                <option>Dr. Omar Reed</option>
                <option>Dr. Amara Singh</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                <input type="time" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
              </div>
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" defaultValue="Clinic">
                <option>Clinic</option>
                <option>Online</option>
              </select>
              <button className="w-full rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800" type="button">
                Reserve Slot
              </button>
            </form>
          </Card>

          <Card title="Online Payment Form">
            <form className="space-y-3">
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Invoice ID" />
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Amount" />
              <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" defaultValue="Card">
                <option>Card</option>
                <option>Bank Transfer</option>
                <option>Wallet</option>
              </select>
              <button className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700" type="button">
                Pay Now
              </button>
            </form>
          </Card>

          <Card title="Patient Record Form">
            <form className="space-y-3">
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Patient ID" />
              <textarea
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                placeholder="Diagnosis and notes"
              />
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Prescription" />
              <button className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" type="button">
                Save Record
              </button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  );
}

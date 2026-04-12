"use client";

import { useConsultationNotes } from "@/src/components/clinic/useClinicData";
import { useAppointments } from "@/src/components/appointments/useAppointments";
import { formatDisplayDate, formatRange, getDoctorById } from "@/src/lib/appointments";

export default function ConsultationHistoryPage() {
  const { appointments } = useAppointments();
  const { data: notes, isLoading, error } = useConsultationNotes();

  const entries = notes
    .map((note) => ({
      note,
      appointment: appointments.find((appointment) => appointment.id === note.appointmentId) ?? null,
    }))
    .sort((left, right) => right.note.updatedAt.localeCompare(left.note.updatedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Consultation History</h1>
        <p className="mt-1 text-sm text-slate-500">Past consultations, progress notes, and care plans.</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {entries.length ? (
          entries.map(({ note, appointment }) => {
            const doctor = getDoctorById(note.doctorId);

            return (
              <article key={note.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{note.patientName}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {doctor?.name} | {appointment ? formatDisplayDate(appointment.date) : "Schedule unavailable"}
                      {appointment ? ` | ${formatRange(appointment.start, appointment.end)}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      note.status === "Completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : note.status === "In Progress"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {note.status}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Consultation Note
                    </p>
                    <p className="mt-3 text-sm text-slate-700">{note.note}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Prescription / Plan
                    </p>
                    <p className="mt-3 text-sm text-slate-700">{note.prescription || "No prescription recorded."}</p>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  Updated {new Date(note.updatedAt).toLocaleString("en-US")}
                </p>
              </article>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-sm text-slate-500">
            No consultation notes have been saved yet.
          </div>
        )}
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading consultation history...</p> : null}
    </div>
  );
}

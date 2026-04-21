"use client";

import { formatRange, type SlotStatus } from "@/src/lib/appointments";

type SharedSlotPickerProps = {
  slotStatuses: SlotStatus[];
  selectedStart: string;
  onSelect: (start: string) => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  subtitle?: string;
};

export function SharedSlotPicker({
  slotStatuses,
  selectedStart,
  onSelect,
  disabled = false,
  loading = false,
  title = "Time slot",
  subtitle = "Shared doctor slots update live across clinic and online consultations.",
}: SharedSlotPickerProps) {
  const availableSlots = slotStatuses.filter((slot) => slot.availableForType);
  const blockedSlots = slotStatuses.filter((slot) => !slot.availableForType);
  const selectedSlot = slotStatuses.find((slot) => slot.start === selectedStart) ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {availableSlots.length} available
          {blockedSlots.length ? ` | ${blockedSlots.length} blocked` : ""}
          {" | Max 5 patients per hour"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InfoPill label="Validation" value="Doctor schedule + existing bookings" />
        <InfoPill label="Conflict control" value="Clinic and Online share one slot pool" />
        <InfoPill
          label="Queue number"
          value={selectedSlot?.nextQueueNumber ? `Auto-assigned as #${selectedSlot.nextQueueNumber}` : "Shown after you pick a free slot"}
        />
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          Refreshing slot availability...
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {slotStatuses.map((slot) => {
          const isSelected = selectedStart === slot.start;
          const available = slot.availableForType;

          return (
            <button
              key={`${slot.start}-${slot.end}`}
              type="button"
              disabled={!available || disabled || loading}
              onClick={() => onSelect(slot.start)}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                isSelected
                  ? "border-teal-600 bg-teal-50 shadow-sm"
                  : available
                    ? "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50"
                    : "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <p className={`text-sm font-semibold ${
                isSelected ? "text-teal-700" : available ? "text-slate-900" : "text-slate-400"
              }`}>
                {formatRange(slot.start, slot.end)}
              </p>

              <div className="mt-2 flex items-center justify-between">
                <span className={`text-[11px] ${
                  isSelected ? "text-teal-600" : available ? "text-slate-500" : "text-slate-400"
                }`}>
                  {slot.activeType ? `${slot.activeType} active` : "Shared slot"}
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((dot) => (
                    <span
                      key={dot}
                      className={`h-1.5 w-1.5 rounded-full ${
                        dot <= slot.bookedCount
                          ? slot.bookedCount >= 5
                            ? "bg-red-400"
                            : "bg-teal-500"
                          : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <p className={`mt-2 text-[11px] ${
                available ? "text-slate-500" : "text-red-500"
              }`}>
                {available ? `Queue #${slot.nextQueueNumber}` : slot.reason}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

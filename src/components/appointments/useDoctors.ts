"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import { DOCTORS } from "@/src/lib/appointments";
import {
  CLINIC_CONSULTATION_HOURLY_RATE,
  ONLINE_CONSULTATION_HOURLY_RATE,
  normalizeConfiguredConsultationRate,
} from "@/src/lib/consultation-pricing";

const DEFAULT_DOCTOR = DOCTORS[0];

export type BookingDoctor = {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  consultation_fee_clinic: number;
  consultation_fee_online: number;
};

export function useDoctors() {
  const { accessToken } = useRole();
  const [doctors, setDoctors] = useState<BookingDoctor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setDoctors(
        DOCTORS.map((doctor) => ({
          id: doctor.id,
          slug: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          consultation_fee_clinic: CLINIC_CONSULTATION_HOURLY_RATE,
          consultation_fee_online: ONLINE_CONSULTATION_HOURLY_RATE,
        })),
      );
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    async function load() {
      try {
        const response = await fetch("/api/v2/doctors", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;

        const body = (await response.json()) as {
          doctors?: Array<{
            id: string;
            slug?: string;
            full_name?: string;
            name?: string;
            specialty?: string;
            consultation_fee_clinic?: number | string;
            consultation_fee_online?: number | string;
          }>;
        };

        const nextDoctors = (body.doctors ?? []).map((doctor) => ({
          id: doctor.slug ?? doctor.id,
          slug: doctor.slug ?? doctor.id,
          name: doctor.full_name ?? doctor.name ?? DEFAULT_DOCTOR?.name ?? "Dra. Chiara C. Punzalan M.D.",
          specialty: doctor.specialty ?? DEFAULT_DOCTOR?.specialty ?? "General Medicine",
          consultation_fee_clinic: normalizeConfiguredConsultationRate(Number(doctor.consultation_fee_clinic ?? 0)),
          consultation_fee_online: normalizeConfiguredConsultationRate(Number(doctor.consultation_fee_online ?? 0)),
        }));

        if (nextDoctors.length > 0) {
          setDoctors(nextDoctors);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    };
  }, [accessToken]);

  return { doctors, isLoading };
}

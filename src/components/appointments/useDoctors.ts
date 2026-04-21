"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import { DOCTORS } from "@/src/lib/appointments";

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
          consultation_fee_clinic: 0,
          consultation_fee_online: 0,
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
          name: doctor.full_name ?? doctor.name ?? "Assigned doctor",
          specialty: doctor.specialty ?? "General practice",
          consultation_fee_clinic: Number(doctor.consultation_fee_clinic ?? 0),
          consultation_fee_online: Number(doctor.consultation_fee_online ?? 0),
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

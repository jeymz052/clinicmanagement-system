"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import { type AppointmentRecord } from "@/src/lib/appointments";

export function useAppointments() {
  const { accessToken, isLoading: isAuthLoading } = useRole();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !accessToken) {
      return;
    }

    let active = true;

    async function loadAppointments() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/appointments", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Failed to load appointments (HTTP ${response.status})`);
        }

        const data = (await response.json()) as { appointments: AppointmentRecord[] };

        if (active) {
          setAppointments(data.appointments);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load appointments.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadAppointments();

    return () => {
      active = false;
    };
  }, [accessToken, isAuthLoading]);

  return {
    appointments,
    setAppointments,
    isLoading,
    error,
  };
}

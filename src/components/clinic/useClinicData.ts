"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type {
  ConsultationNote,
  DoctorUnavailability,
  PatientRecordItem,
  SystemSettings,
} from "@/src/lib/clinic";

export function useDoctorUnavailability() {
  return useProtectedFetch<DoctorUnavailability[]>("/api/unavailability", []);
}

export function usePatients() {
  return useProtectedFetch<PatientRecordItem[]>("/api/patients", []);
}

export function useConsultationNotes() {
  return useProtectedFetch<ConsultationNote[]>("/api/consultation-notes", []);
}

export function useSystemSettings() {
  return useProtectedFetch<SystemSettings | null>("/api/settings", null);
}

function useProtectedFetch<T>(url: string, initialValue: T) {
  const { accessToken, isLoading: isAuthLoading } = useRole();
  const [data, setData] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !accessToken) {
      return;
    }

    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const response = await fetch(url, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          throw new Error(`Failed to load ${url}`);
        }
        const payload = (await response.json()) as { data: T };
        if (active) {
          setData(payload.data);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : `Failed to load ${url}`);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [accessToken, isAuthLoading, url]);

  return { data, setData, isLoading, error };
}

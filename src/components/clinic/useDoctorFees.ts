"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";

export type DoctorFees = {
  clinic: number;
  online: number;
};

/**
 * Reads consultation fees for the currently-active doctor (slug = 'chiara-punzalan').
 * Falls back to the system_settings default if no doctor row is found.
 */
export function useDoctorFees(slug = "chiara-punzalan"): {
  fees: DoctorFees;
  isLoading: boolean;
} {
  const { accessToken, isLoading: authLoading } = useRole();
  const [fees, setFees] = useState<DoctorFees>({ clinic: 0, online: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/v2/doctors", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          doctors: Array<{
            consultation_fee_clinic: number | string;
            consultation_fee_online: number | string;
            slug?: string;
          }>;
        };
        const match =
          payload.doctors.find((d) => d.slug === slug) ??
          payload.doctors[0];
        if (match && active) {
          setFees({
            clinic: Number(match.consultation_fee_clinic ?? 0),
            online: Number(match.consultation_fee_online ?? 0),
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading, slug]);

  return { fees, isLoading: loading };
}

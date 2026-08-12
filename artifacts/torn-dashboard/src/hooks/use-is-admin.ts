import { useEffect, useState } from "react";

interface AdminStatus {
  isAdmin: boolean;
  isPrimary: boolean;
  loading: boolean;
}

// Asks the server whether the current API key belongs to an admin.
// Admin status lives in the database now, not hardcoded in the client.
export function useIsAdmin(apiKey: string | null): AdminStatus {
  const [status, setStatus] = useState<AdminStatus>({ isAdmin: false, isPrimary: false, loading: true });

  useEffect(() => {
    if (!apiKey) {
      setStatus({ isAdmin: false, isPrimary: false, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey }),
        });
        const body = (await res.json().catch(() => ({}))) as { isAdmin?: boolean; isPrimary?: boolean };
        if (!cancelled) setStatus({ isAdmin: !!body.isAdmin, isPrimary: !!body.isPrimary, loading: false });
      } catch {
        if (!cancelled) setStatus({ isAdmin: false, isPrimary: false, loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey]);

  return status;
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * useQueryCleanup
 * Removes specified transient query params from the URL via router.replace.
 * Does not remove unspecified params (e.g., returnUrl) to avoid breaking flows.
 *
 * Example:
 *   useQueryCleanup(["message", "error", "code", "token_hash", "token", "type"]);
 */
export function useQueryCleanup(paramsToRemove: string[], options?: { delayMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!searchParams) return;

    const hasAny = paramsToRemove.some((p) => searchParams.has(p));
    if (!hasAny) return;

    const doCleanup = () => {
      const newParams = new URLSearchParams(searchParams.toString());
      paramsToRemove.forEach((p) => newParams.delete(p));
      const queryString = newParams.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      // Use replace to avoid polluting history with transient params
      router.replace(newUrl);
    };

    if (options?.delayMs && options.delayMs > 0) {
      const t = setTimeout(doCleanup, options.delayMs);
      return () => clearTimeout(t);
    }

    doCleanup();
  // We intentionally depend only on stringified params so cleanup re-runs if URL changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router, searchParams?.toString()]);
}

export default useQueryCleanup;

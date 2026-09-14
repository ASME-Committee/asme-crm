import { createContext, useContext } from "react";
import type { Access } from "./access";

export const AccessContext = createContext<Access | null>(null);

export function useCurrentAccess(): Access {
  const ctx = useContext(AccessContext);
  if (!ctx) {
    throw new Error("useCurrentAccess must be used inside <AccessContext.Provider>");
  }
  return ctx;
}

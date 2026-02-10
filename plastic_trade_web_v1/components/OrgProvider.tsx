"use client";
import React from "react";
import { supabase } from "@/lib/supabase";
import { Organization } from "@/lib/types";

type OrgState = {
  org: Organization | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const OrgContext = React.createContext<OrgState>({
  org: null,
  loading: true,
  refresh: async () => {},
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = React.useState<Organization | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_org");
    if (error) {
      console.error(error);
      setOrg(null);
    } else {
      setOrg(data?.[0] ?? null);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    refresh();
  }, []);

  return <OrgContext.Provider value={{ org, loading, refresh }}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  return React.useContext(OrgContext);
}

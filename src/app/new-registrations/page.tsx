import { fetchSubscriberBrandMap } from "@/lib/sheets";
import NewRegistrationsView from "./NewRegistrationsView";

export const dynamic = "force-dynamic";

export default async function NewRegistrationsPage() {
  const brandLookup = await fetchSubscriberBrandMap();
  return (
    <NewRegistrationsView
      year={new Date().getFullYear()}
      brandLookup={brandLookup}
    />
  );
}

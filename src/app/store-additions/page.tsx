import { fetchSubscriberBrandMap } from "@/lib/sheets";
import StoreAdditionsView from "./StoreAdditionsView";

export const dynamic = "force-dynamic";

export default async function StoreAdditionsPage() {
  const brandLookup = await fetchSubscriberBrandMap();
  return (
    <StoreAdditionsView
      year={new Date().getFullYear()}
      brandLookup={brandLookup}
    />
  );
}

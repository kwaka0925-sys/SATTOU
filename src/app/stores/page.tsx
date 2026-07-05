import StoresView from "./StoresView";

export type StoreRow = {
  order: number;
  identifier: string;
  clientId: string;
  clientName: string;
  brand: string;
  url: string;
  templateInstalled: string;
  cancelled: string;
  creative: string;
  marketer: string;
  systemDelivery: string;
  legacyUser: string;
  since: string;
  hpbLinked: string;
  initialSheetUrl: string;
};

export default function StoresPage() {
  return <StoresView rows={[]} />;
}

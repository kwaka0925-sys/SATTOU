import StoreAdditionsView from "./StoreAdditionsView";

export default function StoreAdditionsPage() {
  return <StoreAdditionsView year={new Date().getFullYear()} />;
}

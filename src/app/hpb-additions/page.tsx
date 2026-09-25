import HpbAdditionsView from "./HpbAdditionsView";

export default function HpbAdditionsPage() {
  return <HpbAdditionsView year={new Date().getFullYear()} />;
}

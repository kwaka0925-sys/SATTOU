import ShareholderInvoicesView from "./ShareholderInvoicesView";

export default function ShareholderInvoicesPage() {
  return <ShareholderInvoicesView year={new Date().getFullYear()} />;
}

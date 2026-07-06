import NewRegistrationsView from "./NewRegistrationsView";

export default function NewRegistrationsPage() {
  return <NewRegistrationsView year={new Date().getFullYear()} />;
}

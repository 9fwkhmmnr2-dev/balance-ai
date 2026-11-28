import { redirect } from "next/navigation";

export default function OperationsPage() {
  redirect("/planificacion?section=acciones");
}

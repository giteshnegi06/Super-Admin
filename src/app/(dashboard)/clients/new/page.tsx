import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ClientForm } from "@/components/client-form";

export const dynamic = "force-dynamic";

export default function NewClientPage() {
  return (
    <>
      <PageHeader eyebrow="Onboarding" title="Add a new cafe" description="Creates the client record and provisions a dedicated Neon database" />
      <Card className="max-w-3xl"><CardBody><ClientForm /></CardBody></Card>
    </>
  );
}

import EditFarmClient from "./edit-farm-client";

export async function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default async function EditFarmPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditFarmClient farmId={id} />;
}

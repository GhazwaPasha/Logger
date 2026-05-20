import { redirect } from "next/navigation";

/** Legacy `/edit` URLs → canonical task editor route. */
export default async function EditTaskRedirectPage({
  params,
}: {
  params: Promise<{ workspaceId: string; taskId: string }>;
}) {
  const { workspaceId, taskId } = await params;
  redirect(`/${workspaceId}/work/task/${taskId}`);
}

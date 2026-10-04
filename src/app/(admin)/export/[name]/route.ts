import { requireAdmin } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { buildExport, isExportName } from "@/lib/export";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  await requireAdmin();
  const { name } = await params;
  if (!isExportName(name)) return new Response("Not found", { status: 404 });

  return new Response(await buildExport(name), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="turftab-${name}-${todayISO()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

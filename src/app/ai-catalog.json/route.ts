import { responderDescobertaPublica } from "@/lib/descoberta-publica-http";

export const dynamic = "force-dynamic";

export async function GET() {
  return responderDescobertaPublica("ai-catalog");
}

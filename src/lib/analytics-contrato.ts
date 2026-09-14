import { z } from "zod";

export const TIPOS_EVENTO_ANALYTICS = [
  "session_start", "page_view", "view_home", "view_category", "search", "view_item",
  "add_to_cart", "remove_from_cart", "view_cart", "coupon_apply", "begin_checkout",
  "checkout_contact", "checkout_shipping", "checkout_payment", "order_created",
  "payment_approved", "payment_refused", "purchase", "cart_abandoned",
] as const;

/** Contrato first-party v1. tenantId nunca faz parte da entrada do navegador. */
export const eventoAnalyticsV1 = z.object({
  eventId: z.string().regex(/^evt_[a-zA-Z0-9_-]{16,80}$/),
  version: z.literal(1),
  sessionId: z.string().regex(/^ses_[a-zA-Z0-9_-]{16,80}$/),
  event: z.enum(TIPOS_EVENTO_ANALYTICS),
  timestamp: z.string().datetime({ offset: true }),
  path: z.string().startsWith("/").max(500),
  referrer: z.string().url().max(1000).optional(),
  device: z.enum(["mobile", "tablet", "desktop"]),
  productId: z.string().max(100).optional(),
  variantId: z.string().max(100).optional(),
  categoryId: z.string().max(100).optional(),
  orderId: z.string().max(100).optional(),
  customerId: z.string().max(100).optional(),
  valueCentavos: z.number().int().nonnegative().optional(),
  quantity: z.number().int().positive().max(10_000).optional(),
  metadata: z.record(z.string(), z.union([z.string().max(500), z.number(), z.boolean(), z.null()])).optional(),
}).strict();

export type EventoAnalyticsV1 = z.infer<typeof eventoAnalyticsV1>;

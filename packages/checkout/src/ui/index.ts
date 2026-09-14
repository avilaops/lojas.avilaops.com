export { default as CheckoutScreen } from "./CheckoutScreen.tsx";
export type { CheckoutScreenProps } from "./CheckoutScreen.tsx";

// Componente específico do Mercado Pago. Fica aqui como opção, não como
// dependência: o CheckoutScreen não o importa, então quem usa outro provedor
// não carrega o SDK do MP no bundle.
export { default as MercadoPagoCardBrick } from "./MercadoPagoCardBrick.tsx";
export type { MercadoPagoCardBrickProps } from "./MercadoPagoCardBrick.tsx";

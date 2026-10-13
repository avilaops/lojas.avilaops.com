declare module "qrcode" {
  interface OpcoesQr {
    type?: "png" | "svg" | "utf8";
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    width?: number;
  }

  const qrcode: {
    toBuffer(texto: string, opcoes?: OpcoesQr): Promise<Buffer>;
  };

  export default qrcode;
}

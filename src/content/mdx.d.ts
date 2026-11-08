declare module "*.mdx" {
  import type { ComponentType } from "react";
  const MDXContent: ComponentType;
  export const capitulos: readonly { id: string; titulo: string }[];
  export default MDXContent;
}

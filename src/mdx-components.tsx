import type { MDXComponents } from "mdx/types";

/** Somente conteúdo MDX versionado no repositório é compilado. */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return { ...components };
}

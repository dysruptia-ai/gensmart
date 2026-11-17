/**
 * Minimal ambient types for @toon-format/toon (ESM only, `exports`-only package). With the
 * project's `moduleResolution: node` tsc cannot read the package's own index.d.mts, so only the
 * function the API uses is declared here. Runtime: Node ≥ 22 loads it through require(esm).
 */
declare module '@toon-format/toon' {
  export function decode(
    input: string,
    options?: { strict?: boolean; indent?: number; expandPaths?: 'off' | 'safe' }
  ): unknown;
}

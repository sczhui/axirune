/**
 * Stable capability names used by the standard host adapter ABI.
 *
 * This module deliberately has no Node.js imports so the compiler, capsule
 * verifier, and browser playground can derive the same authority manifest.
 */
export const HOST_CAPABILITIES = {
  fileRead: "host.fs.read",
  fileWrite: "host.fs.write",
  networkFetch: "host.net.fetch",
} as const;


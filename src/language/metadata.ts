export const LANGUAGE_NAME = "Axirune";
export const LANGUAGE_VERSION = "0.4.0-alpha.3";
export const LANGUAGE_SLUG = "axirune";
export const LANGUAGE_EXTENSION = ".axi";
export const LEGACY_LANGUAGE_EXTENSIONS = [".nxl"] as const;
export const SUPPORTED_LANGUAGE_EXTENSIONS = [
  LANGUAGE_EXTENSION,
  ...LEGACY_LANGUAGE_EXTENSIONS,
] as const;
export const LANGUAGE_MANIFEST = "axirune.pack";
export const LANGUAGE_LOCKFILE = "axirune.lock";
export const LANGUAGE_TAGLINE = "Make intent axiomatic. Bound every effect.";
export const SUPPORTED_EDITIONS = [1, 2] as const;
export const IR_VERSION = "axirune-ir/0.3" as const;
export const CAPSULE_SCHEMA = "axirune-capsule/1" as const;
export const CAPSULE_EXTENSION = ".axc" as const;
export const RUNTIME_ABI = "axirune-runtime/1" as const;
export const KERNEL_ABI = "axirune-kernel/0.3" as const;

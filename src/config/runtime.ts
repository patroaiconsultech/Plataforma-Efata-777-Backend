import {
  resolvePublicConfigValue,
  type PublicConfigKey,
} from "../../public-config.js";

type RuntimeConfig = Record<string, unknown>;

function runtimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") return {};
  const scoped = window as typeof window & {
    __ORKIO_ENV__?: RuntimeConfig;
  };
  return scoped.__ORKIO_ENV__ || {};
}

export function publicEnv(name: PublicConfigKey): string {
  const resolved = resolvePublicConfigValue(
    name,
    runtimeConfig(),
    import.meta.env as Record<string, unknown>,
  );
  if (!resolved.ok) {
    // Never log the value itself; only key/source/reason.
    console.error(
      `[ORKIO public config] invalid ${name} from ${resolved.source}: ${resolved.reason || "INVALID"}`,
    );
    return "";
  }
  return resolved.value;
}

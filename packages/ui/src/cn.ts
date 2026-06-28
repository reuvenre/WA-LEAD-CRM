type ClassDict = Record<string, boolean | null | undefined>;
export type ClassValue = string | number | null | undefined | false | ClassValue[] | ClassDict;

// Dependency-free class-name join (clsx-compatible subset). Kept zero-dependency
// so the library can be consumed from source (transpilePackages) without the
// consumer needing to resolve any of its node_modules.
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const push = (v: ClassValue): void => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach(push);
    } else if (typeof v === 'object') {
      for (const key in v) if (v[key]) out.push(key);
    }
  };
  inputs.forEach(push);
  return out.join(' ');
}

interface PermissionLike {
  perm_name: string;
  parent: string;
  required_auth?: { keys?: unknown[]; accounts?: unknown[]; waits?: unknown[] };
}

export interface PermissionRow<T extends PermissionLike> {
  permission: T;
  depth: number;
  /** "2 keys", "1 key, 1 account": who can sign for this permission. */
  signers: string;
}

function signersOf(permission: PermissionLike): string {
  const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");
  const auth = permission.required_auth;
  const parts = [
    count(auth?.keys?.length ?? 0, "key", "keys"),
    count(auth?.accounts?.length ?? 0, "account", "accounts"),
    count(auth?.waits?.length ?? 0, "delay", "delays")
  ].filter(Boolean);
  return parts.join(", ") || "no signers";
}

/**
 * The permission hierarchy as rows in reading order (owner, then each child under its parent), with each row's
 * depth. Rendering rows instead of nested boxes keeps every key in one column; depth only indents the name.
 */
export function permissionRows<T extends PermissionLike>(permissions: readonly T[]): PermissionRow<T>[] {
  const rank = (name: string) => (name === "owner" ? 0 : name === "active" ? 1 : 2);
  const byParent = new Map<string, T[]>();
  for (const permission of permissions) {
    const siblings = byParent.get(permission.parent) ?? [];
    siblings.push(permission);
    byParent.set(permission.parent, siblings);
  }
  const names = new Set(permissions.map(permission => permission.perm_name));
  const rows: PermissionRow<T>[] = [];
  const seen = new Set<string>();
  const visit = (permission: T, depth: number) => {
    if (seen.has(permission.perm_name)) return;
    seen.add(permission.perm_name);
    rows.push({ permission, depth, signers: signersOf(permission) });
    const children = [...(byParent.get(permission.perm_name) ?? [])].sort((a, b) => rank(a.perm_name) - rank(b.perm_name));
    for (const child of children) visit(child, depth + 1);
  };
  // Roots are permissions whose parent is not on this account (normally owner, whose parent is empty).
  const roots = permissions.filter(permission => !names.has(permission.parent)).sort((a, b) => rank(a.perm_name) - rank(b.perm_name));
  for (const root of roots) visit(root, 0);
  for (const permission of permissions) visit(permission, 0);
  return rows;
}

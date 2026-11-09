import { permissionRows } from "./permission-rows";

const perm = (perm_name: string, parent: string, keys = 1, accounts = 0) => ({
  perm_name,
  parent,
  required_auth: { keys: Array(keys).fill({}), accounts: Array(accounts).fill({}), waits: [] }
});

describe("permissionRows", () => {
  it("orders the hierarchy owner first, each child under its parent", () => {
    const rows = permissionRows([perm("claim", "active"), perm("active", "owner", 2), perm("owner", "", 2), perm("vote", "active", 0, 1)]);
    expect(rows.map(row => [row.permission.perm_name, row.depth, row.signers])).toEqual([
      ["owner", 0, "2 keys"],
      ["active", 1, "2 keys"],
      ["claim", 2, "1 key"],
      ["vote", 2, "1 account"]
    ]);
  });

  it("keeps permissions whose parent is missing, at the top level", () => {
    const rows = permissionRows([perm("orphan", "gone", 0), perm("owner", "")]);
    expect(rows.map(row => [row.permission.perm_name, row.depth, row.signers])).toEqual([
      ["owner", 0, "1 key"],
      ["orphan", 0, "no signers"]
    ]);
  });
});

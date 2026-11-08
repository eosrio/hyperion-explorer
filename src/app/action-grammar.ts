/**
 * Action grammar: turn well-known Antelope actions into short, typed lines a person can read at a glance
 * ("alice → bob · 12.5000 EOS · "rent"). Unknown actions, or known ones whose data does not have the expected
 * shape, return null and keep the raw key/value view. Rules never guess: every field they show is checked first.
 */

export type GrammarPart =
  | { kind: "account"; name: string }
  | { kind: "permission"; actor: string; permission: string }
  | { kind: "word"; text: string }
  | { kind: "arrow" }
  | { kind: "amount"; asset: ParsedAsset }
  | { kind: "memo"; text: string }
  | { kind: "code"; text: string }
  | { kind: "key"; key: string }
  | { kind: "hash"; label: string; value: string }
  | { kind: "text"; text: string };

export type GrammarLine = GrammarPart[];

export interface ParsedAsset {
  /** Integer digits with thousands separators, sign included ("-39,151"). */
  whole: string;
  /** Fraction including the decimal point (".475694444"), or "" for zero-precision assets. */
  fraction: string;
  symbol: string;
}

const NAME = /^[a-z1-5.]{1,13}$/;
const ASSET = /^(-?)(\d+)(\.\d+)? ([A-Z]{1,7})$/;
/** Longest list of keys, accounts or producers shown before the rest is summarised as "+N more". */
const LIST_LIMIT = 6;

export function parseAsset(value: unknown): ParsedAsset | null {
  if (typeof value !== "string") return null;
  const match = ASSET.exec(value.trim());
  if (!match) return null;
  const [, sign, digits, fraction = "", symbol] = match;
  return { whole: sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ","), fraction, symbol };
}

const isName = (value: unknown): value is string => typeof value === "string" && NAME.test(value);
const isString = (value: unknown): value is string => typeof value === "string";
const account = (name: string): GrammarPart => ({ kind: "account", name });
const word = (text: string): GrammarPart => ({ kind: "word", text });
const amount = (asset: ParsedAsset): GrammarPart => ({ kind: "amount", asset });
const memoLine = (memo: unknown): GrammarLine[] => (isString(memo) && memo.trim() ? [[{ kind: "memo", text: memo }]] : []);
const more = (total: number): GrammarLine[] => (total > LIST_LIMIT ? [[word(`+${(total - LIST_LIMIT).toLocaleString("en-US")} more`)]] : []);

function tokenRule(name: string, data: Record<string, unknown>): GrammarLine[] | null {
  const quantity = parseAsset(data["quantity"]);
  if (!quantity) return null;
  if (name === "transfer" && isName(data["from"]) && isName(data["to"])) {
    return [[account(data["from"]), { kind: "arrow" }, account(data["to"])], [amount(quantity)], ...memoLine(data["memo"])];
  }
  if (name === "issue" && isName(data["to"])) {
    return [[word("issued"), amount(quantity), word("to"), account(data["to"])], ...memoLine(data["memo"])];
  }
  if (name === "retire") return [[word("retired"), amount(quantity)], ...memoLine(data["memo"])];
  return null;
}

function authorityLines(auth: unknown): GrammarLine[] | null {
  if (!auth || typeof auth !== "object") return null;
  const { threshold, keys = [], accounts = [], waits = [] } = auth as Record<string, unknown>;
  if (typeof threshold !== "number" || !Array.isArray(keys) || !Array.isArray(accounts) || !Array.isArray(waits)) return null;
  const entries: GrammarLine[] = [];
  for (const entry of keys) {
    if (!entry || typeof entry.key !== "string" || typeof entry.weight !== "number") return null;
    entries.push([{ kind: "key", key: entry.key }, word(`weight ${entry.weight}`)]);
  }
  for (const entry of accounts) {
    const actor = entry?.permission?.actor;
    const permission = entry?.permission?.permission;
    if (!isName(actor) || !isName(permission) || typeof entry.weight !== "number") return null;
    entries.push([{ kind: "permission", actor, permission }, word(`weight ${entry.weight}`)]);
  }
  for (const entry of waits) {
    if (!entry || typeof entry.wait_sec !== "number" || typeof entry.weight !== "number") return null;
    entries.push([word(`wait ${entry.wait_sec.toLocaleString("en-US")} s`), word(`weight ${entry.weight}`)]);
  }
  const total = entries.length;
  return [[word(`requires weight ${threshold} from ${total} ${total === 1 ? "signer" : "signers"}`)], ...entries.slice(0, LIST_LIMIT), ...more(total)];
}

function systemRule(name: string, data: Record<string, unknown>): GrammarLine[] | null {
  switch (name) {
    case "newaccount": {
      const created = data["name"] ?? data["newact"];
      return isName(data["creator"]) && isName(created) ? [[account(data["creator"]), word("created"), account(created)]] : null;
    }
    case "updateauth": {
      if (!isName(data["account"]) || !isName(data["permission"])) return null;
      const authority = authorityLines(data["auth"]);
      if (!authority) return null;
      const head: GrammarLine = [{ kind: "permission", actor: data["account"], permission: data["permission"] }];
      if (isName(data["parent"])) head.push(word("under"), { kind: "permission", actor: data["account"], permission: data["parent"] });
      return [head, ...authority];
    }
    case "deleteauth":
      return isName(data["account"]) && isName(data["permission"])
        ? [[word("deleted"), { kind: "permission", actor: data["account"], permission: data["permission"] }]]
        : null;
    case "linkauth":
      return isName(data["account"]) && isName(data["code"]) && isName(data["requirement"]) && isString(data["type"])
        ? [
            [{ kind: "code", text: data["type"] ? `${data["code"]}::${data["type"]}` : `${data["code"]}::*` }, word("now requires"),
              { kind: "permission", actor: data["account"], permission: data["requirement"] }]
          ]
        : null;
    case "unlinkauth":
      return isName(data["account"]) && isName(data["code"]) && isString(data["type"])
        ? [[account(data["account"]), word("unlinked"), { kind: "code", text: data["type"] ? `${data["code"]}::${data["type"]}` : `${data["code"]}::*` }]]
        : null;
    case "delegatebw":
    case "undelegatebw": {
      const stake = name === "delegatebw";
      const cpu = parseAsset(data[stake ? "stake_cpu_quantity" : "unstake_cpu_quantity"]);
      const net = parseAsset(data[stake ? "stake_net_quantity" : "unstake_net_quantity"]);
      if (!isName(data["from"]) || !isName(data["receiver"]) || !cpu || !net) return null;
      const lines: GrammarLine[] = [
        [account(data["from"]), word(stake ? "staked to" : "unstaked from"), account(data["receiver"])],
        [amount(cpu), word("CPU"), word("·"), amount(net), word("NET")]
      ];
      if (stake && data["transfer"] === true) lines.push([word("ownership transferred to the receiver")]);
      return lines;
    }
    case "buyram": {
      const quant = parseAsset(data["quant"]);
      return isName(data["payer"]) && isName(data["receiver"]) && quant
        ? [[account(data["payer"]), word("bought RAM for"), account(data["receiver"])], [amount(quant)]]
        : null;
    }
    case "buyrambytes":
      return isName(data["payer"]) && isName(data["receiver"]) && typeof data["bytes"] === "number"
        ? [[account(data["payer"]), word("bought RAM for"), account(data["receiver"])], [word(`${data["bytes"].toLocaleString("en-US")} bytes`)]]
        : null;
    case "sellram":
      return isName(data["account"]) && typeof data["bytes"] === "number"
        ? [[account(data["account"]), word(`sold ${data["bytes"].toLocaleString("en-US")} bytes of RAM`)]]
        : null;
    case "regproducer": {
      if (!isName(data["producer"])) return null;
      const key = data["producer_key"];
      const lines: GrammarLine[] = [[account(data["producer"]), word("registered as a block producer")]];
      if (isString(key) && key) lines.push([word("signing key"), { kind: "key", key }]);
      if (isString(data["url"]) && data["url"].trim()) lines.push([word("website"), { kind: "text", text: data["url"].trim() }]);
      return lines;
    }
    case "unregprod":
      return isName(data["producer"]) ? [[account(data["producer"]), word("unregistered as a block producer")]] : null;
    case "regfinkey": {
      const key = data["finalizer_key"];
      const proof = data["proof_of_possession"];
      if (!isName(data["finalizer_name"]) || !isString(key) || !key || !isString(proof) || !proof) return null;
      return [
        [account(data["finalizer_name"]), word("registered a finalizer key")],
        [{ kind: "hash", label: "finalizer key", value: key }],
        [word("proof of possession"), { kind: "hash", label: "proof of possession", value: proof }]
      ];
    }
    case "actfinkey":
    case "delfinkey": {
      const key = data["finalizer_key"];
      if (!isName(data["finalizer_name"]) || !isString(key) || !key) return null;
      return [
        [account(data["finalizer_name"]), word(name === "actfinkey" ? "activated a finalizer key" : "deleted a finalizer key")],
        [{ kind: "hash", label: "finalizer key", value: key }]
      ];
    }
    case "voteproducer": {
      if (!isName(data["voter"]) || !Array.isArray(data["producers"])) return null;
      if (isName(data["proxy"])) return [[account(data["voter"]), word("votes through proxy"), account(data["proxy"])]];
      const producers = data["producers"];
      if (!producers.every(isName)) return null;
      if (producers.length === 0) return [[account(data["voter"]), word("cleared their producer votes")]];
      return [
        [account(data["voter"]), word(`voted for ${producers.length} ${producers.length === 1 ? "producer" : "producers"}`)],
        producers.slice(0, LIST_LIMIT).map(account),
        ...more(producers.length)
      ];
    }
    default:
      return null;
  }
}

/**
 * Read an action as grammar lines, or null when it should stay as raw data. Token actions are recognised by
 * their data on any contract; account and resource actions only on the chain's system contract.
 */
export function describeAction(contract: unknown, name: unknown, data: unknown, systemContract: string): GrammarLine[] | null {
  if (!isString(contract) || !isString(name) || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const fields = data as Record<string, unknown>;
  if (name === "transfer" || name === "issue" || name === "retire") return tokenRule(name, fields);
  if (contract === systemContract) return systemRule(name, fields);
  return null;
}

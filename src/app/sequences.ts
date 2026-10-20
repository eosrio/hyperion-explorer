declare const sequenceBrand: unique symbol;
/** Canonical uint64 text. BigInt is used only while computing, never in JSON state. */
export type Sequence = string & { readonly [sequenceBrand]: true };
const UINT64_MAX = "18446744073709551615";

export function sequence(value: unknown, field = "sequence"): Sequence {
  // Older APIs may return numbers, but an unsafe Number has already lost its identity.
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) value = String(value);
  if (
    typeof value !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(value) ||
    value.length > UINT64_MAX.length ||
    (value.length === UINT64_MAX.length && value > UINT64_MAX)
  ) {
    throw new Error(
      `Hyperion returned an invalid ${field}. An exact uint64 decimal string is required; unsafe numeric values cannot be recovered.`
    );
  }
  return value as Sequence;
}

export function previousSequence(value: Sequence): Sequence | null {
  return value === "0" ? null : ((BigInt(value) - 1n).toString() as Sequence);
}

export function nextSequence(value: Sequence): Sequence | null {
  return value === UINT64_MAX ? null : ((BigInt(value) + 1n).toString() as Sequence);
}

export function compareSequences(a: Sequence, b: Sequence): number {
  return a.length === b.length ? (a < b ? -1 : a > b ? 1 : 0) : a.length < b.length ? -1 : 1;
}

export interface HistoryAction {
  global_sequence: Sequence;
  block_num: number;
  trx_id: string;
  act: any;
  receiver?: string;
  recv_sequence?: Sequence;
  [key: string]: any;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Hyperion returned invalid ${field}.`);
  return value as Record<string, unknown>;
}

function metadata(value: unknown, path: string): Record<string, unknown> {
  const output = { ...record(value, path) };
  for (const key of ["global_sequence", "recv_sequence", "receiver_sequence"]) {
    if (key in output) {
      output[key] = sequence(output[key], `${path}.${key}`);
      if (key === "global_sequence" && output[key] === "0")
        throw new Error(`Hyperion returned a zero ${path}.${key} for a committed action.`);
    }
  }
  if ("auth_sequence" in output) {
    if (!Array.isArray(output["auth_sequence"])) throw new Error(`Hyperion returned invalid ${path}.auth_sequence.`);
    output["auth_sequence"] = output["auth_sequence"].map((entry, index) => {
      const field = `${path}.auth_sequence[${index}]`;
      if (Array.isArray(entry)) {
        if (entry.length !== 2 || typeof entry[0] !== "string") throw new Error(`Hyperion returned invalid ${field}.`);
        return [entry[0], sequence(entry[1], field)];
      }
      const auth = record(entry, field);
      if (typeof auth["account"] !== "string") throw new Error(`Hyperion returned invalid ${field}.account.`);
      return { ...auth, sequence: sequence(auth["sequence"], field) };
    });
  }
  if ("receipt" in output) output["receipt"] = metadata(output["receipt"], `${path}.receipt`);
  if ("receipts" in output) {
    if (!Array.isArray(output["receipts"])) throw new Error(`Hyperion returned invalid ${path}.receipts.`);
    output["receipts"] = output["receipts"].map((receipt, index) => metadata(receipt, `${path}.receipts[${index}]`));
  }
  // Only protocol metadata is normalized; act.data belongs to the contract ABI.
  return output;
}

export function historyAction(value: unknown): HistoryAction {
  const action = metadata(value, "action");
  action["global_sequence"] = sequence(action["global_sequence"], "action.global_sequence");
  return action as unknown as HistoryAction;
}

export function historyResponse<T extends { actions: unknown[] }>(response: T): Omit<T, "actions"> & { actions: HistoryAction[] } {
  if (!response || !Array.isArray(response.actions)) throw new Error("Hyperion returned an invalid action history response.");
  return { ...response, actions: response.actions.map(historyAction) };
}

/** Merge overlapping history/stream pages without rounding identities or sorting text lexically. */
export function mergeHistory(...sources: HistoryAction[][]): HistoryAction[] {
  const actions = new Map<string, HistoryAction>();
  for (const action of sources.flat()) {
    const key = JSON.stringify([action.global_sequence, action.trx_id, action.receiver, action.recv_sequence]);
    if (!actions.has(key)) actions.set(key, action);
  }
  return [...actions.values()].sort((a, b) => compareSequences(b.global_sequence, a.global_sequence));
}

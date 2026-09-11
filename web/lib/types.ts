export type Receipt = {
  seq: number;
  ts: number;
  action: string;
  payload: Record<string, unknown>;
};

export type PendingItem = {
  id: string;
  name: string;
  reason: { to?: string; subject?: string; body?: string };
};

export type State = {
  ok: boolean;
  org: string;
  pending: PendingItem[];
  receipts: Receipt[];
  counts: {
    sent: number;
    denied: number;
    blocked: number;
    awaiting: number;
    total_receipts: number;
    chain_ok: boolean;
  };
  error?: string;
};

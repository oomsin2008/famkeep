export interface LineActionState {
  ok: boolean;
  error: string | null;
}

export const LINE_ACTION_IDLE: LineActionState = { ok: false, error: null };

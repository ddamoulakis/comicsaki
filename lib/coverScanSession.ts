import type { CoverEdition, CoverLookupResult, CoverMatch } from '@/types/coverLookup';

export type SelectedCoverPick = {
  match: CoverMatch;
  edition: CoverEdition;
  photoUri: string;
};

export type CoverConfirmData = {
  photoUri: string;
  title: string;
  issue: string;
  publisher: string;
  year?: string;
  notes?: string;
};

type CoverScanSession = {
  photoUri: string | null;
  result: CoverLookupResult | null;
  selected: SelectedCoverPick | null;
  confirm: CoverConfirmData | null;
};

let session: CoverScanSession = {
  photoUri: null,
  result: null,
  selected: null,
  confirm: null,
};

let resetRequested = false;

type CoverScanListener = () => void;
const listeners = new Set<CoverScanListener>();

function notifyCoverScan() {
  listeners.forEach((fn) => fn());
}

export function subscribeCoverScanSession(listener: CoverScanListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCoverPhoto(uri: string) {
  session = { ...session, photoUri: uri, result: null, selected: null, confirm: null };
  notifyCoverScan();
}

export function setCoverConfirm(data: CoverConfirmData) {
  session = { ...session, confirm: data };
}

export function getCoverConfirm(): CoverConfirmData | null {
  return session.confirm;
}

export function clearCoverConfirm() {
  session = { ...session, confirm: null };
}

export function setCoverLookupResult(result: CoverLookupResult) {
  session = { ...session, photoUri: result.photoUri || session.photoUri, result, selected: null };
  notifyCoverScan();
}

export function setSelectedCoverPick(pick: SelectedCoverPick) {
  session = { ...session, selected: pick };
}

export function getCoverScanSession() {
  return session;
}

export function clearCoverScanSession() {
  session = { photoUri: null, result: null, selected: null, confirm: null };
  notifyCoverScan();
}

/** Ask the cover scanner screen to reset camera state on next focus (web SPA navigation). */
export function requestCoverScanReset() {
  resetRequested = true;
  clearCoverScanSession();
}

export function consumeCoverScanReset(): boolean {
  if (!resetRequested) return false;
  resetRequested = false;
  return true;
}

export function consumeSelectedCoverPick(): SelectedCoverPick | null {
  const pick = session.selected;
  session = { ...session, selected: null };
  return pick;
}

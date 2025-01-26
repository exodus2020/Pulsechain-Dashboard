import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { defaultSettings } from "../config/settings";

export const appSettingsAtom = atomWithStorage('app-settings', defaultSettings);
export const dappModalAtom = atom(false);
export const tokensModalAtom = atom(false);
export const liquiditySearchModalAtom = atom(false);
export const walletsModalAtom = atom(false);
export const settingsModalAtom = atom(false);
export const deleteDataModalAtom = atom(false);
export const tokenModalAtom = atom(null);
export const liquidityPoolModalAtom = atom(null);
export const iframeSrcAtom = atom(null);
export const expandedAtom = atom(true);
export const serverStatusAtom = atom({});

export const pricePairsAtom = atom({});
export const appPageAtom = atom('')

export const keyAtom = atom(null);
export const toastAtom = atom({ message: '', show: false, messages: [], nextId: 0 }) 

export const urlsFetchedAtom = atom(false)

export const hiddenWalletsAtom = atom([])
export const hideZeroValueAtom = atomWithStorage('hide-zero-value', false)
export const hideHexMinersAtom = atomWithStorage('hide-hex-miners', false)
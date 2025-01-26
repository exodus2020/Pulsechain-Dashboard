import { useAtom } from "jotai"
import { appPageAtom, dappModalAtom, settingsModalAtom, tokenModalAtom, tokensModalAtom, walletsModalAtom } from "../store"

export function useModals () {
    const [ appPage, setAppPage ] = useAtom(appPageAtom)

    const [ dappModal, setDappModal ] = useAtom(dappModalAtom)
    const [ tokensModal, setTokensModal ] = useAtom(tokensModalAtom)
    const [ singleTokenModal, setSingleTokenModal ] = useAtom(tokenModalAtom)
    const [ walletsModal, setWalletModal ] = useAtom(walletsModalAtom)
    const [ settingsModal, setSettingsModal ] = useAtom(settingsModalAtom)

    const setModal = (type, value) => {
        if (type == 'wallets') {
            setWalletModal(value)
        } else if (type == 'dapps') {
            setDappModal(value)
        } else if (type == 'token') {
            setSingleTokenModal(value)
        } else if (type == 'tokens') {
            setTokensModal(value)
        } else if (type == 'settings') {
            setSettingsModal(value)
        } else if (type == 'to_home') {
            setAppPage('')
        } else if (type == 'to_activities') {
            setAppPage('activities')
        }
    }

    return {
        setModal,
        // setDappModal,
        // setTokensModal,
        // setSingleTokenModal,
        // setWalletModal
    }
}
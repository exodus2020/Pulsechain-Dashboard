import { useAtom } from "jotai"
import { toastAtom } from "../store"
import { copyToClipboard } from "../lib/utils"

export const useCopyToClipboard = () => {
    const [ toast, setToast] = useAtom(toastAtom)

    const copyTextToClipboard = async (text, successMessage, errorMessage) => {
        const success = await copyToClipboard(text)
        if(success && successMessage) setToast(prev => ({
            messages: [...prev.messages, { id: prev.nextId, text: successMessage }],
            nextId: prev.nextId + 1
        }))
        else if(errorMessage) setToast(prev => ({
            messages: [...prev.messages, { id: prev.nextId, text: errorMessage }],
            nextId: prev.nextId + 1
        }))
    }

    return { copyTextToClipboard }
}
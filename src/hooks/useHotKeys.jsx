import { useEffect, useState } from 'react'

export default function useHotKeys() {
    const [ mode, setMode ] = useState(false)

    const toggleMode = () => {
        window.electron.toggleMode(150, 550)
        setMode(prev => !prev)
    }

    return { mode, toggleMode }
}
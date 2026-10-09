// AppContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { defaultTokenInformation, fetchTokenList } from '../lib/tokens';
import ImgQuestion from "../icons/question.png";
import { shortenString } from '../lib/string';
import { appSettingsAtom, hiddenWalletsAtom, keyAtom, urlsFetchedAtom } from '../store';
import { useAtom } from 'jotai';
import { decryptWithHashedKey, encryptWithHashedKey } from '../lib/crypto';
import { defaultSettings, migrateSettings } from '../config/settings';
import { tokenref } from "../config/tokenref.js";
import defaultMarket from "../config/market.json";

export const AppContext = createContext({});

export const defaultCommunityDapps = {
    url: 'https://gitlab.com/pulsechain-lunagray/pulsechain-dashboard/-/raw/main/src/config/market.json?ref_type=heads', 
    data: defaultMarket,
    updated: new Date().getTime()
}

const defaultContext = {
    watchlist: {},
    lpWatchlist: {},
    imageRef: {},
    wallets: {},
    communityDapps: [defaultCommunityDapps],
    settings: defaultSettings,
    aliases: {}
}

const BROWSER_CONFIG_KEY = 'pulsechain-dashboard-config'
const BROWSER_HIDDEN_TOKENS_KEY = 'pulsechain-dashboard-hidden-tokens-v1'

const readBrowserHiddenTokens = () => {
    try {
        const value = JSON.parse(window.localStorage.getItem(BROWSER_HIDDEN_TOKENS_KEY) || '{}')
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
    } catch { return {} }
}

const persistBrowserHiddenTokens = (hiddenTokens) => {
    try { window.localStorage.setItem(BROWSER_HIDDEN_TOKENS_KEY, JSON.stringify(hiddenTokens || {})) }
    catch (error) { console.warn('Failed to persist hidden token preferences:', error) }
}


const isBrowserMode = () => !window?.electron?.loadFile

const browserLoadConfig = () => {
    try {
        return window.localStorage.getItem(BROWSER_CONFIG_KEY)
    } catch (err) {
        console.error('Failed to read browser config:', err)
        return null
    }
}

const browserSaveConfig = (value) => {
    try {
        window.localStorage.setItem(BROWSER_CONFIG_KEY, value)
        return true
    } catch (err) {
        console.error('Failed to save browser config:', err)
        return false
    }
}

const browserDeleteConfig = () => {
    try {
        window.localStorage.removeItem(BROWSER_CONFIG_KEY)
        return true
    } catch (err) {
        console.error('Failed to delete browser config:', err)
        return false
    }
}

export const initData = async (key) => {
    const dataToSave = JSON.stringify(defaultContext)
    const encrypted = key ? await encryptWithHashedKey(key, dataToSave) : dataToSave
    const saved = isBrowserMode()
        ? browserSaveConfig(encrypted)
        : await window.electron.saveFile('config.json', encrypted)
    return saved
}

export const isKeyCorrect = async (key) => {
    const response = isBrowserMode()
        ? browserLoadConfig()
        : await window.electron.loadFile('config.json')
    if (response) {
        try {
            const decrypted = await decryptWithHashedKey(key, response)
            return true
        } catch {
            // failed to parse the JSON - issue w/ file 
            return false
        }
    } else {
        return false
    }
}

// Context provider component
export const AppContextProvider = ({ children }) => {
    const [ key, setKey ] = useAtom(keyAtom)
    const [, setSettings] = useAtom(appSettingsAtom)

    const [initialized, setInit] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState(undefined);
    const [update, setUpdate] = useState(0);
    const [hiddenWallets, setHiddenWallets] = useAtom(hiddenWalletsAtom)
    const [urlsFetched, setUrlsFetched] = useAtom(urlsFetchedAtom)

    const resetSingleSetting = (item, newValue) => {
        if (!data) return
        
        setData(prev => {
            const newData = {...prev, settings: { ...(prev?.settings ?? {}), [item]: newValue}}
            saveData(newData)
            return newData
        })
    }

    //#region Helper Functions
    const saveData = async (saveData, newKey) => {
        if ('imageRef' in saveData) {
            delete saveData.imageRef
        }
        if ('imgRef' in saveData) {
            delete saveData.imgRef
        }
        const dataToSave = JSON.stringify(saveData)
        if (newKey || newKey === '') {
            const encrypted = newKey === '' ? dataToSave : await encryptWithHashedKey(newKey, dataToSave)
            const saved = isBrowserMode()
                ? browserSaveConfig(encrypted)
                : await window.electron.saveFile('config.json', encrypted)
            setKey(newKey)
        } else {
            const encrypted = key ? await encryptWithHashedKey(key, dataToSave) : dataToSave
            const saved = isBrowserMode()
                ? browserSaveConfig(encrypted)
                : await window.electron.saveFile('config.json', encrypted)
        }
        
    }

    const loadDataUnencrypted = async (fileName) => {
        const response = await window.electron.loadFile(`${fileName}.json`)
        if (response) {
            try {
                setData(JSON.parse(response ?? {}))
                setUpdate(prev => prev + 1)
            } catch (err) {
                console.error('Failed to parse unencrypted file:', err)
            }
            
        } else {

        }

        setUpdate(1)
    }

    const saveDataUnencrypted = async (saveData, fileName) => {
        if (fileName == 'config') return

        // v2.4.3 cleanup: tokenRef is a large, rebuildable image cache. In browser
        // mode it can exceed the origin's localStorage quota and is not needed for
        // persistence because it is fetched again when required. Electron can still
        // keep tokenRef.json on disk as before.
        if (isBrowserMode() && fileName === 'tokenRef') return

        const dataToSave = JSON.stringify(saveData)

        // V196: the localhost/Vite test renderer does not have Electron's preload
        // bridge. Persist auxiliary JSON in localStorage there instead of calling
        // window.electron.saveFile and generating unhandled promise rejections.
        if (isBrowserMode()) {
            try {
                window.localStorage.setItem(`pulsechain-dashboard-${fileName}`, dataToSave)
            } catch (err) {
                console.warn(`Failed to save browser ${fileName} cache:`, err)
            }
            return
        }

        await window.electron.saveFile(`${fileName}.json`, dataToSave)
    }

    const saveNewKey = async (newKey) => {
        saveData(data, newKey)
    }

    const eraseData = async () => {
        try {
            // Remove the persisted app config first. Electron stores this separately
            // from renderer web storage, so both layers must be cleared.
            if (isBrowserMode()) {
                browserDeleteConfig()
            } else {
                await window.electron.deleteFile('config.json')
            }

            // DCA/P&L/history caches live in renderer localStorage in BOTH the web
            // build and Electron. Leaving these behind makes a freshly-added wallet
            // appear to calculate instantly from stale results.
            try { window.localStorage.clear() } catch (err) { console.warn('Could not clear localStorage:', err) }
            try { window.sessionStorage.clear() } catch (err) { console.warn('Could not clear sessionStorage:', err) }

            // Clear the app IndexedDB store as well. This is mainly used by the web
            // fallback, but clearing it here keeps "Erase All Data" deterministic.
            try {
                await new Promise((resolve) => {
                    const request = window.indexedDB?.deleteDatabase?.('plsdashboard')
                    if (!request) return resolve()
                    request.onsuccess = () => resolve()
                    request.onerror = () => resolve()
                    request.onblocked = () => resolve()
                })
            } catch (err) {
                console.warn('Could not clear IndexedDB:', err)
            }

            // Remove any browser Cache Storage entries created for this origin.
            try {
                if (window.caches?.keys) {
                    const names = await window.caches.keys()
                    await Promise.all(names.map(name => window.caches.delete(name)))
                }
            } catch (err) {
                console.warn('Could not clear Cache Storage:', err)
            }

            setData(defaultContext)
            setUpdate(prev => prev + 1)
            return true
        } catch (error) {
            console.error('Error erasing data:', error)
            return false
        }
    }

    const loadData = async () => {
    const browserMode = isBrowserMode()
    const response = browserMode
        ? browserLoadConfig()
        : await window.electron.loadFile('config.json')

    let imgRef = undefined
    if (!browserMode) {
        try {
            const tokenRefResponse = await window.electron.loadFile('tokenRef.json')
            if (tokenRefResponse) {
                imgRef = JSON.parse(tokenRefResponse ?? '{}')
            }
        } catch {
        }
    }

    if (response) {
        try {
            const decryptedResponse = key
                ? await decryptWithHashedKey(key, response)
                : response

            const parsedData = JSON.parse(decryptedResponse ?? '{}')

            const migratedData = {
                ...parsedData,
                ...(browserMode ? { hiddenTokens: { ...(parsedData?.hiddenTokens || {}), ...readBrowserHiddenTokens() } } : {}),
                settings: migrateSettings(parsedData?.settings),
                imageRef: imgRef ?? {}
            }

            setData(migratedData)
            setSettings(migratedData.settings)

            await saveData({ ...migratedData })

            setUpdate(prev => prev + 1)
        } catch (err) {
            console.error('Failed to parse config.json', err)
        }
    } else {
        setData(defaultContext)
    }

    setUpdate(1)
}

    const updateImageUrReference = async () => {
        if (urlsFetched || loading) return
        setLoading(true);

        try {
            const pulsechainTokens = 'https://gib.show/list/merged/5ff74ffa222c6c435c9432ad937c5d95e3327ebbe3eb9ff9f62a4d940d5790f9?chainId=369'
            let response

            if (window?.electron?.getFile) {
                const raw = await window.electron.getFile(pulsechainTokens)
                response = typeof raw === 'string' ? JSON.parse(raw) : raw
            } else {
                response = await fetchTokenList(pulsechainTokens)
            }

            if (response) {
                saveDataUnencrypted(response, 'tokenRef')

                setData(prev => {        
                    const newData = {...prev, imageRef: response}
                    saveData(newData)
                    return newData;
                });    
                setUrlsFetched(true)
            }
        } catch (err) {
            console.error('Error fetching token list:', err)
        }
        setLoading(false)
      };

    //#endregion

    useEffect(() => {
        const initialLoad = async () => {
            await loadData()
            try {
    await updateImageUrReference() // 🔥 add this line
        } catch (e) {
            console.warn('Token image fetch failed, continuing...')
        } 
            setInit(true)
        }

        initialLoad()
    }, [])

    const toggleCommunityDapp = (newDappObject, updateOnly = false) => {
        if (!newDappObject?.url || !Array.isArray(newDappObject?.data?.dapps)) return
        setData(prev => {
            const dappsArray = prev?.communityDapps ?? []

            if (dappsArray.some(s => s.url.toLowerCase() === newDappObject.url.toLowerCase())) {
                if(updateOnly) {
                    // Find the index of the existing dapp
                    const index = dappsArray.findIndex(s => s.url.toLowerCase() === newDappObject.url.toLowerCase())
                    // Create new array with the updated dapp in the same position
                    const newDappsArray = [...dappsArray]
                    newDappsArray[index] = newDappObject
                    
                    const newData = {...prev, communityDapps: newDappsArray}
                    saveData(newData)
                    return newData
                } else {
                    const newData = {...prev, communityDapps: dappsArray.filter(s => s.url.toLowerCase() !== newDappObject.url.toLowerCase())}
                    saveData(newData)
                    return newData
                }
            }

            const newData = {...prev, communityDapps: [...dappsArray, newDappObject]}
            saveData(newData)
            return newData
        })
        setUpdate(prev => prev + 1)
    }

    // A manually removed, auto-discovered token must remain hidden after reload.
    // The watchlist entry alone is insufficient: discovery repopulates it on startup.
    const tokenAddressFromEntry = (entry) => {
        const wpls = '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
        const a = String(entry?.token0?.id ?? '').toLowerCase()
        const b = String(entry?.token1?.id ?? '').toLowerCase()
        return a === wpls ? b : b === wpls ? a : String(entry?.token?.address ?? (a || b)).toLowerCase()
    }

    const toggleWatchlist = (watchlistData) => {
        if (!watchlistData?.id) return
        setData(prev => {
            const id = String(watchlistData.id).toLowerCase()
            const existing = prev?.watchlist?.[id]
            const address = tokenAddressFromEntry(existing || watchlistData)
            const watchlist = { ...(prev?.watchlist || {}) }
            const hiddenTokens = { ...(prev?.hiddenTokens || {}) }
            if (existing?.id && !hiddenTokens[address]) {
                // Preserve the original pair entry for an immediate one-click restore.
                // Hidden entries are filtered from display but remain available to P&L.
                if (address) hiddenTokens[address] = true
            } else {
                watchlist[id] = watchlistData
                if (address) delete hiddenTokens[address]
            }
            const next = { ...prev, watchlist, hiddenTokens }
            if (isBrowserMode()) persistBrowserHiddenTokens(hiddenTokens)
            saveData(next)
            return next
        })
        setUpdate(prev => prev + 1)
    }

    const hideToken = (address) => {
        if (!address) return

        setData(prev => {
            const newData = {
                ...prev,
                hiddenTokens: {
                    ...(prev?.hiddenTokens || {}),
                    [address.toLowerCase()]: true
                }
            }

            if (isBrowserMode()) persistBrowserHiddenTokens(newData.hiddenTokens)
            saveData(newData)
            return newData
        })

        setUpdate(prev => prev + 1)
    }
    
    const unhideToken = (address) => {
        if (!address) return

        setData(prev => {
            const newHiddenTokens = { ...(prev?.hiddenTokens || {}) }
            delete newHiddenTokens[address.toLowerCase()]

            const newData = {
                ...prev,
                hiddenTokens: newHiddenTokens
            }

            if (isBrowserMode()) persistBrowserHiddenTokens(newHiddenTokens)
            saveData(newData)
            return newData
        })

        setUpdate(prev => prev + 1)
    }
    
    const unhideAllTokens = () => {
        setData(prev => {
            const newData = {
                ...prev,
                hiddenTokens: {}
            }

            if (isBrowserMode()) persistBrowserHiddenTokens({})
            saveData(newData)
            return newData
        })

        setUpdate(prev => prev + 1)
    }
    // Add-only variant used by automatic held-token discovery. Unlike the
    // manual toggle helper, re-discovering a token can never remove it.
    const massAddWatchlist = (watchlistDataArray) => {
        if (!Array.isArray(watchlistDataArray) || watchlistDataArray.length === 0) return

        setData(prev => {
            const newWatchList = { ...(prev?.watchlist ?? {}) }
            let changed = false

            watchlistDataArray.forEach(watchlistData => {
                const id = String(watchlistData?.id ?? '').toLowerCase()
                if (!id || newWatchList[id]?.id || prev?.hiddenTokens?.[tokenAddressFromEntry(watchlistData)]) return
                newWatchList[id] = watchlistData
                changed = true
            })

            if (!changed) return prev
            const newData = { ...prev, watchlist: newWatchList }
            saveData(newData)
            return newData
        })

        setUpdate(prev => prev + 1)
    }

    const massToggleWatchlist = (watchlistDataArray) => {
        if (!Array.isArray(watchlistDataArray) || watchlistDataArray.length === 0) return
        setData(prev => {
            const watchlist = { ...(prev?.watchlist || {}) }
            const hiddenTokens = { ...(prev?.hiddenTokens || {}) }
            watchlistDataArray.forEach(entry => {
                const id = String(entry?.id || '').toLowerCase()
                if (!id) return
                const address = tokenAddressFromEntry(watchlist[id] || entry)
                if (watchlist[id]?.id && !hiddenTokens[address]) {
                    // Keep the pair in the watchlist data for cache and one-click restore.
                    if (address) hiddenTokens[address] = true
                } else {
                    watchlist[id] = entry
                    if (address) delete hiddenTokens[address]
                }
            })
            const next = { ...prev, watchlist, hiddenTokens }
            if (isBrowserMode()) persistBrowserHiddenTokens(hiddenTokens)
            saveData(next)
            return next
        })
        setUpdate(prev => prev + 1)
    }

    const toggleWallet = (address) => {
        // Add logic to ensure its a valid ethereum address here
        const walletAddress = address.toLowerCase()

        const addRemove = async () => {
            if (data?.wallets?.[walletAddress]?.name) {
                // Remove from hiddenWallets first
                setHiddenWallets(prev => prev.filter(addr => addr !== walletAddress))
                
                // Then remove from wallets data
                setData(prev => {
                    const clone = {...prev}
                    delete clone.wallets[walletAddress]
                    saveData(clone)
                    return clone
                })
            } else {
                // Adding new wallet
                setData(prev => {
                    const prevWallets = prev?.wallets ?? {} 
                    const newData = {
                        ...prev, 
                        wallets: {
                            ...prevWallets, 
                            [walletAddress]: { 
                                name: shortenString(walletAddress) 
                            }
                        }
                    }
                    saveData(newData)
                    return newData
                })
            }
            setUpdate(prev => prev + 1)
        }

        addRemove()
    }

    const updateSettings = (settings) => {
        setData(prev => {
            const newData = {...prev, settings}
            saveData(newData)
            return newData
        })
    }

    const toggleLPWatchlist = (watchlistData) => {
        if (!watchlistData?.id) return; // Ensure id is valid
        setData(prev => {
            if (prev?.lpWatchlist?.[watchlistData.id]?.id) {
                const clone = {...prev};
                delete clone.lpWatchlist[watchlistData.id];
                saveData(clone)
                return clone;
            }
    
            const prevWatchlist = prev?.lpWatchlist ?? {} 
            const newData = {...prev, lpWatchlist: {
                ...prevWatchlist, [watchlistData.id.toLowerCase()]: watchlistData
            }}
            saveData(newData)
            return newData;
        });
        setUpdate(prev => prev + 1)
    }

    const massToggleLPWatchlist = (watchlistDataArray) => {
        if (!Array.isArray(watchlistDataArray) || watchlistDataArray.length === 0) return;

        setData(prev => {
            const newLpWatchlist = { ...(prev?.lpWatchlist ?? {}) }
            
            // Process all items in the array
            watchlistDataArray.forEach(watchlistData => {
                if (!watchlistData?.id) return; // Skip invalid entries
                
                if (prev?.lpWatchlist?.[watchlistData.id]?.id) {
                    // Remove if exists
                    delete newLpWatchlist[watchlistData.id];
                } else {
                    // Add if doesn't exist
                    newLpWatchlist[watchlistData.id.toLowerCase()] = watchlistData;
                }
            });

            const newData = { ...prev, lpWatchlist: newLpWatchlist }
            saveData(newData)
            return newData;
        });
        
        setUpdate(prev => prev + 1)
    };

    const updateAliases = (key, alias) => {
        setData(prev => {
            const newData = {...prev, aliases: {
                ...(prev?.aliases ?? {}),
                [key]: alias ?? ''
            }}

            if (alias == '') {
                delete newData.aliases[key]
            }

            saveData(newData)
            return newData
        })
        setUpdate(prev => prev + 1)
    }

    return (
        <AppContext.Provider value={{ 
            data, 
            update, 
            loading, 
            error, 
            initialized, 
            toggleWatchlist, 
            hideToken,
            unhideToken,
            unhideAllTokens,
            massToggleWatchlist,
            massAddWatchlist,
            toggleLPWatchlist,
            massToggleLPWatchlist,
            updateImageUrReference, 
            toggleWallet, 
            eraseData, 
            updateSettings, 
            saveNewKey,
            resetSingleSetting,
            toggleCommunityDapp,
            updateAliases
        }}>
            {children}
        </AppContext.Provider>
    );
};

// Export the context component itself
export const AppContextComponent = ({ children }) => {
    return (
        <AppContextProvider>
            {children}
        </AppContextProvider>
    );
};

export function useAppContext() {
    const context = useContext(AppContext);
    const [ settings ] = useAtom(appSettingsAtom)
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppContextProvider');
    }

    const getImage = (address) => {
        if (!address) return ImgQuestion

        const defaultImage = defaultTokenInformation?.[address.toLowerCase()]?.icon
        if (defaultImage) return defaultImage
        
        if (!settings?.config?.tokenImagesEnabled) return ImgQuestion

        const list = context?.data?.imageRef?.length
            ? context.data.imageRef
            : tokenref || []
    
        try {
            const token = list.find(f => f.address.toLowerCase() === address.toLowerCase())

            const tokenUrl = token?.url || token?.logoURI

            if (!tokenUrl) return ImgQuestion

            return tokenUrl
            } catch {
            return ImgQuestion
            }
    }

    const getTokenInfo = (address) => {
        if (!address) return undefined

        const defaultInfo = defaultTokenInformation?.[address.toLowerCase()]    
        if (defaultInfo) return defaultInfo
        
        if (!Array.isArray(context?.data?.imageRef) && !Array.isArray(tokenref)) return undefined
    
        try {
          const token = (context?.data?.imageRef || []).find(f => f.address.toLowerCase() == address.toLowerCase())
          const fallback = (tokenref || []).find(f => f.address.toLowerCase() == address.toLowerCase())
            
          return token ?? fallback
        } catch {
          return 
        }
    }

    return {
        ...context,
        getImage,
        getTokenInfo
    }
}

export default AppContextComponent;

import React, { createContext, useState, useEffect, useContext } from 'react';
import { defaultTokenInformation, fetchTokenList } from '../lib/tokens';
import ImgQuestion from "../icons/question.png";
import { shortenString } from '../lib/string';
import { appSettingsAtom, hiddenWalletsAtom, keyAtom, urlsFetchedAtom } from '../store';
import { useAtom } from 'jotai';
import { decryptWithHashedKey, encryptWithHashedKey } from '../lib/crypto';
import { defaultSettings } from '../config/settings';
import defaultMarket from "../config/market.json"

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
    settings: defaultSettings
}

export const initData = async (key) => {
    const dataToSave = JSON.stringify(defaultContext)
    const encrypted = key ? await encryptWithHashedKey(key, dataToSave) : dataToSave
    const saved = await window.electron.saveFile('config.json', encrypted)
    console.log('Config Initialized')
    return saved
}

export const isKeyCorrect = async (key) => {
    const response = await window.electron.loadFile('config.json')
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
        const dataToSave = JSON.stringify(saveData)
        if (newKey || newKey === '') {
            const encrypted = newKey === '' ? dataToSave : await encryptWithHashedKey(newKey, dataToSave)
            const saved = await window.electron.saveFile('config.json', encrypted)
            setKey(newKey)
        } else {
            const encrypted = key ? await encryptWithHashedKey(key, dataToSave) : dataToSave
            const saved = await window.electron.saveFile('config.json', encrypted)
        }
        
        console.log('File saved')
    }

    const saveNewKey = async (newKey) => {
        saveData(data, newKey)
    }

    const eraseData = async () => {
        try {
            await window.electron.deleteFile('config.json')
            setData(defaultContext)
            setUpdate(prev => prev + 1)
            console.log('Data erased')
        } catch (error) {
            console.error('Error erasing data:', error)
        }
    }

    const loadData = async () => {
        const response = await window.electron.loadFile('config.json')
        if (response) {
            try {
                const decryptedResponse = key ? await decryptWithHashedKey(key, response) : response
                setData(JSON.parse(decryptedResponse ?? {}))
                setUpdate(prev => prev + 1)
            } catch (err) {
                // failed to parse the JSON - issue w/ file 
            }
            
        } else {
            console.log('No data found')
            await saveData(defaultContext)
            setData(defaultContext)
        }

        setUpdate(1)
    }

    const updateImageUrReference = async () => {
        if (urlsFetched || loading) return
        setLoading(true);

        try {
            const pulsechainTokens = 'https://gib.show/list/merged/5ff74ffa222c6c435c9432ad937c5d95e3327ebbe3eb9ff9f62a4d940d5790f9?chainId=369'
            const response = await fetchTokenList(pulsechainTokens);

            if (response) {
                setData(prev => {        
                    const newData = {...prev, imageRef: response}
                    saveData(newData)
                    return newData;
                });    
                setUrlsFetched(true)
            }
        } catch (err) {
            console.error('Error fetching token list')
        }
        setLoading(false)
      };

    //#endregion

    useEffect(() => {
        const initialLoad = async () => {
            await loadData()
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

    const toggleWatchlist = (watchlistData) => {
        if (!watchlistData?.id) return; // Ensure id is valid
        setData(prev => {
            if (prev?.watchlist?.[watchlistData.id]?.id) {
                const clone = {...prev};
                delete clone.watchlist[watchlistData.id];
                saveData(clone)
                return clone;
            }
    
            const prevWatchlist = prev?.watchlist ?? {} 
            const newData = {...prev, watchlist: {
                ...prevWatchlist, [watchlistData.id.toLowerCase()]: watchlistData
            }}
            saveData(newData)
            return newData;
        });
        setUpdate(prev => prev + 1)
    };

    const massToggleWatchlist = (watchlistDataArray) => {
        if (!Array.isArray(watchlistDataArray) || watchlistDataArray.length === 0) return;

        setData(prev => {
            const newWatchList = { ...(prev?.watchlist ?? {}) }
            
            // Process all items in the array
            watchlistDataArray.forEach(watchlistData => {
                if (!watchlistData?.id) return; // Skip invalid entries
                
                if (prev?.watchlist?.[watchlistData?.id.toLowerCase()]?.id) {
                    // Remove if exists
                    delete newWatchList[watchlistData.id];
                } else {
                    // Add if doesn't exist
                    newWatchList[watchlistData?.id.toLowerCase()] = watchlistData;
                }
            });

            const newData = { ...prev, watchlist: newWatchList }
            saveData(newData)
            return newData;
        });
        
        setUpdate(prev => prev + 1)
    };

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

    return (
        <AppContext.Provider value={{ 
            data, 
            update, 
            loading, 
            error, 
            initialized, 
            toggleWatchlist, 
            massToggleWatchlist,
            toggleLPWatchlist,
            massToggleLPWatchlist,
            updateImageUrReference, 
            toggleWallet, 
            eraseData, 
            updateSettings, 
            saveNewKey,
            resetSingleSetting,
            toggleCommunityDapp
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
        if (!Array.isArray(context?.data?.imageRef)) return ImgQuestion
    
        try {
          const token = context.data.imageRef.find(f => f.address.toLowerCase() == address.toLocaleLowerCase())
    
          if (!token?.url) return ImgQuestion
    
          return token?.url
        } catch {
          return ImgQuestion // undefined
        }
    }

    const getTokenInfo = (address) => {
        if (!address) return undefined

        const defaultInfo = defaultTokenInformation?.[address.toLowerCase()]    
        if (defaultInfo) return defaultInfo
        
        if (!Array.isArray(context?.data?.imageRef)) return undefined
    
        try {
          const token = context.data.imageRef.find(f => f.address.toLowerCase() == address.toLowerCase())
            
          return token
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

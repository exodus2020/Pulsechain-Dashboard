import { useState, useEffect, useRef } from "react"
import { icons_list } from "../config/icons"
import { useCopyToClipboard } from "../hooks/useCopyToClipboard"
import { parseHexStats } from "../lib/hex"
import { fUnit } from "../lib/numbers"
import { shortenString } from "../lib/string"
import Button from "./Button"
import Icon from "./Icon"

export default function SingleWallet({ m, i, alias, updateAliases, isEditing, setIsEditing, setModal, balanceData, farmData, lpData, hexData, hexPrice, useWalletData, toggleWallet }) {
    const { toggleWalletVisibility, visibleWallets, isHidden } = useWalletData
    const { copyTextToClipboard } = useCopyToClipboard()
    const inputRef = useRef(null);

    const balancesObject = balanceData?.balances?.[m.toLowerCase()]?.balances ?? {}
    const balance = Object.keys(balancesObject).reduce((acc, key) => {
      return acc + (balancesObject[key]?.usd ?? 0)
    }, 0)

    const farmArray = farmData?.farmBalances?.[m.toLowerCase()] ?? []
    const farmBalance = farmArray.reduce((acc, k) => {
      return acc + Number(k?.rewards?.usd ?? 0) + Number(k?.token0?.usd ?? 0) + Number(k?.token1?.usd ?? 0)
    }, 0)

    const lpObject = lpData?.lpBalances?.[m.toLowerCase()] ?? []
    const lpBalance = Object.keys(lpObject).reduce((acc, key) => {
      return acc + Number(lpObject[key]?.token0?.usd ?? 0) + Number(lpObject[key]?.token1?.usd ?? 0)
    }, 0)
    
    const hexBalance = (parseHexStats( (hexData?.combinedStakes ?? [])?.filter(f => f?.address?.toLowerCase() == m.toLowerCase())  ?? [] )?.totalFinalHex ?? 0) * hexPrice

    const totalBalance = balance + farmBalance + lpBalance + hexBalance

    const walletIsHidden = isHidden(m)

    const liquidPercentage = balance / totalBalance * 100
    const farmPercentage = farmBalance / totalBalance * 100
    const lpPercentage = lpBalance / totalBalance * 100
    const hexPercentage = hexBalance / totalBalance * 100

    const handleCopy = (text) => {
        copyTextToClipboard(text, `${shortenString(text)} copied to clipboard`, 'Failed to copy')
    }

    const [ editEnabled, setEditEnabled ] = useState(false)
    const [ renameText, setRenameText ] = useState(alias ?? '')
    const handleEdit = (e) => {
        const text = e.target.value
        setRenameText(text)
    }

    useEffect(() => {
        if (editEnabled && inputRef.current) {
            inputRef.current.focus()
            setIsEditing(m.toLowerCase())
        }
    }, [editEnabled])

    useEffect(() => {
        if (!isEditing && editEnabled) {
            setEditEnabled(false)
            setRenameText(alias ??'')
        } else {
          setRenameText(alias ?? '')
        }
    }, [isEditing])

    const handleSave = () => {
        updateAliases(m.toLowerCase(), renameText.trim())
        setRenameText(renameText.trim())
        setIsEditing(false)
        setEditEnabled(false)
    }

    useEffect(() => {
        const handleKeyPress = (event) => {
            if (event.key === 'Enter' && isEditing) {
                handleSave()
            }
            if (event.key === 'Escape' && isEditing) {
                setIsEditing(false)
                setEditEnabled(false)
                setRenameText(alias ?? '')
            }
        }

        if (isEditing) {
            document.addEventListener('keydown', handleKeyPress)
        }

        return () => {
            document.removeEventListener('keydown', handleKeyPress)
        }
    }, [isEditing, renameText])

    return <div style={{ padding: 10, background: 'linear-gradient(to bottom, rgba(50, 50, 50, 0.6), rgba(30, 30, 30, 0.9))', borderRadius: 10 }}>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 30px', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ marginTop: 6, cursor: 'pointer' }} className={`${walletIsHidden ? 'mute' :''}`} onClick={() => toggleWalletVisibility(m)}>
                <Icon icon={walletIsHidden ? icons_list.hide : icons_list.show} size={20}/>
            </div>
            <div style={{ marginTop: 6, cursor: 'pointer' }} onClick={() => handleCopy(m)}>
                <Icon icon={icons_list.copy} size={20}/>
            </div>
          </div>
          {!editEnabled && <>
            <Button customClass="wallet-name wallet-save-desktop" style={{ background: 'rgb( 0, 0, 0, 0)', color: 'white', fontWeight: 700, fontSize: 16, position: 'relative' }}
              onClick={() => {
                  if(!editEnabled) setEditEnabled(true)
              }}
            >
              <div className="wallet-name-text">
                  {alias ?? shortenString(m ?? '')} <Icon icon={icons_list.pencil} style={{ marginLeft: 10, color: 'rgb(150,150,150)' }} size={20}/>
              </div>
              <div className="wallet-total-value">
                ${fUnit(totalBalance, 2)}
              </div>
            </Button>
            <div className="wallet-name wallet-save-mobile"  style={{ background: 'rgb( 0, 0, 0, 0)', color: 'white', fontWeight: 700, fontSize: 16, position: 'relative' }}>
              <div className="wallet-name-text">
                    {alias ?? shortenString(m ?? '')} <span onClick={() => {
                  if(!editEnabled) setEditEnabled(true)
                }}><Icon icon={icons_list.pencil} style={{ marginLeft: 10, color: 'rgb(150,150,150)' }} size={20}/></span>
                </div>
                <div className="wallet-total-value">
                  ${fUnit(totalBalance, 2)}
                </div>
            </div>
          </>}
          {editEnabled && <div customClass="wallet-name" style={{ minHeight: 36, background: 'rgb( 0, 0, 0, 0)', color: 'white', fontWeight: 700, fontSize: 16, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ cursor: 'pointer', display: 'inline-block', marginLeft: 5 }}
                    onClick={() => {
                    if(editEnabled) setEditEnabled(false)
                    setIsEditing(false)
                }}>
                    <Icon icon={icons_list.cancel} size={24}/>
                </div>
                <div style={{ cursor: 'pointer', display: 'inline-block',  marginLeft: 5 }}
                    onClick={() => {
                        handleSave()
                        if(editEnabled) setEditEnabled(false)
                        setIsEditing(false)
                }}>
                    <Icon icon={icons_list.check} size={20}/>
                </div>
                <input 
                    ref={inputRef}
                    placeholder='Type to alias, blank for default' 
                    type="text" 
                    value={renameText} 
                    onChange={handleEdit} 
                    style={{ background: 'transparent', border: 'none', color: 'white', fontSize: 12, position: 'relative', width: '100%', paddingLeft: 10, marginLeft: 10 }}
                />
          </div>}
          <div>
            <Button parentStyle={{ marginBottom: 5, width: 40, display: 'inline-block' }} style={{ padding: 0 }} onClick={() => {
                toggleWallet(m)
                setModal(false)
              }} textAlign={'center'}>
                <Icon icon={icons_list.trash} size={16}/>
            </Button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'rgb(150,150,150)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 5, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: balance > 0.5 ? 'rgba(131, 212, 83, 0.8)' : 'rgb(100,100,100)' }}>Held: ${fUnit(balance, 0)}</div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: farmBalance > 0.5 ? 'rgba(29, 179, 109, 0.8)' : 'rgb(100,100,100)' }}>Farms: ${fUnit(farmBalance, 0)}</div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: lpBalance > 0.5 ? 'rgba(179, 106, 106, 0.8)' : 'rgb(100,100,100)' }}>LP: ${fUnit(lpBalance, 0)}</div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: hexBalance > 0.5 ? 'rgba(224, 194, 112, 0.8)' : 'rgb(100,100,100)' }}>Stakes: ${fUnit(hexBalance, 0)}</div>
        </div>
        <div style={{ background: 'rgb(20,20,20)', height: 4, overflow: 'hidden', borderRadius: 4, position: 'relative', marginTop: 10 }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: 4, width: `${liquidPercentage}%`, background: 'rgb(131, 212, 83)' }}/>
          <div style={{ position: 'absolute', left: `${liquidPercentage}%`, top: 0, height: 4, width: `${farmPercentage}%`, background: 'rgb(29, 179, 109)' }}/>
          <div style={{ position: 'absolute', left: `${liquidPercentage + farmPercentage}%`, top: 0, height: 4, width: `${lpPercentage}%`, background: 'rgb(179, 106, 106)' }}/>
          <div style={{ position: 'absolute', left: `${liquidPercentage + farmPercentage + lpPercentage}%`, top: 0, height: 4, width: `${hexPercentage}%`, background: 'linear-gradient(30deg, #ffdb01 0%, #ff851f 30%, #ff3d3d 52%, #ff0f6f 70%, #f0f 100%)' }}/>
        </div>
      </div>
    </div>
}
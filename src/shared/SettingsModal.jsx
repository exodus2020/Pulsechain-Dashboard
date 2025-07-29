import { useAtom } from 'jotai'
import styled from 'styled-components'
import 'typeface-raleway'
import { appSettingsAtom, keyAtom, settingsModalAtom } from '../store'
import { icons_list } from '../config/icons'
import Icon from '../components/Icon'
import Button from '../components/Button'
import { useAppContext } from './AppContext'
import { defaultSettings } from '../config/settings'
import { Checkbox } from '../components/Checkbox'
import { useState, useEffect } from 'react'
import { Input } from '../components/Input'
import { useValidateRpc } from '../hooks/useValidateRpc'
import { hashString } from '../lib/crypto'

const ModalWrapper = styled.div`
  position: absolute; top: 0; left: 0; height: 100vh; width: 100vw;
  user-select: none;
  z-index: 100;
  background: linear-gradient(to bottom, rgba(50, 50, 50, 0.6), rgba(0, 0, 0, 0.9));
  backdrop-filter: blur(6px);
  overflow: hidden;

  .close-button {
    color: white;
    background: rgba(0,0,0,0);
    outline: none;
    border: none;
    position: absolute; right: 10px;
    cursor: pointer;

    padding: 10px 20px;
    color: rgb(240,240,240);
    transition: color 0.3s ease;
    cursor: pointer;
    &:hover {
      color: rgb(200,200,200);
    }
  }
`

const ModelOverLay = styled.div`
  position: fixed; top: 0; left: 0; height: 100vh; width: 100vw;
  z-index: 500;
  overflow: hidden;
`

const ModalContent = styled.div`
  position: absolute;
  top: 50%; left: 50%;
  transform: translateX(-50%) translateY(-50%);
  max-height: 80%; width: 500px;
  background: rgb(50,50,50);
  border-radius: 15px;
  z-index: 1000;
  padding-bottom: 20px;

  overflow-x: hidden;
  color: white;

  .modal-header {
    padding: 20px 30px;
    border-bottom: 1px solid rgb(70, 70, 70);
    font-size: 20px;
    font-weight: 800;

    display: flex;
    align-items: center; /* Aligns items vertically */
    gap: 8px; /* Adds space between the icon and text */
    font-size: 20px; /* Adjust as needed for your text size */
  }

  @media (max-width: 650px) {
    width: 100dvw;
    max-width: 100dvw;
    min-width: 100dvw;
    top: 0px; transform: translateX(-50%) translateY(0%);
    min-height: 100dvh;
    max-height: 100dvh;
  }
`

const RepoItem = styled.div`
  display: grid;
  grid-template-columns: 320px 150px;
  align-items: center; /* Aligns items vertically */
  gap: 8px; /* Adds space between the icon and text */
  font-size: 20px; /* Adjust as needed for your text size */
  white-space: normal; /* Allows text to wrap */
  word-wrap: break-word; /* Break long words if necessary */
  overflow-wrap: break-word; /* Ensures wrapping works for all cases */
  max-width: 100%; /* Optional: Restrict width */
`

function SettingsModal({ context }) {
  const [ m, setModal ] = useAtom(settingsModalAtom)
  const [ key, setKey ] = useAtom(keyAtom)
  const [ settings, setSettings ] = useAtom(appSettingsAtom)
  const { updateImageUrReference, updateSettings, saveNewKey, eraseData } = context
  
  const [ externalImages, setAllowExternalImages] = useState(settings?.config?.tokenImagesEnabled ?? false)
  const [ externalDappImages, setAllowExternalDappImages] = useState(settings?.config?.dappImagesEnabled ?? false)
  const [ allowPulsechainApi, setAllowPulseChainApi] = useState(settings?.config?.scanEnabled ?? false)
  const [ rpcUrl, setRpcUrl ] = useState('')
  const { isValid, isChecking, error, validateRpc } = useValidateRpc()

  const handleSave = () => {
    const newSettings = {
      ...settings,
      config: {
        ...settings.config,
        tokenImagesEnabled: externalImages,
        scanEnabled: allowPulsechainApi,
        dappImagesEnabled: externalDappImages
      },
    }
    updateSettings(newSettings)
    setSettings(newSettings)
    setModal(false)
  }

  useEffect(() => {
    setAllowExternalImages(settings?.config?.tokenImagesEnabled ?? false)
    setAllowPulseChainApi(settings?.config?.scanEnabled ?? false)
    setAllowExternalDappImages(settings?.config?.dappImagesEnabled ?? false)
  }, [settings])

  const handleUpdateRpc = async (value) => {
    const isValidRpc = await validateRpc(value)
    if (isValidRpc) {
      setSettings(prev => ({
        ...prev,
        rpcs: {
          ...prev.rpcs,
          mainnet: [value]
        }
      }))
    }
  }

  const [ passwordValue, setPasswordValue ] = useState(undefined)
  const [ keymatch, setKeymatch ] = useState(key === (passwordValue ?? ''))
  const [ passwordComplete, setPasswordComplete ] = useState(false)

  const handlePasswordConfirm = async (value) => {
    const hashedKey = value === '' ? '' : await hashString(value)
    if (!keymatch) {
      if (hashedKey == key) {
        setKeymatch(true)
      }
    } else {
      if (passwordValue === undefined) {
        setPasswordValue(hashedKey)
      } else {
        if (passwordValue === hashedKey) {
          // Save Changes and Set New Key
          console.log('saved!')
          saveNewKey(hashedKey)
          setPasswordComplete(true)
        } else {
          // Password does not match
          setPasswordValue(undefined)
        }
      }
    }
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        await window.electron.saveFile('config.json', text)
        window.location.reload()
    } catch (error) {
        console.error('Error reading file:', error);
        onFileContent(null);
    }
  }

  const handleExportData = async () => {
    const dataToExport = await window.electron.loadFile('config.json')
    const blob = new Blob([dataToExport], { type: 'text/plain' });
  
    // Create a temporary URL for the blob
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plsdash-export.txt';
    
    // Programmatically click the link to trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return (
    <ModalWrapper>
      <ModalContent>
        <div style={{ overflowY: 'auto' }}>
          <div className="modal-header">
              <Icon icon={icons_list.settings} size={24}/> Settings
              <button className="close-button" onClick={() => setModal(null)}>
                X
              </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 40px' }}>
            <div>
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
                  <Checkbox value={externalImages} onChange={setAllowExternalImages} label="Allow Use of External Token Images" />
                  <Button onClick={updateImageUrReference} disabled={externalImages ? false : true} style={externalImages ? {} : { color: 'rgb(70,70,70)', background: 'rgba(30,30,30, .5)'}}>
                    Update References
                  </Button>
                </div>
                <Checkbox value={externalDappImages} onChange={setAllowExternalDappImages} label="Allow Use of External Community dApp Icons" />
                <Checkbox value={allowPulsechainApi} onChange={setAllowPulseChainApi} label={<div>Allow Use of <span className='ht'>Pulsechain Explorer</span> API</div>} />
                <Input 
                  placeholder={settings?.rpcs?.mainnet?.[0] ?? ''} 
                  buttonText={isChecking ? 'Validating...' : 'Update RPC'} 
                  onSubmit={handleUpdateRpc}
                  disabled={isChecking}
                  error={error}
                  clearOnSubmit={true}
                  containerStyle={{ gridTemplateColumns: '1fr 110px' }}
                />
                {!passwordComplete ? <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', marginTop: 15 }} className="desktop-only">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {key === '' ? 'Add' : 'Update'} Password
                  </div>
                  <Input 
                    placeholder={!keymatch ? 'Enter current password' 
                      : keymatch && passwordValue === undefined ? 'Enter new password'
                      : keymatch && passwordValue !== undefined ? 'Confirm new password'
                      : 'Err'
                    } 
                    buttonText={'Confirm'} 
                    onSubmit={handlePasswordConfirm}
                    disabled={isChecking}
                    error={error}
                    clearOnSubmit={true}
                    type="password"
                    containerStyle={{ gridTemplateColumns: '1fr 110px' }}
                  />
                </div> : <div style={{ paddingTop: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="desktop-only">Password Updated!</div>}
                {!passwordComplete ? <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: 15 }} className="mobile-only">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {key === '' ? 'Add' : 'Update'} Password
                  </div>
                  <Input 
                    placeholder={!keymatch ? 'Enter current password' 
                      : keymatch && passwordValue === undefined ? 'Enter new password'
                      : keymatch && passwordValue !== undefined ? 'Confirm new password'
                      : 'Err'
                    } 
                    buttonText={'Confirm'} 
                    onSubmit={handlePasswordConfirm}
                    disabled={isChecking}
                    error={error}
                    clearOnSubmit={true}
                    type="password"
                    containerStyle={{ gridTemplateColumns: '1fr 110px' }}
                  />
                </div> : <div style={{ paddingTop: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}  className="mobile-only">Password Updated!</div>}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '20px 40px' }}>
          <Button onClick={handleSave} textAlign="center">Save</Button>
          <Button onClick={() => {
              setSettings(defaultSettings)
              updateSettings(defaultSettings)
              setModal(false)
            }} textAlign="center">Default Settings</Button>
            <Button onClick={handleExportData} textAlign="center">Export Data</Button>
            {/* <Button onClick={handleSave} textAlign="center">Import Data</Button> */}
            <label style={{ cursor: 'pointer', position: 'relative' }}>
              <Button textAlign="center" style={{ pointerEvents: 'none' }}>Import Data</Button>
              <input
                type="file"
                onChange={handleFileSelect}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }}
              />
            </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0px 40px' }}>
          <div>
            <div>
              <Button onClick={() => {
                setSettings(defaultSettings)
                updateSettings(defaultSettings)
                eraseData()
                setModal(false)
                setKey(null)
                window.location.reload()
              }} textAlign="center"
              style={{ background: 'rgb(140,60,60)', color: 'white' }}>Erase All Data</Button>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={() => setModal(false)}/>
    </ModalWrapper>
  )
}

export default SettingsModal
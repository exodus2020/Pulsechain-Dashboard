import { useAtom } from 'jotai'
import { useState, useEffect, useMemo } from 'react'
import styled from 'styled-components'
import 'typeface-raleway'
import { appSettingsAtom, dappModalAtom, serverStatusAtom, settingsModalAtom } from '../store'
import { icons_list } from '../config/icons'
import Button from '../components/Button'
import AnimatedStatus from '../components/AnimatedStatus'
import Icon from '../components/Icon'
import Tooltip from './Tooltip'
import { getTagColor, repositories } from '../config/dapps'
import { Selector } from '../components/Selector'
import defaultMarket from "../config/market.json"
import Input from "../components/Input"
import { formatDatetime } from '../lib/date'
import CommunityDappItem from '../components/CommunityDappItem'

const ModalWrapper = styled.div`
  position: absolute; top: 0; left: 0; height: 100vh; width: 100vw;
  user-select: none;
  z-index: 100;
  background: rgba(30,30,30, 0.9);
  backdrop-filter: blur(3px);

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
`

const ModalContent = styled.div`
  position: absolute;
  top: 50%; left: 50%;
  transform: translateX(-50%) translateY(-50%);
  min-height: 480px; max-height: 80%; width: 500px;
  background: rgb(50,50,50);
  border-radius: 15px;
  z-index: 1000;
  color: white;
  padding-bottom: 20px;
  overflow-y: scroll;

  .modal-header {
    padding: 20px 30px;
    border-bottom: 1px solid rgb(65, 65, 65);
    font-size: 20px;
    font-weight: 800;

    display: flex;
    align-items: center;
    gap: 8px; 
    font-size: 20px; 
  }
`

const RepoItem = styled.div`
  display: grid;
  grid-template-columns: 320px 150px;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  white-space: normal;
  word-wrap: break-word; 
  overflow-wrap: break-word; 
  max-width: 100%;
`

const SettingsButton = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 7px 0px 6px 0px;
  border-radius: 5px;
  // background: rgba(0,0,0,0.2);
  &:hover {
    background: rgba(0,0,0,0.3);
    box-shadow: inset 0px 0px 0px 1px white;
  }
`

const Tag = styled.div`
  box-shadow: 0px 0px 0px 1px white;
  padding: 5px 10px;
  border-radius: 5px;
  display: inline-block;
  margin-right: 5px;
  margin-bottom: 5px;
` 

function DappModal({communityData}) {
  const [modal, setModal] = useAtom(dappModalAtom)
  const [section, setSection] = useState('Official')
  const [settings] = useAtom(appSettingsAtom)
  const imagesEnabled = settings?.config?.dappImagesEnabled ?? false

  const [cloneStatuses, setCloneStatuses] = useState({})
  const [isLoading, setIsLoading] = useState({})
  const [serverStatuses, setServerStatuses] = useState({})
  const [versions, setVersions] = useState({})
  const [runningServers, setRunningServers] = useAtom(serverStatusAtom)

  const isCloning = Object.values(cloneStatuses).some(status => status === 'Cloning...')
  const handleCloseModal = () => {
    if(isCloning) return

    setModal(false)
  }

  const { communityLists, communityDapps: _dapps, toggleDappList } = communityData
  const [filter, setFilter] = useState('')
  const handleChangeFilter = (value) => {
    setFilter(value)
  }

  const [ communityMarket, setCommunityMarket ] = useState([])
  const communityDapps = _dapps ?? []

  useEffect(() => {
    // Check versions for all repositories on component mount
    checkAllVersions()
  }, [communityMarket])

  const checkAllVersions = async () => {
    const newVersions = {}
    for (const repo of repositories) {
      try {
        const version = await window.electron.checkVersion(repo.folder)
        newVersions[repo.folder] = version
      } catch (error) {
        newVersions[repo.folder] = null
      }
    }

    for (const repo of communityDapps) {
      try {
        const version = await window.electron.checkVersion(repo.folder)
        newVersions[repo.folder] = version
      } catch (error) {
        newVersions[repo.folder] = null
      }
    }

    setVersions(newVersions)
  }

  const handleCloneRepo = async (repo) => {
    try {
      // First stop the server if it's running
      if (serverStatuses[repo.folder]?.includes('running')) {
        await window.electron.stopServer(repo.folder)
        setServerStatuses(prev => ({
          ...prev,
          [repo.folder]: 'Server stopped'
        }))
      }

      setCloneStatuses(prev => ({
        ...prev,
        [repo.folder]: 'Cloning...'
      }))

      setIsLoading(prev => ({
        ...prev,
        [repo.folder]: true
      }))

      console.log('Starting clone for:', repo.folder)
      const result = await window.electron.cloneRepo(repo.repoUrl, repo.folder)
      console.log('Clone result:', result)

      // Check version after successful clone
      const version = await window.electron.checkVersion(repo.folder)
      console.log('Version check result:', version)
      
      setVersions(prev => ({
        ...prev,
        [repo.folder]: version
      }))

      setCloneStatuses(prev => ({
        ...prev,
        [repo.folder]: 'Clone successful!'
      }))

    } catch (error) {
      console.error('Clone error:', error)
      setCloneStatuses(prev => ({
        ...prev,
        [repo.folder]: `Clone failed: ${error.message || 'Unknown error'}`
      }))
    } finally {
      setIsLoading(prev => ({
        ...prev,
        [repo.folder]: false
      }))
    }
  }

  const handleStopServer = async (repo) => {
    try {
      await window.electron.stopServer(repo.folder)
      setRunningServers(prev => ({
        ...prev,
        [repo.folder]: false
      }))
      setServerStatuses(prev => ({
        ...prev,
        [repo.folder]: 'Server stopped'
      }))
    } catch (error) {
      console.error(`Failed to stop server: ${error.message}`)
    }
  }

  const handleServeWebapp = async (repo) => {
    try {
      if (serverStatuses[repo.folder]?.includes('running')) {
        await window.electron.openExternal(`http://localhost:${repo.port}`)
        return
      }

      setServerStatuses(prev => ({
        ...prev,
        [repo.folder]: 'Starting server...'
      }))
      
      const result = await window.electron.serveWebapp(repo.folder, repo.port)
      
      setRunningServers(prev => ({
        ...prev,
        [repo.folder]: true
      }))
      
      setServerStatuses(prev => ({
        ...prev,
        [repo.folder]: `Server running at http://localhost:${repo.port}`
      }))
      
      await window.electron.openExternal(`http://localhost:${repo.port}`)
    } catch (error) {
      setRunningServers(prev => ({
        ...prev,
        [repo.folder]: false
      }))
      setServerStatuses(prev => ({
        ...prev,
        [repo.folder]: `Server failed to start: ${error.message}`
      }))
    }
  }

  const displayCommunityDapps = useMemo(() => {

    if(!filter) return communityDapps || []

    const newDapps = (communityDapps || []).filter(repo => 
        repo?.name?.toLowerCase().includes(filter.toLowerCase()) || 
        repo?.description?.toLowerCase().includes(filter.toLowerCase()) || 
        (repo?.tags && Array.isArray(repo.tags) && repo.tags.some(s => 
            typeof s === 'string' && s.toLowerCase().includes(filter.toLowerCase())
        ))
    ) || []

    return newDapps

  }, [filter, communityDapps])

  const [ editDapps, setEditDapps ] = useState(false)

  const handleAddList = () => {
    toggleDappList(filter, false)
    setFilter('')
  }

  const handleToggleEdit = () => {
    setEditDapps(!editDapps)
    setFilter('')
  }

  return (
    <ModalWrapper>
      <ModalContent>
        <div style={{ height : '100%' }}>
          <div className="modal-header">
              <Icon icon={icons_list.apps} size={24}/> dApps
              <button className="close-button" onClick={handleCloseModal}>
                X
              </button>
          </div>
          <div style={{ padding: '10px 20px 0px 10px', letterSpacing: 0.5, position: 'relative' }}>
            <Selector options={['Official', 'Community']} value={section} onChange={(newSection) => {
              setSection(newSection)
              setEditDapps(false)
              setFilter('')
              }}/>
              {section == 'Community' ? <div style={{ position: 'absolute', right: 10, top: 10, width: 50 }}>
                <SettingsButton style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 0px 1px 2px rgb(65,65,65)'}} onClick={handleToggleEdit}>
                  <Icon icon={icons_list.library} size={20}/>
                </SettingsButton>
              </div> : ''}
          </div>
          <div style={{ height: '360px', overflowY: 'auto', marginTop: 10}}>
            {section == 'Official' ? <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 10px', overflowY: 'auto' }}>
              {repositories.map(repo => {
                const isServerRunning = runningServers[repo.folder] === true
                const isDownloaded = versions?.[repo.folder] ? true : false
                const isRepoLoading = isLoading?.[repo.folder] === true ? true : false
                const status = isRepoLoading ? 2 : isServerRunning === true ? 1 : 0

                const bottom = <div style={{ marginTop: 10 }}>
                    {isServerRunning === true ? <div>
                        Active - <span className="tl" onClick={() => handleStopServer(repo)}>Terminate</span>
                      </div>
                      : isRepoLoading ? (isDownloaded ? 'Updating...' : 'Downloading...')
                      : !isDownloaded ? <div>
                        <span className="tl" onClick={() => handleCloneRepo(repo)}>Download</span>
                      </div>
                      : <div>
                      <Tooltip content="Open Source">
                        <div onClick={() => window.electron.openExternal(repo.repoUrl)}>
                          <Icon icon={icons_list.launch} size={14} style={{ cursor: 'pointer' }}/>
                        </div>
                      </Tooltip>
                      <span className="tl" onClick={() => handleCloneRepo(repo)} style={{ marginLeft: 5 }}>Check for Update</span>
                    </div>
                    }
                  </div>

                const repoVersion = versions[repo.folder]?.tag || versions[repo.folder]?.version
                return (
                  <div key={repo.folder}>
                    <RepoItem style={{ position: 'relative'}}>
                      {/* <Tooltip content="Open in Browser"> */}
                        <div style={{ position: 'relative'}}> 
                            <Button 
                              image={repo?.icon ?? undefined}
                              style={{ width: '100%', padding: '20px 14px' }} 
                              text={repo.name}
                              onClick={() => {
                                if(!repoVersion) return
                                handleServeWebapp(repo)
                              }}
                            />
                          <div style={{ position: 'absolute', right: 5, top: 5 }}>
                            <Tooltip content={status == 1 ? 'Running on Port ' + repo.port : status == 2 ? 'Updating' : 'Idle'}>
                              <AnimatedStatus status={status} size={20}/>
                            </Tooltip>
                          </div>
                        </div>
                      {/* </Tooltip> */}
                      <div style={{ paddingRight: 10, fontSize: 14, position: 'relative' }}>
                        <div>
                          {repo?.webUrl && typeof repo.webUrl === 'string' ? <Tooltip content={<div>Launch Website<br/>{repo.webUrl}</div>}>
                            <div onClick={() => window.electron.openExternal(repo.webUrl)}>
                              <Icon icon={icons_list.world} size={14} style={{ cursor: 'pointer' }}/>
                            </div>
                          </Tooltip> : ''}
                          <span style={{ marginLeft: 5 }}>
                            {repoVersion || 'Requires Download'}
                          </span>
                        </div>
                        {bottom}
                      </div>
                    </RepoItem>
                  </div>
                )
              })}
            </div> : ''}
            {!editDapps && section == 'Community' ? <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 10px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10}}>
                <Input defaultInput=""  placeholder="Filter by name, description, or tags" hideSubmit={true} onChange={setFilter} customInputValue={filter}/>
              </div>
              {displayCommunityDapps.map((repo,i) => {
                const isServerRunning = runningServers[repo.folder] === true
                const isDownloaded = versions?.[repo.folder] ? true : false
                const isRepoLoading = isLoading?.[repo.folder] === true ? true : false
                const status = isRepoLoading ? 2 : isServerRunning === true ? 1 : 0

                const repoVersion = versions[repo.folder]?.tag || versions[repo.folder]?.version
                const displayVersion = (repoVersion ?? '').toString().includes('v') ? repoVersion : `v${repoVersion}`

                const noRepo = !repo?.repoUrl || !repo?.folder || !repo?.port
                const noWebUrl = !repo?.webUrl || !repo?.name

                if (noRepo && noWebUrl) return ''
                
                const bottom = noRepo ? <div style={{height: 25 }}/> : <div style={{ marginTop: 10 }}>
                    {isServerRunning === true ? <div>
                        Active - <span className="tl" onClick={() => handleStopServer(repo)}>Terminate</span>
                      </div>
                      : isRepoLoading ? (isDownloaded ? 'Updating...' : 'Downloading...')
                      : !isDownloaded ? <div>
                        <span className="tl" onClick={() => handleCloneRepo(repo)}>Download</span>
                      </div>
                      : <div>
                      <Tooltip content="Open Source">
                        <div onClick={() => window.electron.openExternal(repo.repoUrl)}>
                          <Icon icon={icons_list.launch} size={14} style={{ cursor: 'pointer' }}/>
                        </div>
                      </Tooltip>
                      <span className="tl" onClick={() => handleCloneRepo(repo)} style={{ marginLeft: 5 }}>Check for Update</span>
                    </div>
                    }
                  </div>

                const button = <Button 
                    image={!imagesEnabled ? undefined : repo?.icon ?? undefined}
                    style={{ width: '100%', padding: `20px 14px 20px ${imagesEnabled && repo?.icon ? 14 : 62}px`, minHeight: 70}} 
                    text={repo.name}
                    onClick={() => {
                      if(noRepo && !noWebUrl) window.electron.openExternal(repo.webUrl)
                      if(!repoVersion ) return
                      handleServeWebapp(repo)
                    }}
                  />

                const tags = repo?.tags || []
                const description = <div style={{ fontSize: 14, padding: '0px 10px' }}>
                  {repo?.description}
                </div>
                const content = (
                  <div key={repo.folder}>
                    <RepoItem style={{ position: 'relative'}}>
                        <div style={{ position: 'relative'}}> 
                            {repo?.description ?
                              <Tooltip customStyle={{ width: '100%' }} key={`${repo.folder}-${i}`} content={<div style={{ maxWidth: 425, overflowWrap: 'normal', wordWrap: 'normal', whiteSpace: 'normal' }}>
                                {Array.isArray(tags) && tags.filter(f => typeof f === 'string').length > 0 ? 
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: '10px 10px' }}>
                                    {tags.map((tag,i) => {
                                      if (i > 7) return ''
                                      const colors = getTagColor(tag)
                                      return <Tag key={`${repo.folder}-tags${i}`} style={{ background: colors[0], color: colors[1], boxShadow: `0px 0px 1px 2px rgb(65,65,65)` }}>
                                        {tag}
                                      </Tag>})}
                                  </div> : ''}
                                {description}
                              </div>}>
                                {button}
                              </Tooltip> : ''}
                          {noRepo ? '' : <div style={{ position: 'absolute', right: 5, top: 5 }}>
                            <Tooltip content={status == 1 ? 'Running on Port ' + repo.port : status == 2 ? 'Updating' : 'Idle'}>
                              <AnimatedStatus status={status} size={20}/>
                            </Tooltip>
                          </div>}
                        </div>
                      <div style={{ paddingRight: 10, fontSize: 14, position: 'relative' }}>
                        <div>
                          {!noRepo && repo?.webUrl && typeof repo.webUrl === 'string' ? <Tooltip content={<div>Launch Website<br/>{repo.webUrl}</div>}>
                            <div onClick={() => window.electron.openExternal(repo.webUrl)}>
                              <Icon icon={icons_list.world} size={14} style={{ cursor: 'pointer' }}/>
                            </div>
                          </Tooltip> : ''}
                          {noRepo ? '' : <span style={{ marginLeft: 5 }}>
                            {repoVersion ? displayVersion : 'Requires Download'}
                          </span>}
                        </div>
                        {bottom}
                      </div>
                    </RepoItem>
                  </div>
                )
                return <div key={`${repo.folder}-${i}`}>
                  {content}
                </div>
              })}
            </div> : ''}
            {editDapps && section == 'Community' ? <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 10px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 10}}>
                  <Input defaultInput="" placeholder="Enter dApp List URL" hideSubmit={true} onChange={setFilter} customInputValue={filter}/>
                  <div>
                    <Button onClick={handleAddList} textAlign="center">
                      {communityLists.some(s => (s?.url ?? '').toLowerCase() == filter.toLowerCase()) ? 'Remove' : 'Add'}
                    </Button>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '25px 140px 1fr 80px', gap: 10, padding: '00px 10px', paddingBottom: 10 }}>
                    <div/>
                    <div>
                      List Name
                    </div>
                    <div>
                      
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      Actions
                    </div>
                  </div>
                  {communityLists.map((m, i) => {
                    return <CommunityDappItem key={`${m.url}-${i}`} m={m} i={i} toggleDappList={toggleDappList}/>
                  })}
                </div>  
              </div> : ''}
          </div>
        </div>
      </ModalContent>
      <ModelOverLay onClick={handleCloseModal}/>
    </ModalWrapper>
  )
}

export default DappModal
import ImgPulseX from '../icons/plsx.png'
import ImgPulse from '../icons/pls.png'
import ImgBridge from '../icons/bridge.png'
import ImgHEX from '../icons/hex.png'

export const repositories = [
    {
      name: "PulseX DEX",
      folder: "pulsex",
      repoUrl: "https://gitlab.com/pulsechaincom/pulsex-server.git",
      webUrl: 'https://app.pulsex.com',
      icon: ImgPulseX,
      port: 9991
    },
    {
      name: "PulseChain Bridge",
      folder: "bridge",
      repoUrl: "https://gitlab.com/pulsechaincom/pulsechain-bridge-server.git",
      webUrl: 'https://bridge.pulsechain.com',
      icon: ImgBridge,
      port: 9992
    },
    {
      name: "PulseChain Explorer",
      folder: "explorer",
      repoUrl: "https://gitlab.com/pulsechaincom/pulsechain-explorer-server.git",
      webUrl: 'https://scan.pulsechain.com',
      icon: ImgPulse,
      port: 9993
    },
    {
      name: "HEX Mining",
      folder: "hex",
      repoUrl: "https://gitlab.com/pulsechaincom/hex-server.git",
      webUrl: 'https://go.hex.com',
      icon: ImgHEX,
      port: 9994
    }
]

export const getTagColor = (tag) => {
  if (typeof tag !== 'string') return ['rgba(50,50,50, 0.5)', 'rgb(200,200,200)']

  const t = (tag ?? '').toLowerCase()

  if (t === 'utility') return ['rgba(135,85,35, 0.5)', 'rgb(255,195,135)']
  if (t === 'finance') return ['rgba(95,145,35,0.5)', 'rgb(115,255,115)']
  if (t === 'staking') return ['rgba(95,145,135,0.5)', 'rgb(115,255,195)']
  if (t === 'bridge') return ['rgba(195,195,135,0.5)', 'rgb(255,255,155)']
  if (t === 'swap') return ['rgba(155,205,75,0.5)', 'rgb(205,255,205)']

  return ['rgba(50,50,50, 0.5)', 'rgb(200,200,200)']
}
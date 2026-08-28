import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('PulseChain Dashboard render crash:', error, info)
    this.setState({ info })
  }

  render() {
    if (this.state.error) {
      const message = this.state.error?.stack || this.state.error?.message || String(this.state.error)
      const componentStack = this.state.info?.componentStack || ''
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0b0d0f',
          color: '#fff',
          padding: 32,
          boxSizing: 'border-box',
          fontFamily: 'monospace'
        }}>
          <h2 style={{ marginTop: 0 }}>Dashboard render error</h2>
          <p style={{ color: '#ff7878' }}>The app caught a renderer crash instead of showing a blank white screen.</p>
          <pre style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#15181c',
            padding: 16,
            borderRadius: 8,
            maxWidth: 1100
          }}>{message}{componentStack ? `\n\nComponent stack:${componentStack}` : ''}</pre>
          <p>Open DevTools → Console as well; the same error is logged there.</p>
        </div>
      )
    }

    return this.props.children
  }
}

window.addEventListener('error', event => {
  console.error('PulseChain Dashboard window error:', event.error || event.message)
})

window.addEventListener('unhandledrejection', event => {
  console.error('PulseChain Dashboard unhandled rejection:', event.reason)
})

document.documentElement.style.background = '#0b0d0f'
document.body.style.background = '#0b0d0f'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
)

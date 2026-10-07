import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Shows the real error on screen instead of a blank page
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#020610', color: '#FF3366', fontFamily: 'monospace', padding: 40 }}>
          <h2 style={{ marginBottom: 16 }}>EDITH hit an error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#e2e8f0', fontSize: 13 }}>{String(this.state.error?.stack || this.state.error)}</pre>
          <p style={{ marginTop: 16, color: 'rgba(255,255,255,0.5)' }}>Take a screenshot of this and send it over.</p>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
)

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.log(error);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
      <div style={{maxWidth: 700, margin: "auto"}}>
        <h1>Something went wrong with the PioreactorUI!</h1>
        <h3>Don't worry. It's our fault. Here's what you can do:</h3>
        <p> Looks like there's a bug in the UI. See the console (⌘+⌥+i) for error information. We would appreciate it
        if you create an issue in <a href="https://github.com/Pioreactor/pioreactorui/issues">Github</a> for us, with the information in the console (⌘+⌥+i).</p>
      </div>
      )
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;

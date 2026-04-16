import { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <h1>Something went wrong</h1>
                    <p>The app encountered an unexpected error.</p>
                    <details>
                        <summary>Error details</summary>
                        <pre>{this.state.error?.stack || this.state.error?.message || 'Unknown error'}</pre>
                    </details>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => window.location.reload()}
                    >
                        Restart App
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;

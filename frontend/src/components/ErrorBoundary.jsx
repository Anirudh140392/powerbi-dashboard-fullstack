import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Isolates a failing section of the UI.
 *
 * Errors thrown while rendering children are caught here instead of
 * propagating up and blanking the whole application.
 */
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error(
            `[ErrorBoundary] ${this.props.title || "Section"} crashed:`,
            error,
            errorInfo
        );
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="m-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
                    <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        <p className="font-semibold">
                            {this.props.title || "This section failed to load."}
                        </p>
                    </div>
                    <p className="mb-4 text-sm text-rose-600">
                        The rest of the application is unaffected.
                    </p>
                    <button
                        type="button"
                        onClick={this.handleRetry}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

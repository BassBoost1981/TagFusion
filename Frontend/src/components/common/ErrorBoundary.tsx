import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="h-full w-full flex items-center justify-center p-8">
                    <div className="glass rounded-2xl p-8 max-w-lg text-center">
                        {/* Error Icon */}
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle size={32} className="text-red-400" />
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-semibold text-slate-100 mb-3">
                            Etwas ist schiefgelaufen
                        </h2>

                        {/* Description */}
                        <p className="text-slate-400 mb-6 px-4">
                            Ein unerwarteter Fehler ist aufgetreten.
                            Dies kann an einer beschädigten Bilddatei oder einem Problem mit der Verbindung zum System liegen.
                        </p>

                        {/* Error Details (collapsed by default) */}
                        {this.state.error && (
                            <div className="mb-6 mx-4 text-left">
                                <details className="group">
                                    <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400 transition-colors flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                                        Technische Details anzeigen
                                    </summary>
                                    <div className="mt-3 p-4 rounded-xl bg-slate-900/80 border border-white/5 overflow-auto max-h-48 backdrop-blur-md">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Error Stack</span>
                                            <button
                                                onClick={() => {
                                                    const text = `${this.state.error?.message}\n\n${this.state.error?.stack}\n\n${this.state.errorInfo?.componentStack}`;
                                                    navigator.clipboard.writeText(text);
                                                }}
                                                className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                                            >
                                                Kopieren
                                            </button>
                                        </div>
                                        <code className="text-xs text-red-300/90 whitespace-pre-wrap font-mono leading-relaxed">
                                            {this.state.error.message}
                                            {this.state.error.stack && `\n\n${this.state.error.stack}`}
                                        </code>
                                    </div>
                                </details>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                onClick={this.handleReset}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all duration-300 font-medium"
                            >
                                <RefreshCw size={18} />
                                <span>Neu laden</span>
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 transition-all duration-300 border border-white/10"
                            >
                                App Neustarten
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

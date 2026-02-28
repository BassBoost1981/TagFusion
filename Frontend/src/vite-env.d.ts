/// <reference types="vite/client" />

interface Window {
  chrome?: {
    webview?: {
      postMessage: (message: string) => void;
      addEventListener: (type: string, listener: (event: { data: string }) => void) => void;
    };
  };
}

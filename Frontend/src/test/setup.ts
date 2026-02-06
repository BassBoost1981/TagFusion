import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock window.bridge for WebView2 communication
vi.stubGlobal('bridge', {
    invoke: vi.fn(),
    postMessage: vi.fn()
})

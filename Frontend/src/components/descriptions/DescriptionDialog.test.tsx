import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DescriptionDialog } from './DescriptionDialog';
import { useDescriptionStore } from '../../stores/descriptionStore';
import { useAppStore } from '../../stores/appStore';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getAiServerStatus: vi.fn(),
    getDescriptionPrecheck: vi.fn(),
    startDescriptionScan: vi.fn(),
    cancelDescriptionScan: vi.fn(),
    on: vi.fn(),
  },
}));

describe('DescriptionDialog', () => {
  beforeEach(() => {
    useAppStore.setState({ currentFolder: 'C:\\Test' });
    useDescriptionStore.setState({
      isDialogOpen: true,
      serverStatus: { reachable: true, state: 'idle', model: '', progress: -1, message: '', models: ['qwen', 'joycaption'], managedByApp: false },
      precheck: { total: 87, withDescription: 12 },
      isScanning: false,
      progress: null,
      selectedModel: 'qwen',
      promptText: 'Beschreibe',
      overwriteExisting: false,
    });
  });

  it('renders model choices, precheck info and start button', () => {
    render(<DescriptionDialog />);

    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText(/87/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /starten/i })).toBeInTheDocument();
  });

  it('disables start when the server is unreachable', () => {
    useDescriptionStore.setState({
      serverStatus: { reachable: false, state: 'unreachable', model: '', progress: -1, message: '', models: [], managedByApp: false },
      selectedModel: '',
    });
    render(<DescriptionDialog />);

    expect(screen.getByRole('button', { name: /starten/i })).toBeDisabled();
  });

  it('renders nothing when closed', () => {
    useDescriptionStore.setState({ isDialogOpen: false });
    const { container } = render(<DescriptionDialog />);
    expect(container.firstChild).toBeNull();
  });
});

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../../stores/appStore';
import { useFaceStore } from '../../stores/faceStore';
import { bridge } from '../../services/bridge';
import i18n from '../../i18n';

vi.mock('../../services/bridge', () => ({
  bridge: {
    getDrives: vi.fn(),
    getPersons: vi.fn(),
    searchImages: vi.fn(),
    on: vi.fn(() => () => {}),
  },
}));

describe('Sidebar persons section', () => {
  beforeAll(async () => {
    // Force German so translated headings are deterministic in assertions.
    // Deutsch erzwingen, damit übersetzte Überschriften deterministisch sind.
    await i18n.changeLanguage('de');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bridge.getDrives).mockResolvedValue([]);
    vi.mocked(bridge.searchImages).mockResolvedValue([]);
    useAppStore.setState({ searchQuery: '', isGlobalSearch: false, drives: [], favorites: [] });
    useFaceStore.setState({ persons: [] });
  });

  it('renders persons with their face counts', async () => {
    vi.mocked(bridge.getPersons).mockResolvedValue([
      { id: 1, name: 'Anna', faceCount: 5 },
      { id: 2, name: 'Ben', faceCount: 2 },
    ]);

    render(<Sidebar />);

    expect(await screen.findByText('Anna')).toBeInTheDocument();
    expect(screen.getByText('Personen')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Ben')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('runs the global search with the person name on click', async () => {
    vi.mocked(bridge.getPersons).mockResolvedValue([{ id: 1, name: 'Anna', faceCount: 5 }]);

    render(<Sidebar />);

    fireEvent.click(await screen.findByText('Anna'));

    expect(useAppStore.getState().searchQuery).toBe('Anna');
    await waitFor(() => {
      expect(bridge.searchImages).toHaveBeenCalledWith(['Anna'], undefined, 200);
    });
    expect(useAppStore.getState().isGlobalSearch).toBe(true);
  });

  it('hides the whole section when there are no persons', async () => {
    vi.mocked(bridge.getPersons).mockResolvedValue([]);

    render(<Sidebar />);

    await waitFor(() => expect(bridge.getPersons).toHaveBeenCalled());
    expect(screen.queryByText('Personen')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigurationRepository } from '../ConfigurationRepository';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userdata')
  }
}));

// Mock fs
vi.mock('fs', () => ({
  default: {},
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn()
  }
}));

describe('ConfigurationRepository Import/Export Basic', () => {
  let repository: ConfigurationRepository;

  beforeEach(() => {
    repository = new ConfigurationRepository();
    vi.clearAllMocks();
  });

  it('should create repository instance', () => {
    expect(repository).toBeDefined();
    expect(typeof repository.exportConfiguration).toBe('function');
    expect(typeof repository.importConfiguration).toBe('function');
    expect(typeof repository.validateImportFile).toBe('function');
  });

  it('should have correct interface methods', () => {
    expect(repository.exportConfiguration).toBeDefined();
    expect(repository.exportToFile).toBeDefined();
    expect(repository.importConfiguration).toBeDefined();
    expect(repository.importFromFile).toBeDefined();
    expect(repository.validateImportFile).toBeDefined();
  });
});
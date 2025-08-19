import React, { createContext, useContext, ReactNode } from 'react';
import { FileSystemService } from './FileSystemService';
import { MetadataService } from './MetadataService';
import { ConfigurationService } from './ConfigurationService';
import { ImageProcessorService } from './ImageProcessorService';
import { TagService, ITagService } from './TagService';

// Service interfaces
export interface IFileSystemService {
  getDrives(): Promise<any[]>;
  getDirectoryContents(path: string): Promise<any>;
}

export interface IMetadataService {
  readMetadata(filePath: string): Promise<any>;
  writeMetadata(filePath: string, metadata: any): Promise<void>;
}

export interface IConfigurationService {
  loadSettings(): Promise<any>;
  saveSettings(settings: any): Promise<void>;
}

export interface IImageProcessorService {
  generateThumbnail(filePath: string, size: number): Promise<string>;
}

// Services container
export interface Services {
  fileSystemService: IFileSystemService;
  metadataService: IMetadataService;
  configurationService: IConfigurationService;
  imageProcessorService: IImageProcessorService;
  tagService: ITagService;
}

// Create services instances
const services: Services = {
  fileSystemService: new FileSystemService(),
  metadataService: new MetadataService(),
  configurationService: new ConfigurationService(),
  imageProcessorService: new ImageProcessorService(),
  tagService: new TagService(),
};

// Create context
const DIContext = createContext<Services | null>(null);

// Provider component
interface DIContainerProps {
  children: ReactNode;
}

export const DIContainer: React.FC<DIContainerProps> = ({ children }) => {
  return (
    <DIContext.Provider value={services}>
      {children}
    </DIContext.Provider>
  );
};

// Hook to use services
export const useServices = (): Services => {
  const context = useContext(DIContext);
  if (!context) {
    throw new Error('useServices must be used within a DIContainer');
  }
  return context;
};
using System.Diagnostics;
using System.Drawing;
using System.IO;
using Microsoft.VisualBasic.FileIO;

namespace TagFusion.Services
{
    /// <summary>
    /// Service for file system operations (copy, move, delete, rename)
    /// </summary>
    public class FileOperationService
    {
        /// <summary>
        /// Copy files/folders to a target directory
        /// </summary>
        public bool CopyFiles(string[] sourcePaths, string targetFolder)
        {
            try
            {
                foreach (var sourcePath in sourcePaths)
                {
                    var name = Path.GetFileName(sourcePath);
                    var destPath = Path.Combine(targetFolder, name);
                    
                    // Handle name conflicts
                    destPath = GetUniqueDestPath(destPath);

                    if (Directory.Exists(sourcePath))
                    {
                        CopyDirectory(sourcePath, destPath);
                    }
                    else if (File.Exists(sourcePath))
                    {
                        File.Copy(sourcePath, destPath, false);
                    }
                }
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"CopyFiles error: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Move files/folders to a target directory
        /// </summary>
        public bool MoveFiles(string[] sourcePaths, string targetFolder)
        {
            try
            {
                foreach (var sourcePath in sourcePaths)
                {
                    var name = Path.GetFileName(sourcePath);
                    var destPath = Path.Combine(targetFolder, name);
                    
                    // Handle name conflicts
                    destPath = GetUniqueDestPath(destPath);

                    if (Directory.Exists(sourcePath))
                    {
                        Directory.Move(sourcePath, destPath);
                    }
                    else if (File.Exists(sourcePath))
                    {
                        File.Move(sourcePath, destPath);
                    }
                }
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"MoveFiles error: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Delete files/folders to recycle bin
        /// </summary>
        public bool DeleteFiles(string[] paths)
        {
            try
            {
                foreach (var path in paths)
                {
                    if (Directory.Exists(path))
                    {
                        FileSystem.DeleteDirectory(path, UIOption.OnlyErrorDialogs, RecycleOption.SendToRecycleBin);
                    }
                    else if (File.Exists(path))
                    {
                        FileSystem.DeleteFile(path, UIOption.OnlyErrorDialogs, RecycleOption.SendToRecycleBin);
                    }
                }
                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"DeleteFiles error: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Rename a file or folder
        /// </summary>
        public bool RenameFile(string path, string newName)
        {
            try
            {
                // Security: Prevent path traversal by ensuring newName doesn't contain separators
                if (newName.Contains(Path.DirectorySeparatorChar) || newName.Contains(Path.AltDirectorySeparatorChar))
                {
                    throw new ArgumentException("Invalid characters in new name", nameof(newName));
                }

                var directory = Path.GetDirectoryName(path);
                var newPath = Path.Combine(directory!, newName);
                
                // Final safety check: ensuring the new path is still in the same parent directory
                if (Path.GetDirectoryName(Path.GetFullPath(newPath)) != Path.GetDirectoryName(Path.GetFullPath(path)))
                {
                    throw new UnauthorizedAccessException("Path traversal attempt detected");
                }

                if (Directory.Exists(path))
                {
                    Directory.Move(path, newPath);
                }
                else if (File.Exists(path))
                {
                    File.Move(path, newPath);
                }
                else
                {
                    throw new FileNotFoundException("File or folder not found", path);
                }

                return true;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"RenameFile error: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Open file/folder in Windows Explorer
        /// </summary>
        public void OpenInExplorer(string path)
        {
            try
            {
                if (Directory.Exists(path))
                {
                    Process.Start("explorer.exe", path);
                }
                else if (File.Exists(path))
                {
                    // Select the file in explorer
                    Process.Start("explorer.exe", $"/select,\"{path}\"");
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"OpenInExplorer error: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Get file/folder properties
        /// </summary>
        public object GetProperties(string path)
        {
            try
            {
                if (Directory.Exists(path))
                {
                    var info = new DirectoryInfo(path);
                    return new
                    {
                        name = info.Name,
                        path = info.FullName,
                        size = 0L,
                        created = info.CreationTime.ToString("o"),
                        modified = info.LastWriteTime.ToString("o"),
                        isFolder = true
                    };
                }
                else if (File.Exists(path))
                {
                    var info = new FileInfo(path);
                    var result = new Dictionary<string, object>
                    {
                        ["name"] = info.Name,
                        ["path"] = info.FullName,
                        ["size"] = info.Length,
                        ["created"] = info.CreationTime.ToString("o"),
                        ["modified"] = info.LastWriteTime.ToString("o"),
                        ["isFolder"] = false
                    };

                    // Try to get image dimensions
                    try
                    {
                        var ext = info.Extension.ToLowerInvariant();
                        if (ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".bmp" || ext == ".webp")
                        {
                            using var img = Image.FromFile(path);
                            result["dimensions"] = new { width = img.Width, height = img.Height };
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[FileOps] Failed to read image dimensions: {ex.Message}");
                    }

                    return result;
                }
                else
                {
                    throw new FileNotFoundException("File or folder not found", path);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"GetProperties error: {ex.Message}");
                throw;
            }
        }

        #region Helpers

        private static string GetUniqueDestPath(string destPath)
        {
            if (!File.Exists(destPath) && !Directory.Exists(destPath))
                return destPath;

            var directory = Path.GetDirectoryName(destPath)!;
            var name = Path.GetFileNameWithoutExtension(destPath);
            var ext = Path.GetExtension(destPath);
            var counter = 1;

            while (File.Exists(destPath) || Directory.Exists(destPath))
            {
                destPath = Path.Combine(directory, $"{name} ({counter}){ext}");
                counter++;
            }

            return destPath;
        }

        private static void CopyDirectory(string sourceDir, string destDir)
        {
            Directory.CreateDirectory(destDir);

            foreach (var file in Directory.GetFiles(sourceDir))
            {
                var destFile = Path.Combine(destDir, Path.GetFileName(file));
                File.Copy(file, destFile, false);
            }

            foreach (var dir in Directory.GetDirectories(sourceDir))
            {
                var destSubDir = Path.Combine(destDir, Path.GetFileName(dir));
                CopyDirectory(dir, destSubDir);
            }
        }

        #endregion
    }
}

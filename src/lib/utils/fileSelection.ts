import type { FileDiff } from '$lib/types';

export interface SelectionFilterOptions {
  searchQuery?: string;
  fileExtensionFilter?: string;
  fileFilter?: 'all' | 'staged' | 'unstaged';
}

export interface ResolveSelectionParams {
  oldSelectedPath: string | null;
  oldSelectedIsStaged: boolean;
  previousFiles: FileDiff[];
  nextFiles: FileDiff[];
  searchQuery?: string;
  fileExtensionFilter?: string;
  fileFilter?: 'all' | 'staged' | 'unstaged';
}

export interface SelectionResult {
  selectedFilePath: string | null;
  selectedIsStaged: boolean;
}

export function getVisibleUnstagedFiles(
  files: FileDiff[],
  options: SelectionFilterOptions = {}
): FileDiff[] {
  const { searchQuery = '', fileExtensionFilter = 'all', fileFilter = 'all' } = options;
  if (fileFilter === 'staged') return [];
  const q = searchQuery.toLowerCase().trim();
  const ext = fileExtensionFilter.toLowerCase();
  return files.filter((file) => {
    if (file.is_staged) return false;
    if (q && !file.path.toLowerCase().includes(q)) return false;
    if (ext !== 'all' && !file.path.toLowerCase().endsWith(ext)) return false;
    return true;
  });
}

export function getVisibleStagedFiles(
  files: FileDiff[],
  options: SelectionFilterOptions = {}
): FileDiff[] {
  const { searchQuery = '', fileExtensionFilter = 'all', fileFilter = 'all' } = options;
  if (fileFilter === 'unstaged') return [];
  const q = searchQuery.toLowerCase().trim();
  const ext = fileExtensionFilter.toLowerCase();
  return files.filter((file) => {
    if (!file.is_staged) return false;
    if (q && !file.path.toLowerCase().includes(q)) return false;
    if (ext !== 'all' && !file.path.toLowerCase().endsWith(ext)) return false;
    return true;
  });
}

export function resolveNextFileSelection(params: ResolveSelectionParams): SelectionResult {
  const {
    oldSelectedPath,
    oldSelectedIsStaged,
    previousFiles,
    nextFiles,
    searchQuery = '',
    fileExtensionFilter = 'all',
    fileFilter = 'all',
  } = params;

  if (!nextFiles || nextFiles.length === 0) {
    return { selectedFilePath: null, selectedIsStaged: false };
  }

  const filterOpts: SelectionFilterOptions = { searchQuery, fileExtensionFilter, fileFilter };
  const nextVisibleUnstaged = getVisibleUnstagedFiles(nextFiles, filterOpts);
  const nextVisibleStaged = getVisibleStagedFiles(nextFiles, filterOpts);

  // 1. If currently selected file still exists in the same staged state in nextFiles:
  if (oldSelectedPath) {
    const stillExists = nextFiles.some(
      (f) => f.path === oldSelectedPath && f.is_staged === oldSelectedIsStaged
    );
    if (stillExists) {
      return {
        selectedFilePath: oldSelectedPath,
        selectedIsStaged: oldSelectedIsStaged,
      };
    }
  }

  // 2. If the previously selected file was UNSTAGED (e.g. it was just staged or discarded)
  if (oldSelectedPath && !oldSelectedIsStaged) {
    const prevVisibleUnstaged = getVisibleUnstagedFiles(previousFiles, filterOpts);
    const oldIndex = prevVisibleUnstaged.findIndex((f) => f.path === oldSelectedPath);

    // If there are still unstaged files visible in the file bar:
    if (nextVisibleUnstaged.length > 0) {
      const targetIndex = oldIndex >= 0 ? Math.min(oldIndex, nextVisibleUnstaged.length - 1) : 0;
      return {
        selectedFilePath: nextVisibleUnstaged[targetIndex].path,
        selectedIsStaged: false,
      };
    }

    // If no unstaged files can be staged (i.e. unstaged list is empty under active filter):
    // "if nothin file can be staged we should keep the focus for the current file"
    const existsAsStaged = nextFiles.some((f) => f.path === oldSelectedPath && f.is_staged);
    if (existsAsStaged) {
      return {
        selectedFilePath: oldSelectedPath,
        selectedIsStaged: true,
      };
    }

    // Fallback: If current file doesn't exist at all, pick first visible staged file or any next file
    if (nextVisibleStaged.length > 0) {
      return {
        selectedFilePath: nextVisibleStaged[0].path,
        selectedIsStaged: true,
      };
    }

    return {
      selectedFilePath: nextFiles[0].path,
      selectedIsStaged: nextFiles[0].is_staged,
    };
  }

  // 3. If the previously selected file was STAGED (e.g. it was un-staged or committed)
  if (oldSelectedPath && oldSelectedIsStaged) {
    const prevVisibleStaged = getVisibleStagedFiles(previousFiles, filterOpts);
    const oldIndex = prevVisibleStaged.findIndex((f) => f.path === oldSelectedPath);

    if (nextVisibleStaged.length > 0) {
      const targetIndex = oldIndex >= 0 ? Math.min(oldIndex, nextVisibleStaged.length - 1) : 0;
      return {
        selectedFilePath: nextVisibleStaged[targetIndex].path,
        selectedIsStaged: true,
      };
    }

    // Check if the current file now exists in nextFiles as unstaged:
    const existsAsUnstaged = nextFiles.some((f) => f.path === oldSelectedPath && !f.is_staged);
    if (existsAsUnstaged) {
      return {
        selectedFilePath: oldSelectedPath,
        selectedIsStaged: false,
      };
    }

    if (nextVisibleUnstaged.length > 0) {
      return {
        selectedFilePath: nextVisibleUnstaged[0].path,
        selectedIsStaged: false,
      };
    }

    return {
      selectedFilePath: nextFiles[0].path,
      selectedIsStaged: nextFiles[0].is_staged,
    };
  }

  // 4. Initial load or oldSelectedPath was null
  if (nextVisibleUnstaged.length > 0) {
    return {
      selectedFilePath: nextVisibleUnstaged[0].path,
      selectedIsStaged: false,
    };
  }
  if (nextVisibleStaged.length > 0) {
    return {
      selectedFilePath: nextVisibleStaged[0].path,
      selectedIsStaged: true,
    };
  }
  return {
    selectedFilePath: nextFiles[0].path,
    selectedIsStaged: nextFiles[0].is_staged,
  };
}

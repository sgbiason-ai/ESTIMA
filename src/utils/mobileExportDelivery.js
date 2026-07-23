import {
  FILE_TYPES,
  PICKER_IDS,
  saveFileWithPicker,
  shareFile,
} from './fileSaver';

const getFileSaveConfig = (filename = '') => {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith('.xlsx')) {
    return { types: FILE_TYPES.excel, pickerId: PICKER_IDS.exportExcel };
  }
  return { types: FILE_TYPES.pdf, pickerId: PICKER_IDS.exportPdf };
};

export const deliverMobileExport = async (fileData, share = false) => {
  const { blob, filename } = fileData || {};
  if (!(blob instanceof Blob) || !filename) {
    throw new Error('Le générateur n’a retourné aucun fichier exploitable.');
  }

  if (share) {
    return await shareFile(blob, filename, filename)
      ? 'shared'
      : 'cancelled';
  }

  const { types, pickerId } = getFileSaveConfig(filename);
  return await saveFileWithPicker(blob, filename, types, pickerId)
    ? 'downloaded'
    : 'cancelled';
};

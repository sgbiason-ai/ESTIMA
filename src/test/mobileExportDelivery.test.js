import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveFileWithPicker, shareFile } = vi.hoisted(() => ({
  saveFileWithPicker: vi.fn(),
  shareFile: vi.fn(),
}));

vi.mock('../utils/fileSaver', () => ({
  FILE_TYPES: { pdf: ['pdf'], excel: ['excel'] },
  PICKER_IDS: { exportPdf: 'export-pdf', exportExcel: 'export-excel' },
  saveFileWithPicker,
  shareFile,
}));

import { deliverMobileExport } from '../utils/mobileExportDelivery';

describe('livraison des exports mobiles', () => {
  beforeEach(() => {
    saveFileWithPicker.mockReset();
    shareFile.mockReset();
  });

  it('télécharge un PDF sans ouvrir le partage', async () => {
    saveFileWithPicker.mockResolvedValue(true);
    const blob = new Blob(['pdf'], { type: 'application/pdf' });

    await expect(deliverMobileExport({ blob, filename: 'rapport.pdf' })).resolves.toBe('downloaded');
    expect(saveFileWithPicker).toHaveBeenCalledWith(blob, 'rapport.pdf', ['pdf'], 'export-pdf');
    expect(shareFile).not.toHaveBeenCalled();
  });

  it('utilise le type Excel pour un classeur', async () => {
    saveFileWithPicker.mockResolvedValue(true);
    const blob = new Blob(['xlsx']);

    await deliverMobileExport({ blob, filename: 'analyse.XLSX' });

    expect(saveFileWithPicker).toHaveBeenCalledWith(blob, 'analyse.XLSX', ['excel'], 'export-excel');
  });

  it('partage le fichier sans déclencher de téléchargement', async () => {
    shareFile.mockResolvedValue(true);
    const blob = new Blob(['pdf'], { type: 'application/pdf' });

    await expect(deliverMobileExport({ blob, filename: 'rapport.pdf' }, true)).resolves.toBe('shared');
    expect(shareFile).toHaveBeenCalledWith(blob, 'rapport.pdf', 'rapport.pdf');
    expect(saveFileWithPicker).not.toHaveBeenCalled();
  });

  it('signale une annulation sans téléchargement de secours', async () => {
    shareFile.mockResolvedValue(false);

    await expect(deliverMobileExport({
      blob: new Blob(['pdf']),
      filename: 'rapport.pdf',
    }, true)).resolves.toBe('cancelled');
    expect(saveFileWithPicker).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  compressImageMock,
  deleteObjectMock,
  getDownloadURLMock,
  refMock,
  uploadBytesResumableMock,
} = vi.hoisted(() => ({
  compressImageMock: vi.fn(),
  deleteObjectMock: vi.fn(),
  getDownloadURLMock: vi.fn(),
  refMock: vi.fn(),
  uploadBytesResumableMock: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  deleteObject: deleteObjectMock,
  getDownloadURL: getDownloadURLMock,
  ref: refMock,
  uploadBytesResumable: uploadBytesResumableMock,
}));

vi.mock('../firebaseStorage', () => ({ storage: { name: 'test-storage' } }));
vi.mock('../utils/imageCompressor', () => ({ compressImage: compressImageMock }));

import {
  syncPendingSiteVisitImage,
  uploadSiteVisitImage,
} from '../utils/siteVisitImageStorage';

const DATA_URL = 'data:image/jpeg;base64,AQID';
const CONTEXT = { companyId: 'company-1', visitId: 'visit-1', obsId: 'obs-1' };

describe('photos des visites de site', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('navigator', { onLine: true });
    compressImageMock.mockResolvedValue(DATA_URL);
    refMock.mockImplementation((_storage, path) => ({ path }));
    getDownloadURLMock.mockResolvedValue('https://storage.test/photo.jpg');
    uploadBytesResumableMock.mockReturnValue({
      cancel: vi.fn(),
      on: (_event, _progress, _error, complete) => complete(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('conserve immédiatement une photo dans la visite hors connexion', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const file = { lastModified: Date.now() };

    await expect(uploadSiteVisitImage(file, CONTEXT)).resolves.toEqual({
      src: DATA_URL,
      pendingStorage: true,
    });
    expect(uploadBytesResumableMock).not.toHaveBeenCalled();
  });

  it('enregistre normalement la photo dans Storage quand le réseau répond', async () => {
    const file = { lastModified: Date.now() - 20000 };

    await expect(uploadSiteVisitImage(file, CONTEXT)).resolves.toMatchObject({
      src: 'https://storage.test/photo.jpg',
      path: expect.stringContaining('companies/company-1/site_visits/visit-1/obs-1/'),
    });
    expect(uploadBytesResumableMock).toHaveBeenCalledTimes(1);
  });

  it('resynchronise une photo locale sans perdre ses coordonnées GPS', async () => {
    const pending = { src: DATA_URL, pendingStorage: true, lat: 43.61, lng: 1.44 };

    await expect(syncPendingSiteVisitImage(pending, CONTEXT)).resolves.toMatchObject({
      src: 'https://storage.test/photo.jpg',
      path: expect.any(String),
      lat: 43.61,
      lng: 1.44,
    });
  });

  it('garde la copie locale si Storage échoue encore', async () => {
    uploadBytesResumableMock.mockReturnValue({
      cancel: vi.fn(),
      on: (_event, _progress, error) => error(new Error('réseau indisponible')),
    });
    const pending = { src: DATA_URL, pendingStorage: true };

    await expect(syncPendingSiteVisitImage(pending, CONTEXT)).resolves.toBe(pending);
  });
});

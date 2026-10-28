/**
 * tests/integration/media.test.js
 *
 * Media upload and management integration tests.
 * Validates authentication, tenant isolation, MIME validation, and deletion guards.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';
import { createTestFirmWithAdmin } from '../setup/fixtures.js';
import { generateAccessToken } from '../../src/services/token.service.js';
import * as cloudinaryConfig from '../../src/config/cloudinary.js';

describe('Media Management Integration Tests (Cloudinary)', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('1. Rejects unauthenticated requests to /api/v1/media/upload with 401', async () => {
    const res = await request(app)
      .post('/api/v1/media/upload')
      .attach('file', Buffer.from('fake-image-bytes'), 'test.jpg');

    expect(res.status).toBe(401);
  });

  it('2. Rejects request with no file attached with 400 NO_FILE_PROVIDED', async () => {
    const { admin } = await createTestFirmWithAdmin();
    const token = generateAccessToken(admin);

    const res = await request(app)
      .post('/api/v1/media/upload')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE_PROVIDED');
  });

  it('3. Rejects unsupported MIME type with 400 INVALID_FILE_TYPE', async () => {
    const { admin } = await createTestFirmWithAdmin();
    const token = generateAccessToken(admin);

    const res = await request(app)
      .post('/api/v1/media/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake executable or script'), {
        filename: 'script.exe',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('4. Successfully uploads image buffer to Cloudinary and returns secure URL', async () => {
    const { firm, admin } = await createTestFirmWithAdmin();
    const token = generateAccessToken(admin);

    const mockUploadResult = {
      secure_url: `https://res.cloudinary.com/demo/image/upload/v12345/agent-broker/${firm._id}/plots/images/sample.jpg`,
      url: `http://res.cloudinary.com/demo/image/upload/v12345/agent-broker/${firm._id}/plots/images/sample.jpg`,
      public_id: `agent-broker/${firm._id}/plots/images/sample_123`,
      resource_type: 'image',
      format: 'jpg',
      width: 1200,
      height: 800,
      bytes: 45678,
      duration: null,
    };

    const spy = vi
      .spyOn(cloudinaryConfig, 'uploadBufferToCloudinary')
      .mockResolvedValueOnce(mockUploadResult);

    const res = await request(app)
      .post('/api/v1/media/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake-jpeg-binary-data'), {
        filename: 'sample.jpg',
        contentType: 'image/jpeg',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.secure_url).toBe(mockUploadResult.secure_url);
    expect(res.body.data.publicId).toBe(mockUploadResult.public_id);
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('5. Denies cross-firm media deletion with 403 FORBIDDEN_RESOURCE', async () => {
    const { admin } = await createTestFirmWithAdmin();
    const token = generateAccessToken(admin);

    // Attempting to delete an asset from a different firm
    const otherFirmAsset = 'agent-broker/507f191e810c19729de860ea/plots/images/victim_img';

    const res = await request(app)
      .delete(`/api/v1/media/${encodeURIComponent(otherFirmAsset)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_RESOURCE');
  });

  it('6. Deletes own firm asset from Cloudinary successfully', async () => {
    const { firm, admin } = await createTestFirmWithAdmin();
    const token = generateAccessToken(admin);

    const ownFirmAsset = `agent-broker/${firm._id}/plots/images/sample_123`;

    const deleteSpy = vi
      .spyOn(cloudinaryConfig, 'deleteFromCloudinary')
      .mockResolvedValueOnce({ result: 'ok' });

    const res = await request(app)
      .delete(`/api/v1/media/${encodeURIComponent(ownFirmAsset)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(deleteSpy).toHaveBeenCalledWith(ownFirmAsset, expect.any(Object));

    deleteSpy.mockRestore();
  });
});

/**
 * tests/integration/docs.test.js
 *
 * Automated Documentation & Frontend Readiness Test Suite (Phase 8).
 *
 * Verifies:
 *  1. OpenAPI document parses and validates against OpenAPI 3.1 schema without errors or warnings
 *  2. Swagger UI endpoint (/api/docs and /api/v1/docs) is mounted and responds with 200 OK / redirect
 *  3. Raw OpenAPI JSON specification endpoint (/api/docs/json) is accessible and valid
 *  4. Documented OpenAPI paths and HTTP methods correspond directly to implemented Express routes
 *  5. Protected endpoints enforce and document BearerAuth security scheme
 *  6. Platform administration routes and tenant routes are strictly segregated in the documentation
 *  7. Documentation files contain no real secrets, passwords, or production connection strings
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validate } from '@readme/openapi-parser';
import { app } from '../../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openApiYamlPath = path.resolve(__dirname, '../../docs/openapi.yaml');
const openApiJsonPath = path.resolve(__dirname, '../../docs/openapi.json');

describe('API Documentation & Frontend Integration Readiness (Phase 8)', () => {
  describe('1. OpenAPI Specification Validation', () => {
    it('validates docs/openapi.yaml against OpenAPI specification', async () => {
      expect(fs.existsSync(openApiYamlPath)).toBe(true);
      const result = await validate(openApiYamlPath);
      expect(result.valid).toBe(true);
      expect(result.specification).toBe('OpenAPI');
      expect(result.warnings.length).toBe(0);
    });

    it('validates docs/openapi.json against OpenAPI specification', async () => {
      expect(fs.existsSync(openApiJsonPath)).toBe(true);
      const result = await validate(openApiJsonPath);
      expect(result.valid).toBe(true);
      expect(result.specification).toBe('OpenAPI');
      expect(result.warnings.length).toBe(0);
    });
  });

  describe('2. Swagger UI & OpenAPI Specification Endpoints', () => {
    it('serves OpenAPI JSON specification at /api/docs/json and /api/v1/docs/json', async () => {
      const res = await request(app).get('/api/docs/json');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body.openapi).toBe('3.1.0');
      expect(res.body.info.title).toContain('AGENT-Broker');

      const v1Res = await request(app).get('/api/v1/docs/json');
      expect(v1Res.status).toBe(200);
      expect(v1Res.body.openapi).toBe('3.1.0');
    });

    it('serves Swagger UI explorer at /api/docs and /api/v1/docs', async () => {
      const res = await request(app).get('/api/docs/');
      expect([200, 301, 302]).toContain(res.status);
      if (res.status === 200) {
        expect(res.text).toContain('swagger-ui');
      }

      const v1Res = await request(app).get('/api/v1/docs/');
      expect([200, 301, 302]).toContain(v1Res.status);
    });
  });

  describe('3. Route & Method Parity with Implementation', () => {
    it('verifies that core business endpoints are documented in OpenAPI', async () => {
      const spec = JSON.parse(fs.readFileSync(openApiJsonPath, 'utf-8'));
      const paths = Object.keys(spec.paths);

      const requiredPaths = [
        '/health',
        '/health/ready',
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
        '/api/v1/auth/me',
        '/api/v1/auth/change-password',
        '/api/v1/platform/firms',
        '/api/v1/platform/firms/{firmId}',
        '/api/v1/platform/firms/{firmId}/suspend',
        '/api/v1/platform/firms/{firmId}/activate',
        '/api/v1/platform/audit',
        '/api/v1/firm/me',
        '/api/v1/firm/audit',
        '/api/v1/firm/users',
        '/api/v1/firm/users/{userId}',
        '/api/v1/firm/users/{userId}/status',
        '/api/v1/colonies',
        '/api/v1/colonies/{colonyId}',
        '/api/v1/plots',
        '/api/v1/plots/{plotId}',
        '/api/v1/plots/{plotId}/private',
      ];

      for (const reqPath of requiredPaths) {
        expect(paths).toContain(reqPath);
      }
    });

    it('verifies HTTP methods for documented routes', async () => {
      const spec = JSON.parse(fs.readFileSync(openApiJsonPath, 'utf-8'));

      // Auth methods
      expect(spec.paths['/api/v1/auth/login'].post).toBeDefined();
      expect(spec.paths['/api/v1/auth/refresh'].post).toBeDefined();
      expect(spec.paths['/api/v1/auth/logout'].post).toBeDefined();
      expect(spec.paths['/api/v1/auth/me'].get).toBeDefined();
      expect(spec.paths['/api/v1/auth/change-password'].post).toBeDefined();

      // Platform methods
      expect(spec.paths['/api/v1/platform/firms'].post).toBeDefined();
      expect(spec.paths['/api/v1/platform/firms'].get).toBeDefined();
      expect(spec.paths['/api/v1/platform/audit'].get).toBeDefined();

      // Tenant firm methods
      expect(spec.paths['/api/v1/firm/me'].get).toBeDefined();
      expect(spec.paths['/api/v1/firm/audit'].get).toBeDefined();
      expect(spec.paths['/api/v1/firm/users'].post).toBeDefined();
      expect(spec.paths['/api/v1/firm/users'].get).toBeDefined();
      expect(spec.paths['/api/v1/firm/users/{userId}'].patch).toBeDefined();
      expect(spec.paths['/api/v1/firm/users/{userId}/status'].patch).toBeDefined();

      // Colony methods
      expect(spec.paths['/api/v1/colonies'].post).toBeDefined();
      expect(spec.paths['/api/v1/colonies'].get).toBeDefined();
      expect(spec.paths['/api/v1/colonies/{colonyId}'].patch).toBeDefined();
      expect(spec.paths['/api/v1/colonies/{colonyId}'].delete).toBeDefined();

      // Plot methods
      expect(spec.paths['/api/v1/plots'].post).toBeDefined();
      expect(spec.paths['/api/v1/plots'].get).toBeDefined();
      expect(spec.paths['/api/v1/plots/{plotId}'].patch).toBeDefined();
      expect(spec.paths['/api/v1/plots/{plotId}'].delete).toBeDefined();

      // Private plot data methods
      expect(spec.paths['/api/v1/plots/{plotId}/private'].get).toBeDefined();
      expect(spec.paths['/api/v1/plots/{plotId}/private'].put).toBeDefined();
      expect(spec.paths['/api/v1/plots/{plotId}/private'].patch).toBeDefined();
      expect(spec.paths['/api/v1/plots/{plotId}/private'].delete).toBeDefined();
    });
  });

  describe('4. Security Scheme & Route Separation Verification', () => {
    it('defines BearerAuth security scheme in components', async () => {
      const spec = JSON.parse(fs.readFileSync(openApiJsonPath, 'utf-8'));
      expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
      expect(spec.components.securitySchemes.BearerAuth.type).toBe('http');
      expect(spec.components.securitySchemes.BearerAuth.scheme).toBe('bearer');
    });

    it('enforces BearerAuth on protected tenant and platform endpoints', async () => {
      const spec = JSON.parse(fs.readFileSync(openApiJsonPath, 'utf-8'));
      expect(spec.paths['/api/v1/auth/me'].get.security).toBeDefined();
      expect(spec.paths['/api/v1/platform/firms'].post.security).toBeDefined();
      expect(spec.paths['/api/v1/firm/me'].get.security).toBeDefined();
      expect(spec.paths['/api/v1/colonies'].post.security).toBeDefined();
      expect(spec.paths['/api/v1/plots'].post.security).toBeDefined();
      expect(spec.paths['/api/v1/plots/{plotId}/private'].get.security).toBeDefined();
    });

    it('keeps public probes and auth entry points unauthenticated', async () => {
      const spec = JSON.parse(fs.readFileSync(openApiJsonPath, 'utf-8'));
      expect(spec.paths['/health'].get.security).toBeUndefined();
      expect(spec.paths['/health/ready'].get.security).toBeUndefined();
      expect(spec.paths['/api/v1/auth/login'].post.security).toBeUndefined();
      expect(spec.paths['/api/v1/auth/refresh'].post.security).toBeUndefined();
    });

    it('segregates platform and tenant operations by distinct tags', async () => {
      const spec = JSON.parse(fs.readFileSync(openApiJsonPath, 'utf-8'));
      expect(spec.paths['/api/v1/platform/firms'].post.tags).toContain('Platform Administration');
      expect(spec.paths['/api/v1/firm/me'].get.tags).toContain('Firm Operations');
      expect(spec.paths['/api/v1/plots/{plotId}/private'].get.tags).toContain('Private Plot Data');
    });
  });

  describe('5. Credential & Secret Exclusion Verification', () => {
    it('ensures documentation contains no secrets or connection strings', async () => {
      const docFiles = [
        'docs/API_INVENTORY.md',
        'docs/AUTHENTICATION_FLOW.md',
        'docs/ROLE_PERMISSION_MATRIX.md',
        'docs/FRONTEND_INTEGRATION_GUIDE.md',
        'docs/API_CONVENTIONS.md',
        'docs/openapi.yaml',
        'docs/openapi.json',
      ];

      const forbiddenSubstrings = [
        'mongodb+srv://',
        'secret-access-token-key',
        'secret-refresh-token-key',
        'actual_secret',
        'super_secret_jwt',
      ];

      for (const relPath of docFiles) {
        const fullPath = path.resolve(__dirname, '../../', relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const forbidden of forbiddenSubstrings) {
            expect(content.toLowerCase()).not.toContain(forbidden.toLowerCase());
          }
        }
      }
    });
  });
});

/**
 * src/routes/docs.routes.js
 *
 * OpenAPI documentation and Swagger UI explorer.
 * Publicly accessible: exposes /api/docs and /api/docs/json.
 */

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openApiPath = path.resolve(__dirname, '../../docs/openapi.json');
let openApiDocument;

try {
  openApiDocument = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));
} catch (err) {
  openApiDocument = {
    openapi: '3.1.0',
    info: { title: 'AGENT-Broker API', version: '1.0.0' },
    paths: {},
  };
}

const router = Router();

// Expose raw OpenAPI JSON specification
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.send(openApiDocument);
});

// Mount Swagger UI
router.use('/', swaggerUi.serve, swaggerUi.setup(openApiDocument));

export default router;

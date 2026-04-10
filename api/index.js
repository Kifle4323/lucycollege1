const serverless = require('serverless-http');
require('express-async-errors');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');

// Load environment variables
dotenv.config();

// Import routes from compiled dist
const { registerAuthRoutes } = require('../apps/api/dist/routes/authRoutes');
const { registerCourseRoutes } = require('../apps/api/dist/routes/courseRoutes');
const { registerAssessmentRoutes } = require('../apps/api/dist/routes/assessmentRoutes');
const { registerClassRoutes } = require('../apps/api/dist/routes/classRoutes');
const { registerMaterialRoutes } = require('../apps/api/dist/routes/materialRoutes');
const { registerLiveSessionRoutes } = require('../apps/api/dist/routes/liveSessionRoutes');
const { registerGradebookRoutes } = require('../apps/api/dist/routes/gradebookRoutes');
const { registerFaceVerificationRoutes } = require('../apps/api/dist/routes/faceVerificationRoutes');
const { registerStudentProfileRoutes } = require('../apps/api/dist/routes/studentProfileRoutes');
const { registerNotificationRoutes } = require('../apps/api/dist/routes/notificationRoutes');

const app = express();

// Parse CORS origins from env (comma-separated)
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : true;

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));

const router = express.Router();
registerAuthRoutes(router);
registerCourseRoutes(router);
registerAssessmentRoutes(router);
registerClassRoutes(router);
registerMaterialRoutes(router);
registerLiveSessionRoutes(router);
registerGradebookRoutes(router);
registerFaceVerificationRoutes(router);
registerStudentProfileRoutes(router);
registerNotificationRoutes(router);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api', router);

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  const message = err instanceof Error ? err.message : 'internal_error';
  res.status(500).json({ error: 'internal_error', message });
});

module.exports = serverless(app);

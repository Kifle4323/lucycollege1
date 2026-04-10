"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const authRoutes_js_1 = require("./routes/authRoutes.js");
const courseRoutes_js_1 = require("./routes/courseRoutes.js");
const assessmentRoutes_js_1 = require("./routes/assessmentRoutes.js");
const classRoutes_js_1 = require("./routes/classRoutes.js");
const materialRoutes_js_1 = require("./routes/materialRoutes.js");
const liveSessionRoutes_js_1 = require("./routes/liveSessionRoutes.js");
const gradebookRoutes_js_1 = require("./routes/gradebookRoutes.js");
const faceVerificationRoutes_js_1 = require("./routes/faceVerificationRoutes.js");
const studentProfileRoutes_js_1 = require("./routes/studentProfileRoutes.js");
const notificationRoutes_js_1 = require("./routes/notificationRoutes.js");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Parse CORS origins from env (comma-separated)
const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : true;
app.use((0, cors_1.default)({
    origin: corsOrigins,
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' })); // Increased for document uploads
const router = express_1.default.Router();
(0, authRoutes_js_1.registerAuthRoutes)(router);
(0, courseRoutes_js_1.registerCourseRoutes)(router);
(0, assessmentRoutes_js_1.registerAssessmentRoutes)(router);
(0, classRoutes_js_1.registerClassRoutes)(router);
(0, materialRoutes_js_1.registerMaterialRoutes)(router);
(0, liveSessionRoutes_js_1.registerLiveSessionRoutes)(router);
(0, gradebookRoutes_js_1.registerGradebookRoutes)(router);
(0, faceVerificationRoutes_js_1.registerFaceVerificationRoutes)(router);
(0, studentProfileRoutes_js_1.registerStudentProfileRoutes)(router);
(0, notificationRoutes_js_1.registerNotificationRoutes)(router);
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.use('/api', router);
app.use((err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : 'internal_error';
    res.status(500).json({ error: 'internal_error', message });
});
exports.default = app;

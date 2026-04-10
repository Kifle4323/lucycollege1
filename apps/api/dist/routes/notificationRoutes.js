"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerNotificationRoutes = registerNotificationRoutes;
const db_js_1 = require("../db.js");
const middleware_js_1 = require("../middleware.js");
function registerNotificationRoutes(router) {
    // Get notification counts for admin
    router.get('/admin/notifications', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        // Count pending face verifications (not yet reviewed by admin)
        const pendingFaceVerifications = await db_js_1.prisma.faceVerification.count({
            where: { adminReviewed: false },
        });
        // Count pending student profiles
        const pendingStudentProfiles = await db_js_1.prisma.studentProfile.count({
            where: { status: 'PENDING_APPROVAL' },
        });
        // Count pending user approvals
        const pendingUsers = await db_js_1.prisma.user.count({
            where: { isApproved: false },
        });
        res.json({
            faceVerifications: pendingFaceVerifications,
            studentProfiles: pendingStudentProfiles,
            pendingUsers: pendingUsers,
            total: pendingFaceVerifications + pendingStudentProfiles + pendingUsers,
        });
    });
    // Mark face verifications as seen (when admin visits the page)
    router.post('/admin/notifications/seen/face-verifications', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (_req, res) => {
        // We don't actually mark them as seen - the count just updates naturally
        // This endpoint exists for future extensibility (e.g., storing last seen timestamp)
        res.json({ success: true });
    });
    // Mark student profiles as seen
    router.post('/admin/notifications/seen/student-profiles', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (_req, res) => {
        res.json({ success: true });
    });
    // Mark pending users as seen
    router.post('/admin/notifications/seen/pending-users', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (_req, res) => {
        res.json({ success: true });
    });
}

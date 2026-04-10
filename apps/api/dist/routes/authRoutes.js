"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthRoutes = registerAuthRoutes;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const db_js_1 = require("../db.js");
const auth_js_1 = require("../auth.js");
const middleware_js_1 = require("../middleware.js");
function registerAuthRoutes(router) {
    // Public registration - only STUDENT and TEACHER allowed
    router.post('/auth/register', async (req, res) => {
        const body = zod_1.z
            .object({
            email: zod_1.z.string().email(),
            password: zod_1.z.string().min(6),
            fullName: zod_1.z.string().min(2),
            role: zod_1.z.enum(['STUDENT', 'TEACHER']).optional(),
        })
            .parse(req.body);
        // Check if email already exists
        const existing = await db_js_1.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
        if (existing) {
            res.status(400).json({ error: 'email_exists', message: 'Email already registered' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(body.password, 10);
        const user = await db_js_1.prisma.user.create({
            data: {
                email: body.email.toLowerCase(),
                passwordHash,
                fullName: body.fullName,
                role: body.role ?? 'STUDENT',
                isApproved: false, // Requires admin approval
            },
            select: { id: true, email: true, fullName: true, role: true, isApproved: true, createdAt: true },
        });
        res.json({ ...user, message: 'Account created successfully. Please wait for admin approval.' });
    });
    // Admin creates user - auto-approved
    router.post('/admin/users', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const body = zod_1.z
            .object({
            email: zod_1.z.string().email(),
            password: zod_1.z.string().min(6),
            fullName: zod_1.z.string().min(2),
            role: zod_1.z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
        })
            .parse(req.body);
        // Check if email already exists
        const existing = await db_js_1.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
        if (existing) {
            res.status(400).json({ error: 'email_exists', message: 'Email already registered' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(body.password, 10);
        const user = await db_js_1.prisma.user.create({
            data: {
                email: body.email.toLowerCase(),
                passwordHash,
                fullName: body.fullName,
                role: body.role,
                isProfileComplete: true, // Admin created, so profile is complete
                isApproved: true, // Admin created, so auto-approved
            },
            select: { id: true, email: true, fullName: true, role: true, isApproved: true, createdAt: true },
        });
        res.json(user);
    });
    router.post('/auth/login', async (req, res) => {
        const body = zod_1.z.object({ email: zod_1.z.string().email(), password: zod_1.z.string().min(1) }).parse(req.body);
        const user = await db_js_1.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
        if (!user) {
            res.status(401).json({ error: 'invalid_credentials' });
            return;
        }
        const ok = await bcryptjs_1.default.compare(body.password, user.passwordHash);
        if (!ok) {
            res.status(401).json({ error: 'invalid_credentials' });
            return;
        }
        // Check if account is approved (admins are always approved)
        if (user.role !== 'ADMIN' && !user.isApproved) {
            res.status(403).json({ error: 'account_pending', message: 'Your account is pending admin approval. Please try again later.' });
            return;
        }
        const payload = { sub: user.id, role: user.role };
        const accessToken = (0, auth_js_1.signAccessToken)(payload);
        const refreshToken = (0, auth_js_1.signRefreshToken)(payload);
        res.json({
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isProfileComplete: user.isProfileComplete, profileImage: user.profileImage },
        });
    });
    // Admin: Get pending users
    router.get('/admin/pending-users', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (_req, res) => {
        const users = await db_js_1.prisma.user.findMany({
            where: { isApproved: false },
            select: { id: true, email: true, fullName: true, role: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    });
    // Admin: Approve user
    router.post('/admin/users/:userId/approve', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ userId: zod_1.z.string() }).parse(req.params);
        const user = await db_js_1.prisma.user.update({
            where: { id: params.userId },
            data: { isApproved: true },
            select: { id: true, email: true, fullName: true, role: true, isApproved: true },
        });
        res.json(user);
    });
    // Admin: Reject/Delete user
    router.delete('/admin/users/:userId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ userId: zod_1.z.string() }).parse(req.params);
        await db_js_1.prisma.user.delete({
            where: { id: params.userId },
        });
        res.json({ success: true });
    });
    router.get('/me', middleware_js_1.authRequired, async (req, res) => {
        const id = req.user.id;
        const user = await db_js_1.prisma.user.findUnique({
            where: { id },
            select: { id: true, email: true, fullName: true, role: true, isProfileComplete: true, profileImage: true, isApproved: true, createdAt: true },
        });
        res.json(user);
    });
    // Change password
    router.post('/me/change-password', middleware_js_1.authRequired, async (req, res) => {
        const body = zod_1.z
            .object({
            currentPassword: zod_1.z.string().min(1),
            newPassword: zod_1.z.string().min(6),
        })
            .parse(req.body);
        const user = await db_js_1.prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            res.status(404).json({ error: 'user_not_found' });
            return;
        }
        // Verify current password
        const ok = await bcryptjs_1.default.compare(body.currentPassword, user.passwordHash);
        if (!ok) {
            res.status(400).json({ error: 'invalid_password', message: 'Current password is incorrect' });
            return;
        }
        // Hash new password
        const passwordHash = await bcryptjs_1.default.hash(body.newPassword, 10);
        await db_js_1.prisma.user.update({
            where: { id: req.user.id },
            data: { passwordHash },
        });
        res.json({ success: true, message: 'Password changed successfully' });
    });
}

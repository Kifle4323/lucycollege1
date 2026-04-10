"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLiveSessionRoutes = registerLiveSessionRoutes;
const zod_1 = require("zod");
const db_js_1 = require("../db.js");
const middleware_js_1 = require("../middleware.js");
// Generate a unique Jitsi meeting room name
function generateMeetingRoom(title) {
    const randomId = Math.random().toString(36).substring(2, 8);
    const sanitized = title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
    return `edulms-${sanitized}-${randomId}`;
}
function registerLiveSessionRoutes(router) {
    // Get live sessions for a course
    router.get('/courses/:courseId/live-sessions', middleware_js_1.authRequired, async (req, res) => {
        const params = zod_1.z.object({ courseId: zod_1.z.string() }).parse(req.params);
        const user = req.user;
        // Check access
        if (user.role === 'ADMIN') {
            const sessions = await db_js_1.prisma.liveSession.findMany({
                where: { courseId: params.courseId },
                include: { teacher: { select: { id: true, fullName: true, email: true } }, class: true },
                orderBy: { scheduledAt: 'asc' },
            });
            res.json(sessions);
            return;
        }
        if (user.role === 'TEACHER') {
            // Teacher sees sessions they created for courses they teach
            const sessions = await db_js_1.prisma.liveSession.findMany({
                where: { courseId: params.courseId, teacherId: user.id },
                include: { teacher: { select: { id: true, fullName: true, email: true } }, class: true },
                orderBy: { scheduledAt: 'asc' },
            });
            res.json(sessions);
            return;
        }
        // Student sees sessions for classes they're enrolled in
        const sessions = await db_js_1.prisma.liveSession.findMany({
            where: {
                courseId: params.courseId,
                class: { students: { some: { studentId: user.id } } },
            },
            include: { teacher: { select: { id: true, fullName: true, email: true } }, class: true },
            orderBy: { scheduledAt: 'asc' },
        });
        res.json(sessions);
    });
    // Get live sessions for a class (for students/teachers)
    router.get('/classes/:classId/live-sessions', middleware_js_1.authRequired, async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string() }).parse(req.params);
        const user = req.user;
        const sessions = await db_js_1.prisma.liveSession.findMany({
            where: { classId: params.classId },
            include: {
                teacher: { select: { id: true, fullName: true, email: true } },
                course: true,
                class: true,
            },
            orderBy: { scheduledAt: 'asc' },
        });
        res.json(sessions);
    });
    // Get all upcoming live sessions for current user - MUST be before /live-sessions/:sessionId
    router.get('/live-sessions/upcoming', middleware_js_1.authRequired, async (req, res) => {
        const user = req.user;
        console.log('Fetching sessions for user:', user.id, 'role:', user.role);
        if (user.role === 'ADMIN') {
            const sessions = await db_js_1.prisma.liveSession.findMany({
                where: { status: { in: ['SCHEDULED', 'LIVE'] } },
                include: { teacher: { select: { id: true, fullName: true, email: true } }, course: true, class: true },
                orderBy: { scheduledAt: 'asc' },
                take: 50,
            });
            console.log('Found sessions (admin):', sessions.length);
            res.json(sessions);
            return;
        }
        if (user.role === 'TEACHER') {
            const sessions = await db_js_1.prisma.liveSession.findMany({
                where: { teacherId: user.id, status: { in: ['SCHEDULED', 'LIVE'] } },
                include: { teacher: { select: { id: true, fullName: true, email: true } }, course: true, class: true },
                orderBy: { scheduledAt: 'asc' },
                take: 50,
            });
            console.log('Found sessions (teacher):', sessions.length, 'for teacher:', user.id);
            res.json(sessions);
            return;
        }
        // Student - show all scheduled and live sessions for their classes
        const sessions = await db_js_1.prisma.liveSession.findMany({
            where: {
                class: { students: { some: { studentId: user.id } } },
                status: { in: ['SCHEDULED', 'LIVE'] },
            },
            include: { teacher: { select: { id: true, fullName: true, email: true } }, course: true, class: true },
            orderBy: { scheduledAt: 'asc' },
            take: 50,
        });
        console.log('Found sessions (student):', sessions.length);
        res.json(sessions);
    });
    // Get a single live session by ID
    router.get('/live-sessions/:sessionId', middleware_js_1.authRequired, async (req, res) => {
        const params = zod_1.z.object({ sessionId: zod_1.z.string() }).parse(req.params);
        const user = req.user;
        const session = await db_js_1.prisma.liveSession.findUnique({
            where: { id: params.sessionId },
            include: {
                teacher: { select: { id: true, fullName: true, email: true } },
                course: true,
                class: true,
            },
        });
        if (!session) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Check access
        if (user.role === 'ADMIN') {
            res.json(session);
            return;
        }
        if (user.role === 'TEACHER') {
            if (session.teacherId === user.id) {
                res.json(session);
                return;
            }
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        // Student - must be in the class
        const enrollment = await db_js_1.prisma.classStudent.findUnique({
            where: { classId_studentId: { classId: session.classId, studentId: user.id } },
        });
        if (enrollment) {
            res.json(session);
            return;
        }
        res.status(403).json({ error: 'forbidden' });
    });
    // Create a live session (Teacher only)
    router.post('/courses/:courseId/live-sessions', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ courseId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            classId: zod_1.z.string(),
            title: zod_1.z.string().min(2),
            description: zod_1.z.string().optional(),
            scheduledAt: zod_1.z.string(),
            duration: zod_1.z.number().int().min(15).max(480),
        }).parse(req.body);
        const user = req.user;
        // Verify teacher teaches this course in this class
        const courseClass = await db_js_1.prisma.courseClass.findFirst({
            where: { courseId: params.courseId, classId: body.classId, teacherId: user.id },
        });
        if (!courseClass) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const meetingRoom = generateMeetingRoom(body.title);
        const meetingUrl = `https://meet.jit.si/${meetingRoom}`;
        const session = await db_js_1.prisma.liveSession.create({
            data: {
                courseId: params.courseId,
                classId: body.classId,
                teacherId: user.id,
                title: body.title,
                description: body.description,
                scheduledAt: new Date(body.scheduledAt),
                duration: body.duration,
                meetingUrl,
                status: 'SCHEDULED',
            },
            include: {
                teacher: { select: { id: true, fullName: true, email: true } },
                course: true,
                class: true,
            },
        });
        res.json(session);
    });
    // Update live session status (Teacher only)
    router.patch('/live-sessions/:sessionId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ sessionId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            status: zod_1.z.enum(['SCHEDULED', 'LIVE', 'ENDED']).optional(),
            title: zod_1.z.string().min(2).optional(),
            description: zod_1.z.string().optional(),
            scheduledAt: zod_1.z.string().optional(),
            duration: zod_1.z.number().int().min(15).max(480).optional(),
        }).parse(req.body);
        const user = req.user;
        const session = await db_js_1.prisma.liveSession.findUnique({ where: { id: params.sessionId } });
        if (!session) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        if (session.teacherId !== user.id) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const updated = await db_js_1.prisma.liveSession.update({
            where: { id: params.sessionId },
            data: {
                ...body,
                scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
            },
            include: {
                teacher: { select: { id: true, fullName: true, email: true } },
                course: true,
                class: true,
            },
        });
        res.json(updated);
    });
    // Delete live session (Teacher only)
    router.delete('/live-sessions/:sessionId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ sessionId: zod_1.z.string() }).parse(req.params);
        const user = req.user;
        const session = await db_js_1.prisma.liveSession.findUnique({ where: { id: params.sessionId } });
        if (!session) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        if (session.teacherId !== user.id) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        await db_js_1.prisma.liveSession.delete({ where: { id: params.sessionId } });
        res.json({ success: true });
    });
}

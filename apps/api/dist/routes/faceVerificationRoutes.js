"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFaceVerificationRoutes = registerFaceVerificationRoutes;
const zod_1 = require("zod");
const db_js_1 = require("../db.js");
const middleware_js_1 = require("../middleware.js");
function registerFaceVerificationRoutes(router) {
    // All users: Update profile with image
    router.patch('/users/me/profile', middleware_js_1.authRequired, async (req, res) => {
        const body = zod_1.z.object({
            fullName: zod_1.z.string().min(2).optional(),
            profileImage: zod_1.z.string().optional(), // Base64 encoded image
        }).parse(req.body);
        const user = await db_js_1.prisma.user.update({
            where: { id: req.user.id },
            data: {
                fullName: body.fullName,
                profileImage: body.profileImage,
                ...(body.profileImage ? { isProfileComplete: true } : {}),
            },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                profileImage: true,
                isProfileComplete: true,
            },
        });
        res.json(user);
    });
    // Student: Get own profile status
    router.get('/users/me/profile-status', middleware_js_1.authRequired, async (req, res) => {
        const user = await db_js_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                fullName: true,
                profileImage: true,
                isProfileComplete: true,
            },
        });
        res.json(user);
    });
    // Admin: Get all students with profile status
    router.get('/admin/students-profiles', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const students = await db_js_1.prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: {
                id: true,
                email: true,
                fullName: true,
                profileImage: true,
                isProfileComplete: true,
                createdAt: true,
                classStudents: {
                    include: {
                        class: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(students);
    });
    // Admin: Get pending face verifications
    router.get('/admin/face-verifications/pending', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const verifications = await db_js_1.prisma.faceVerification.findMany({
            where: {
                matchResult: false,
                adminReviewed: false,
            },
            include: {
                student: {
                    select: { id: true, fullName: true, email: true, profileImage: true },
                },
                attempt: {
                    include: {
                        assessment: {
                            select: { id: true, title: true, examType: true, course: { select: { title: true } } },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(verifications);
    });
    // Admin: Get all face verifications (with filters)
    router.get('/admin/face-verifications', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const query = zod_1.z.object({
            status: zod_1.z.enum(['pending', 'approved', 'rejected', 'matched']).optional(),
        }).parse(req.query);
        const where = {};
        if (query.status === 'pending') {
            where.matchResult = false;
            where.adminReviewed = false;
        }
        else if (query.status === 'approved') {
            where.matchResult = false;
            where.adminReviewed = true;
            where.adminApproved = true;
        }
        else if (query.status === 'rejected') {
            where.matchResult = false;
            where.adminReviewed = true;
            where.adminApproved = false;
        }
        else if (query.status === 'matched') {
            where.matchResult = true;
        }
        const verifications = await db_js_1.prisma.faceVerification.findMany({
            where,
            include: {
                student: {
                    select: { id: true, fullName: true, email: true, profileImage: true },
                },
                attempt: {
                    include: {
                        assessment: {
                            select: { id: true, title: true, examType: true, course: { select: { title: true } } },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(verifications);
    });
    // Admin: Approve or reject face verification
    router.post('/admin/face-verifications/:id/review', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ id: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            approved: zod_1.z.boolean(),
        }).parse(req.body);
        const verification = await db_js_1.prisma.faceVerification.findUnique({
            where: { id: params.id },
            include: { attempt: true },
        });
        if (!verification) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Update verification and attempt
        const [updated] = await db_js_1.prisma.$transaction([
            db_js_1.prisma.faceVerification.update({
                where: { id: params.id },
                data: {
                    adminReviewed: true,
                    adminApproved: body.approved,
                    adminId: req.user.id,
                    reviewedAt: new Date(),
                },
                include: {
                    student: { select: { id: true, fullName: true, email: true } },
                    attempt: { include: { assessment: { select: { title: true } } } },
                },
            }),
            db_js_1.prisma.attempt.update({
                where: { id: verification.attemptId },
                data: {
                    faceVerified: body.approved,
                    faceVerifiedAt: body.approved ? new Date() : null,
                },
            }),
        ]);
        res.json(updated);
    });
    // Teacher: Get attempts with face verification status for grading
    router.get('/assessments/:assessmentId/attempts-for-grading', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ assessmentId: zod_1.z.string() }).parse(req.params);
        const assessment = await db_js_1.prisma.assessment.findUnique({
            where: { id: params.assessmentId },
            include: { course: { include: { courseClasses: true } } },
        });
        if (!assessment) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Check if teacher is assigned to this course
        const courseClass = assessment.course.courseClasses.find((cc) => cc.teacherId === req.user.id);
        if (!courseClass) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const attempts = await db_js_1.prisma.attempt.findMany({
            where: { assessmentId: params.assessmentId, status: 'SUBMITTED' },
            include: {
                student: { select: { id: true, fullName: true, email: true, profileImage: true } },
                faceVerification: true,
                answers: {
                    include: { question: true },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
        res.json(attempts);
    });
    // Internal: Create or update face verification record
    router.post('/face-verifications', middleware_js_1.authRequired, async (req, res) => {
        const body = zod_1.z.object({
            attemptId: zod_1.z.string(),
            capturedImage: zod_1.z.string(),
            matchResult: zod_1.z.boolean(),
        }).parse(req.body);
        // Verify the attempt belongs to this student
        const attempt = await db_js_1.prisma.attempt.findFirst({
            where: { id: body.attemptId, studentId: req.user.id },
        });
        if (!attempt) {
            res.status(404).json({ error: 'attempt_not_found' });
            return;
        }
        // Get student's profile image for reference
        const student = await db_js_1.prisma.user.findUnique({
            where: { id: req.user.id },
            select: { profileImage: true },
        });
        // Use upsert to create or update the verification record
        const verification = await db_js_1.prisma.faceVerification.upsert({
            where: { attemptId: body.attemptId },
            create: {
                attemptId: body.attemptId,
                studentId: req.user.id,
                capturedImage: body.capturedImage,
                matchedImage: student?.profileImage,
                matchResult: body.matchResult,
            },
            update: {
                capturedImage: body.capturedImage,
                matchResult: body.matchResult,
            },
        });
        res.json(verification);
    });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStudentProfileRoutes = registerStudentProfileRoutes;
const zod_1 = require("zod");
const db_js_1 = require("../db.js");
const middleware_js_1 = require("../middleware.js");
function registerStudentProfileRoutes(router) {
    // === STUDENT ROUTES ===
    // Get own profile
    router.get('/student/profile', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['STUDENT']), async (req, res) => {
        const profile = await db_js_1.prisma.studentProfile.findUnique({
            where: { userId: req.user.id },
            include: { documents: true },
        });
        if (!profile) {
            // Create empty profile if doesn't exist
            const newProfile = await db_js_1.prisma.studentProfile.create({
                data: { userId: req.user.id },
                include: { documents: true },
            });
            res.json(newProfile);
            return;
        }
        res.json(profile);
    });
    // Save profile (draft or submit for approval)
    router.patch('/student/profile', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['STUDENT']), async (req, res) => {
        const body = zod_1.z.object({
            // Basic Information
            firstName: zod_1.z.string().optional(),
            fatherName: zod_1.z.string().optional(),
            grandFatherName: zod_1.z.string().optional(),
            firstNameLocal: zod_1.z.string().optional(),
            fatherNameLocal: zod_1.z.string().optional(),
            grandFatherNameLocal: zod_1.z.string().optional(),
            dateOfBirthGC: zod_1.z.string().optional(),
            gender: zod_1.z.string().optional(),
            placeOfBirth: zod_1.z.string().optional(),
            motherTongue: zod_1.z.string().optional(),
            healthStatus: zod_1.z.string().optional(),
            maritalStatus: zod_1.z.string().optional(),
            nationalIdFan: zod_1.z.string().optional(),
            // Location and Address
            citizenship: zod_1.z.string().optional(),
            country: zod_1.z.string().optional(),
            city: zod_1.z.string().optional(),
            subCity: zod_1.z.string().optional(),
            kebele: zod_1.z.string().optional(),
            woreda: zod_1.z.string().optional(),
            houseNumber: zod_1.z.string().optional(),
            phone: zod_1.z.string().optional(),
            email: zod_1.z.string().optional(),
            pobox: zod_1.z.string().optional(),
            // Others
            economicalStatus: zod_1.z.string().optional(),
            areaType: zod_1.z.string().optional(),
            tinNumber: zod_1.z.string().optional(),
            accountNumber: zod_1.z.string().optional(),
            // Educational - Campus Related
            stream: zod_1.z.string().optional(),
            entryYear: zod_1.z.number().optional(),
            sponsorCategory: zod_1.z.string().optional(),
            sponsoredBy: zod_1.z.string().optional(),
            nationalExamYearEC: zod_1.z.number().optional(),
            examinationId: zod_1.z.string().optional(),
            admissionDate: zod_1.z.string().optional(),
            checkedInDate: zod_1.z.string().optional(),
            nationalExamResultTotal: zod_1.z.number().optional(),
            // National Exam Results
            examEnglish: zod_1.z.number().optional(),
            examPhysics: zod_1.z.number().optional(),
            examCivics: zod_1.z.number().optional(),
            examNaturalMath: zod_1.z.number().optional(),
            examChemistry: zod_1.z.number().optional(),
            examBiology: zod_1.z.number().optional(),
            examAptitude: zod_1.z.number().optional(),
            // Submit action
            submitForApproval: zod_1.z.boolean().optional(),
        }).parse(req.body);
        // Check if profile exists
        let profile = await db_js_1.prisma.studentProfile.findUnique({
            where: { userId: req.user.id },
        });
        if (!profile) {
            profile = await db_js_1.prisma.studentProfile.create({
                data: { userId: req.user.id },
            });
        }
        // Update profile
        const updateData = {
            ...body,
            dateOfBirthGC: body.dateOfBirthGC ? new Date(body.dateOfBirthGC) : undefined,
            admissionDate: body.admissionDate ? new Date(body.admissionDate) : undefined,
            checkedInDate: body.checkedInDate ? new Date(body.checkedInDate) : undefined,
        };
        if (body.submitForApproval) {
            updateData.status = 'PENDING_APPROVAL';
        }
        const updatedProfile = await db_js_1.prisma.studentProfile.update({
            where: { userId: req.user.id },
            data: updateData,
            include: { documents: true },
        });
        res.json(updatedProfile);
    });
    // Upload document
    router.post('/student/profile/documents', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['STUDENT']), async (req, res) => {
        const body = zod_1.z.object({
            documentType: zod_1.z.string(),
            fileName: zod_1.z.string().optional(),
            fileUrl: zod_1.z.string(), // Base64 encoded file
        }).parse(req.body);
        // Ensure profile exists
        let profile = await db_js_1.prisma.studentProfile.findUnique({
            where: { userId: req.user.id },
        });
        if (!profile) {
            profile = await db_js_1.prisma.studentProfile.create({
                data: { userId: req.user.id },
            });
        }
        // Check if document type already exists
        const existing = await db_js_1.prisma.studentDocument.findFirst({
            where: { studentProfileId: profile.id, documentType: body.documentType },
        });
        if (existing) {
            // Update existing document
            const updated = await db_js_1.prisma.studentDocument.update({
                where: { id: existing.id },
                data: {
                    fileName: body.fileName,
                    fileUrl: body.fileUrl,
                    status: 'SUBMITTED',
                    uploadedAt: new Date(),
                },
            });
            res.json(updated);
            return;
        }
        // Create new document
        const document = await db_js_1.prisma.studentDocument.create({
            data: {
                studentProfileId: profile.id,
                documentType: body.documentType,
                fileName: body.fileName,
                fileUrl: body.fileUrl,
                status: 'SUBMITTED',
                uploadedAt: new Date(),
            },
        });
        res.json(document);
    });
    // Delete document
    router.delete('/student/profile/documents/:documentId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['STUDENT']), async (req, res) => {
        const params = zod_1.z.object({ documentId: zod_1.z.string() }).parse(req.params);
        const document = await db_js_1.prisma.studentDocument.findUnique({
            where: { id: params.documentId },
            include: { studentProfile: true },
        });
        if (!document || document.studentProfile.userId !== req.user.id) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }
        await db_js_1.prisma.studentDocument.delete({
            where: { id: params.documentId },
        });
        res.json({ success: true });
    });
    // === ADMIN ROUTES ===
    // Get all pending profiles
    router.get('/admin/student-profiles/pending', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const profiles = await db_js_1.prisma.studentProfile.findMany({
            where: { status: 'PENDING_APPROVAL' },
            include: {
                user: { select: { id: true, email: true, fullName: true } },
                documents: true,
            },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(profiles);
    });
    // Get all profiles (with filter)
    router.get('/admin/student-profiles', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const query = zod_1.z.object({
            status: zod_1.z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
        }).parse(req.query);
        const where = {};
        if (query.status) {
            where.status = query.status;
        }
        const profiles = await db_js_1.prisma.studentProfile.findMany({
            where,
            include: {
                user: { select: { id: true, email: true, fullName: true, profileImage: true } },
                documents: true,
            },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(profiles);
    });
    // Get single profile
    router.get('/admin/student-profiles/:profileId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ profileId: zod_1.z.string() }).parse(req.params);
        const profile = await db_js_1.prisma.studentProfile.findUnique({
            where: { id: params.profileId },
            include: {
                user: { select: { id: true, email: true, fullName: true, profileImage: true, createdAt: true } },
                documents: true,
            },
        });
        if (!profile) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }
        res.json(profile);
    });
    // Approve profile
    router.post('/admin/student-profiles/:profileId/approve', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ profileId: zod_1.z.string() }).parse(req.params);
        const profile = await db_js_1.prisma.studentProfile.update({
            where: { id: params.profileId },
            data: {
                status: 'APPROVED',
                adminReviewedBy: req.user.id,
                reviewedAt: new Date(),
                rejectionReason: null,
            },
            include: {
                user: { select: { id: true, email: true, fullName: true } },
                documents: true,
            },
        });
        res.json(profile);
    });
    // Reject profile
    router.post('/admin/student-profiles/:profileId/reject', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ profileId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({ reason: zod_1.z.string().min(1) }).parse(req.body);
        const profile = await db_js_1.prisma.studentProfile.update({
            where: { id: params.profileId },
            data: {
                status: 'REJECTED',
                adminReviewedBy: req.user.id,
                reviewedAt: new Date(),
                rejectionReason: body.reason,
            },
            include: {
                user: { select: { id: true, email: true, fullName: true } },
                documents: true,
            },
        });
        res.json(profile);
    });
}

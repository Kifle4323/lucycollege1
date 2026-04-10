"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMaterialRoutes = registerMaterialRoutes;
const zod_1 = require("zod");
const db_js_1 = require("../db.js");
const middleware_js_1 = require("../middleware.js");
function registerMaterialRoutes(router) {
    // Get materials for a course
    router.get('/courses/:courseId/materials', middleware_js_1.authRequired, async (req, res) => {
        const params = zod_1.z.object({ courseId: zod_1.z.string() }).parse(req.params);
        const user = req.user;
        // Check if user has access to this course
        if (user.role === 'ADMIN') {
            const materials = await db_js_1.prisma.material.findMany({
                where: { courseId: params.courseId },
                include: { author: { select: { id: true, fullName: true, email: true } } },
                orderBy: { createdAt: 'desc' },
            });
            res.json(materials);
            return;
        }
        if (user.role === 'TEACHER') {
            // Teacher must be assigned to teach this course in some class
            const courseClass = await db_js_1.prisma.courseClass.findFirst({
                where: { courseId: params.courseId, teacherId: user.id },
            });
            if (!courseClass) {
                res.status(403).json({ error: 'forbidden' });
                return;
            }
            const materials = await db_js_1.prisma.material.findMany({
                where: { courseId: params.courseId },
                include: { author: { select: { id: true, fullName: true, email: true } } },
                orderBy: { createdAt: 'desc' },
            });
            res.json(materials);
            return;
        }
        // Student must be in a class that has this course
        const courseClass = await db_js_1.prisma.courseClass.findFirst({
            where: {
                courseId: params.courseId,
                class: { students: { some: { studentId: user.id } } },
            },
        });
        if (!courseClass) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const materials = await db_js_1.prisma.material.findMany({
            where: { courseId: params.courseId },
            include: { author: { select: { id: true, fullName: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(materials);
    });
    // Create material (Teacher only)
    router.post('/courses/:courseId/materials', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ courseId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            title: zod_1.z.string().min(2),
            content: zod_1.z.string().optional(),
            fileUrl: zod_1.z.string().optional(),
            fileType: zod_1.z.string().optional(),
        }).parse(req.body);
        const user = req.user;
        // Verify teacher is assigned to teach this course
        const courseClass = await db_js_1.prisma.courseClass.findFirst({
            where: { courseId: params.courseId, teacherId: user.id },
        });
        if (!courseClass) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const material = await db_js_1.prisma.material.create({
            data: {
                courseId: params.courseId,
                title: body.title,
                content: body.content,
                fileUrl: body.fileUrl,
                fileType: body.fileType,
                createdBy: user.id,
            },
            include: { author: { select: { id: true, fullName: true, email: true } } },
        });
        res.json(material);
    });
    // Update material (Teacher only - only author can update)
    router.put('/materials/:materialId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ materialId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            title: zod_1.z.string().min(2).optional(),
            content: zod_1.z.string().optional(),
            fileUrl: zod_1.z.string().optional(),
            fileType: zod_1.z.string().optional(),
        }).parse(req.body);
        const user = req.user;
        const material = await db_js_1.prisma.material.findUnique({ where: { id: params.materialId } });
        if (!material) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        if (material.createdBy !== user.id) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const updated = await db_js_1.prisma.material.update({
            where: { id: params.materialId },
            data: body,
            include: { author: { select: { id: true, fullName: true, email: true } } },
        });
        res.json(updated);
    });
    // Delete material (Teacher only - only author can delete)
    router.delete('/materials/:materialId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ materialId: zod_1.z.string() }).parse(req.params);
        const user = req.user;
        const material = await db_js_1.prisma.material.findUnique({ where: { id: params.materialId } });
        if (!material) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        if (material.createdBy !== user.id) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        await db_js_1.prisma.material.delete({ where: { id: params.materialId } });
        res.json({ success: true });
    });
}

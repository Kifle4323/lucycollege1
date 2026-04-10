"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClassRoutes = registerClassRoutes;
const zod_1 = require("zod");
const db_js_1 = require("../db.js");
const middleware_js_1 = require("../middleware.js");
function registerClassRoutes(router) {
    // Create a new class (Admin only)
    router.post('/classes', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const body = zod_1.z.object({
            name: zod_1.z.string().min(2),
            code: zod_1.z.string().min(2),
            year: zod_1.z.number().int().optional(),
            section: zod_1.z.string().optional(),
        }).parse(req.body);
        const newClass = await db_js_1.prisma.class.create({
            data: {
                name: body.name,
                code: body.code,
                year: body.year,
                section: body.section,
            },
        });
        res.json(newClass);
    });
    // Get all classes
    router.get('/classes', middleware_js_1.authRequired, async (req, res) => {
        const user = req.user;
        if (user.role === 'ADMIN') {
            const classes = await db_js_1.prisma.class.findMany({
                include: {
                    students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
                    teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
                    courses: {
                        select: {
                            id: true,
                            teacherId: true,
                            courseId: true,
                            course: true,
                            teacher: { select: { id: true, fullName: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            res.json(classes);
            return;
        }
        if (user.role === 'TEACHER') {
            // Get classes where teacher is either a class teacher OR teaches a course in that class
            const classes = await db_js_1.prisma.class.findMany({
                where: {
                    OR: [
                        { teachers: { some: { teacherId: user.id } } },
                        { courses: { some: { teacherId: user.id } } },
                    ],
                },
                include: {
                    students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
                    teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
                    courses: {
                        select: {
                            id: true,
                            teacherId: true,
                            courseId: true,
                            course: true,
                            teacher: { select: { id: true, fullName: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            res.json(classes);
            return;
        }
        // Student
        const classes = await db_js_1.prisma.class.findMany({
            where: { students: { some: { studentId: user.id } } },
            include: {
                students: { include: { student: { select: { id: true, fullName: true, email: true } } } },
                teachers: { include: { teacher: { select: { id: true, fullName: true, email: true } } } },
                courses: {
                    select: {
                        id: true,
                        teacherId: true,
                        courseId: true,
                        course: true,
                        teacher: { select: { id: true, fullName: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(classes);
    });
    // Get single class
    router.get('/classes/:classId', middleware_js_1.authRequired, async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string() }).parse(req.params);
        const user = req.user;
        const classData = await db_js_1.prisma.class.findUnique({
            where: { id: params.classId },
            include: {
                students: { include: { student: { select: { id: true, fullName: true, email: true, role: true } } } },
                teachers: { include: { teacher: { select: { id: true, fullName: true, email: true, role: true } } } },
                courses: { include: { course: true, teacher: { select: { id: true, fullName: true } } } },
            },
        });
        if (!classData) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Check access
        if (user.role === 'ADMIN') {
            res.json(classData);
            return;
        }
        if (user.role === 'TEACHER' && classData.teachers.some((t) => t.teacherId === user.id)) {
            res.json(classData);
            return;
        }
        if (user.role === 'STUDENT' && classData.students.some((s) => s.studentId === user.id)) {
            res.json(classData);
            return;
        }
        res.status(403).json({ error: 'forbidden' });
    });
    // Add student to class (Admin only)
    router.post('/classes/:classId/students', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({ studentId: zod_1.z.string() }).parse(req.body);
        const student = await db_js_1.prisma.user.findUnique({ where: { id: body.studentId } });
        if (!student || student.role !== 'STUDENT') {
            res.status(400).json({ error: 'student_not_found' });
            return;
        }
        try {
            const classStudent = await db_js_1.prisma.classStudent.create({
                data: { classId: params.classId, studentId: body.studentId },
                include: { student: { select: { id: true, fullName: true, email: true } } },
            });
            res.json(classStudent);
        }
        catch {
            res.status(400).json({ error: 'already_in_class' });
        }
    });
    // Remove student from class (Admin only)
    router.delete('/classes/:classId/students/:studentId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string(), studentId: zod_1.z.string() }).parse(req.params);
        await db_js_1.prisma.classStudent.delete({
            where: { classId_studentId: { classId: params.classId, studentId: params.studentId } },
        });
        res.json({ success: true });
    });
    // Add teacher to class (Admin only)
    router.post('/classes/:classId/teachers', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({ teacherId: zod_1.z.string() }).parse(req.body);
        const teacher = await db_js_1.prisma.user.findUnique({ where: { id: body.teacherId } });
        if (!teacher || teacher.role !== 'TEACHER') {
            res.status(400).json({ error: 'teacher_not_found' });
            return;
        }
        try {
            const classTeacher = await db_js_1.prisma.classTeacher.create({
                data: { classId: params.classId, teacherId: body.teacherId },
                include: { teacher: { select: { id: true, fullName: true, email: true } } },
            });
            res.json(classTeacher);
        }
        catch {
            res.status(400).json({ error: 'already_teaching' });
        }
    });
    // Remove teacher from class (Admin only)
    router.delete('/classes/:classId/teachers/:teacherId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string(), teacherId: zod_1.z.string() }).parse(req.params);
        await db_js_1.prisma.classTeacher.delete({
            where: { classId_teacherId: { classId: params.classId, teacherId: params.teacherId } },
        });
        res.json({ success: true });
    });
    // Assign course to class with teacher (Admin only)
    router.post('/classes/:classId/courses', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({ courseId: zod_1.z.string(), teacherId: zod_1.z.string().optional() }).parse(req.body);
        const course = await db_js_1.prisma.course.findUnique({ where: { id: body.courseId } });
        if (!course) {
            res.status(400).json({ error: 'course_not_found' });
            return;
        }
        if (body.teacherId) {
            const teacher = await db_js_1.prisma.user.findUnique({ where: { id: body.teacherId } });
            if (!teacher || teacher.role !== 'TEACHER') {
                res.status(400).json({ error: 'teacher_not_found' });
                return;
            }
        }
        try {
            const courseClass = await db_js_1.prisma.courseClass.create({
                data: { classId: params.classId, courseId: body.courseId, teacherId: body.teacherId },
                include: { course: true, teacher: { select: { id: true, fullName: true } } },
            });
            res.json(courseClass);
        }
        catch {
            res.status(400).json({ error: 'already_assigned' });
        }
    });
    // Remove course from class (Admin only)
    router.delete('/classes/:classId/courses/:courseId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['ADMIN']), async (req, res) => {
        const params = zod_1.z.object({ classId: zod_1.z.string(), courseId: zod_1.z.string() }).parse(req.params);
        await db_js_1.prisma.courseClass.delete({
            where: { courseId_classId: { classId: params.classId, courseId: params.courseId } },
        });
        res.json({ success: true });
    });
}

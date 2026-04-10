"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAssessmentRoutes = registerAssessmentRoutes;
const zod_1 = require("zod");
const db_js_1 = require("../db.js");
const middleware_js_1 = require("../middleware.js");
function registerAssessmentRoutes(router) {
    router.post('/courses/:courseId/assessments', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ courseId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            title: zod_1.z.string().min(2),
            examType: zod_1.z.enum(['QUIZ', 'MIDTERM', 'FINAL']).optional(),
            timeLimit: zod_1.z.number().int().positive().optional(),
            maxScore: zod_1.z.number().int().positive().optional(),
        }).parse(req.body);
        // Check if teacher is assigned to this course through CourseClass
        const courseClass = await db_js_1.prisma.courseClass.findFirst({
            where: { courseId: params.courseId, teacherId: req.user.id },
        });
        if (!courseClass) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const assessment = await db_js_1.prisma.assessment.create({
            data: {
                courseId: params.courseId,
                title: body.title,
                examType: body.examType ?? 'QUIZ',
                timeLimit: body.timeLimit,
                maxScore: body.maxScore ?? 100,
            },
        });
        res.json(assessment);
    });
    router.post('/assessments/:assessmentId/questions', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ assessmentId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            type: zod_1.z.enum(['MCQ', 'FITB', 'SHORT_ANSWER']).default('MCQ'),
            prompt: zod_1.z.string().min(2),
            // MCQ fields
            optionA: zod_1.z.string().optional(),
            optionB: zod_1.z.string().optional(),
            optionC: zod_1.z.string().optional(),
            optionD: zod_1.z.string().optional(),
            correct: zod_1.z.enum(['A', 'B', 'C', 'D']).optional(),
            // FITB field
            correctAnswer: zod_1.z.string().optional(),
            // Short answer field
            modelAnswer: zod_1.z.string().optional(),
            points: zod_1.z.number().int().positive().optional(),
        }).parse(req.body);
        const assessment = await db_js_1.prisma.assessment.findUnique({ where: { id: params.assessmentId }, include: { course: { include: { courseClasses: true } } } });
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
        // Validate required fields based on type
        if (body.type === 'MCQ') {
            if (!body.optionA || !body.optionB || !body.optionC || !body.optionD || !body.correct) {
                res.status(400).json({ error: 'MCQ requires options A-D and correct answer' });
                return;
            }
        }
        else if (body.type === 'FITB') {
            if (!body.correctAnswer) {
                res.status(400).json({ error: 'FITB requires correctAnswer' });
                return;
            }
        }
        else if (body.type === 'SHORT_ANSWER') {
            if (!body.modelAnswer) {
                res.status(400).json({ error: 'SHORT_ANSWER requires modelAnswer' });
                return;
            }
        }
        const question = await db_js_1.prisma.question.create({
            data: {
                assessmentId: params.assessmentId,
                type: body.type,
                prompt: body.prompt,
                optionA: body.optionA,
                optionB: body.optionB,
                optionC: body.optionC,
                optionD: body.optionD,
                correct: body.correct,
                correctAnswer: body.correctAnswer,
                modelAnswer: body.modelAnswer,
                points: body.points ?? 1,
            },
        });
        res.json(question);
    });
    router.get('/courses/:courseId/assessments', middleware_js_1.authRequired, async (req, res) => {
        const params = zod_1.z.object({ courseId: zod_1.z.string() }).parse(req.params);
        const course = await db_js_1.prisma.course.findUnique({
            where: { id: params.courseId },
            include: {
                courseClasses: {
                    include: {
                        class: { include: { students: true, teachers: true } },
                        teacher: true,
                    },
                },
            },
        });
        if (!course) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        const user = req.user;
        // Check access: admin, teacher assigned to this course, or student in a class that has this course
        const isAdmin = user.role === 'ADMIN';
        const isTeacher = course.courseClasses.some((cc) => cc.teacherId === user.id);
        const isStudent = course.courseClasses.some((cc) => cc.class.students.some((s) => s.studentId === user.id));
        if (!isAdmin && !isTeacher && !isStudent) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const assessments = await db_js_1.prisma.assessment.findMany({ where: { courseId: params.courseId }, orderBy: { createdAt: 'desc' } });
        res.json(assessments);
    });
    // Toggle assessment open/closed status (Teacher only)
    router.patch('/assessments/:assessmentId/open', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ assessmentId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({ isOpen: zod_1.z.boolean() }).parse(req.body);
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
        const updated = await db_js_1.prisma.assessment.update({
            where: { id: params.assessmentId },
            data: { isOpen: body.isOpen },
        });
        res.json(updated);
    });
    // Get all manual grades for an assessment (Teacher only)
    router.get('/assessments/:assessmentId/manual-grades', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
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
        const grades = await db_js_1.prisma.manualGrade.findMany({
            where: { assessmentId: params.assessmentId },
            include: { student: { select: { id: true, fullName: true, email: true } } },
        });
        res.json(grades);
    });
    // Create or update manual grade (Teacher only)
    router.put('/assessments/:assessmentId/manual-grades/:studentId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ assessmentId: zod_1.z.string(), studentId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            score: zod_1.z.number().int().min(0),
            feedback: zod_1.z.string().optional(),
        }).parse(req.body);
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
        // Validate score doesn't exceed maxScore
        if (body.score > assessment.maxScore) {
            res.status(400).json({ error: 'score_exceeds_max', message: `Score cannot exceed ${assessment.maxScore}` });
            return;
        }
        const grade = await db_js_1.prisma.manualGrade.upsert({
            where: {
                assessmentId_studentId: {
                    assessmentId: params.assessmentId,
                    studentId: params.studentId,
                },
            },
            update: {
                score: body.score,
                feedback: body.feedback,
            },
            create: {
                assessmentId: params.assessmentId,
                studentId: params.studentId,
                score: body.score,
                feedback: body.feedback,
            },
            include: { student: { select: { id: true, fullName: true, email: true } } },
        });
        res.json(grade);
    });
    // Delete manual grade (Teacher only)
    router.delete('/assessments/:assessmentId/manual-grades/:studentId', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ assessmentId: zod_1.z.string(), studentId: zod_1.z.string() }).parse(req.params);
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
        await db_js_1.prisma.manualGrade.delete({
            where: {
                assessmentId_studentId: {
                    assessmentId: params.assessmentId,
                    studentId: params.studentId,
                },
            },
        });
        res.json({ success: true });
    });
    router.post('/assessments/:assessmentId/attempts', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['STUDENT']), async (req, res) => {
        const params = zod_1.z.object({ assessmentId: zod_1.z.string() }).parse(req.params);
        const assessment = await db_js_1.prisma.assessment.findUnique({
            where: { id: params.assessmentId },
            include: {
                course: {
                    include: {
                        courseClasses: {
                            include: {
                                class: { include: { students: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!assessment) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Check if assessment is open for students
        if (!assessment.isOpen) {
            res.status(403).json({ error: 'assessment_closed', message: 'This assessment is not yet open for students' });
            return;
        }
        // Check if student is in any class that has this course
        const isEnrolled = assessment.course.courseClasses.some((cc) => cc.class.students.some((s) => s.studentId === req.user.id));
        if (!isEnrolled) {
            res.status(403).json({ error: 'not_enrolled' });
            return;
        }
        // Check if student already has a submitted attempt for this assessment
        const existingAttempt = await db_js_1.prisma.attempt.findFirst({
            where: {
                assessmentId: params.assessmentId,
                studentId: req.user.id,
                status: 'SUBMITTED',
            },
        });
        if (existingAttempt) {
            res.status(400).json({ error: 'already_submitted', message: 'You have already submitted this assessment' });
            return;
        }
        const attempt = await db_js_1.prisma.attempt.create({
            data: {
                assessmentId: params.assessmentId,
                studentId: req.user.id,
            },
        });
        res.json(attempt);
    });
    router.get('/attempts/:attemptId', middleware_js_1.authRequired, async (req, res) => {
        const params = zod_1.z.object({ attemptId: zod_1.z.string() }).parse(req.params);
        const attempt = await db_js_1.prisma.attempt.findUnique({
            where: { id: params.attemptId },
            include: {
                assessment: { include: { questions: true } },
                answers: true,
            },
        });
        if (!attempt) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        const user = req.user;
        const isOwner = user.role === 'STUDENT' && attempt.studentId === user.id;
        const isTeacher = user.role === 'TEACHER' && attempt.assessment.courseId;
        const isAdmin = user.role === 'ADMIN';
        if (!isOwner && !isTeacher && !isAdmin) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        res.json(attempt);
    });
    router.patch('/attempts/:attemptId/answers', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['STUDENT']), async (req, res) => {
        const params = zod_1.z.object({ attemptId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            questionId: zod_1.z.string(),
            selected: zod_1.z.enum(['A', 'B', 'C', 'D']).optional(), // For MCQ
            textAnswer: zod_1.z.string().optional(), // For FITB and SHORT_ANSWER
        }).parse(req.body);
        const attempt = await db_js_1.prisma.attempt.findUnique({ where: { id: params.attemptId } });
        if (!attempt || attempt.studentId !== req.user.id || attempt.status !== 'IN_PROGRESS') {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        const answer = await db_js_1.prisma.answer.upsert({
            where: { attemptId_questionId: { attemptId: params.attemptId, questionId: body.questionId } },
            update: {
                selected: body.selected,
                textAnswer: body.textAnswer,
            },
            create: {
                attemptId: params.attemptId,
                questionId: body.questionId,
                selected: body.selected,
                textAnswer: body.textAnswer,
            },
        });
        res.json(answer);
    });
    router.post('/attempts/:attemptId/submit', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['STUDENT']), async (req, res) => {
        const params = zod_1.z.object({ attemptId: zod_1.z.string() }).parse(req.params);
        const attempt = await db_js_1.prisma.attempt.findUnique({
            where: { id: params.attemptId },
            include: { answers: true, assessment: { include: { questions: true } } },
        });
        if (!attempt || attempt.studentId !== req.user.id || attempt.status !== 'IN_PROGRESS') {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        // Build question map with all needed fields
        const questionMap = new Map(attempt.assessment.questions.map((q) => [q.id, {
                id: q.id,
                type: q.type,
                correct: q.correct,
                correctAnswer: q.correctAnswer,
                points: q.points,
            }]));
        let autoScore = 0;
        let hasManualGrading = false;
        for (const ans of attempt.answers) {
            const q = questionMap.get(ans.questionId);
            if (!q)
                continue;
            if (q.type === 'MCQ') {
                // Auto-grade MCQ
                if (ans.selected === q.correct) {
                    autoScore += q.points;
                }
            }
            else if (q.type === 'FITB') {
                // Auto-grade FITB (case-insensitive, trimmed)
                if (ans.textAnswer && q.correctAnswer) {
                    const studentAns = ans.textAnswer.trim().toLowerCase();
                    const correctAns = q.correctAnswer.trim().toLowerCase();
                    if (studentAns === correctAns) {
                        autoScore += q.points;
                    }
                }
            }
            else if (q.type === 'SHORT_ANSWER') {
                // Needs manual grading
                hasManualGrading = true;
            }
        }
        // If there are short answer questions, status remains SUBMITTED until teacher grades
        // Otherwise, mark as GRADED
        const status = hasManualGrading ? 'SUBMITTED' : 'GRADED';
        const score = hasManualGrading ? autoScore : autoScore; // Will be updated after manual grading
        const updated = await db_js_1.prisma.attempt.update({
            where: { id: params.attemptId },
            data: { status, submittedAt: new Date(), score },
        });
        res.json({ ...updated, hasManualGrading, autoScore });
    });
    // Teacher grades short answer questions
    router.post('/attempts/:attemptId/grade', middleware_js_1.authRequired, (0, middleware_js_1.requireRole)(['TEACHER']), async (req, res) => {
        const params = zod_1.z.object({ attemptId: zod_1.z.string() }).parse(req.params);
        const body = zod_1.z.object({
            answers: zod_1.z.array(zod_1.z.object({
                answerId: zod_1.z.string(),
                score: zod_1.z.number().int().min(0),
                feedback: zod_1.z.string().optional(),
            })),
        }).parse(req.body);
        const attempt = await db_js_1.prisma.attempt.findUnique({
            where: { id: params.attemptId },
            include: {
                assessment: {
                    include: {
                        course: {
                            include: {
                                courseClasses: true,
                            },
                        },
                    },
                },
            },
        });
        if (!attempt) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        // Check if teacher is assigned to this course
        const isTeacher = attempt.assessment.course.courseClasses.some((cc) => cc.teacherId === req.user.id);
        if (!isTeacher) {
            res.status(403).json({ error: 'forbidden' });
            return;
        }
        // Update each answer's score and feedback
        for (const a of body.answers) {
            await db_js_1.prisma.answer.update({
                where: { id: a.answerId },
                data: { score: a.score, feedback: a.feedback },
            });
        }
        // Recalculate total score
        const answers = await db_js_1.prisma.answer.findMany({ where: { attemptId: params.attemptId } });
        const totalScore = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
        const updated = await db_js_1.prisma.attempt.update({
            where: { id: params.attemptId },
            data: { status: 'GRADED', score: totalScore },
        });
        res.json(updated);
    });
}

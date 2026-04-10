import { useState, useEffect } from 'react';
import { getTeacherSections, getSectionStudents, enterGrade, submitSectionGrades } from '../api.js';

export default function TeacherGradesPage() {
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSections();
  }, []);

  async function loadSections() {
    try {
      const data = await getTeacherSections();
      setSections(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectSection(section) {
    setSelectedSection(section);
    setSuccess('');
    setError('');
    try {
      const data = await getSectionStudents(section.id);
      setStudents(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateStudentGrade(studentId, field, value) {
    setStudents(students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          grade: {
            ...s.grade,
            [field]: value === '' ? null : parseInt(value, 10)
          }
        };
      }
      return s;
    }));
  }

  async function saveGrade(student) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const gradeData = {
        enrollmentId: student.id,
        quizScore: student.grade?.quizScore,
        midtermScore: student.grade?.midtermScore,
        finalScore: student.grade?.finalScore,
        attendanceScore: student.grade?.attendanceScore,
        feedback: student.grade?.feedback
      };
      await enterGrade(gradeData);
      setSuccess('Grade saved successfully!');
      // Refresh data
      const data = await getSectionStudents(selectedSection.id);
      setStudents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitAllGrades() {
    if (!confirm('Submit all grades? This will lock the grades and students will be able to see them once published by admin.')) return;
    try {
      await submitSectionGrades(selectedSection.id);
      setSuccess('Grades submitted successfully!');
      // Refresh
      const data = await getSectionStudents(selectedSection.id);
      setStudents(data);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Grade Management</h1>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{success}</div>}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sections List */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">My Course Sections</h2>
          <div className="space-y-2">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => selectSection(section)}
                className={`w-full text-left p-3 rounded border ${
                  selectedSection?.id === section.id
                    ? 'bg-blue-50 border-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{section.course?.title}</div>
                <div className="text-sm text-gray-500">
                  {section.sectionCode} | {section.semester?.name}
                </div>
                <div className="text-xs text-gray-400">
                  {section._count?.enrollments || 0} students
                </div>
              </button>
            ))}
            {sections.length === 0 && (
              <p className="text-gray-500 text-sm">No course sections assigned.</p>
            )}
          </div>
        </div>

        {/* Students & Grades */}
        <div className="md:col-span-3">
          {selectedSection ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedSection.course?.title}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedSection.sectionCode} | {selectedSection.semester?.name}
                  </p>
                </div>
                <button
                  onClick={submitAllGrades}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Submit All Grades
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3">Student</th>
                      <th className="text-center p-3">Quiz<br/><span className="text-xs text-gray-400">/100</span></th>
                      <th className="text-center p-3">Midterm<br/><span className="text-xs text-gray-400">/100</span></th>
                      <th className="text-center p-3">Final<br/><span className="text-xs text-gray-400">/100</span></th>
                      <th className="text-center p-3">Attendance<br/><span className="text-xs text-gray-400">/100</span></th>
                      <th className="text-center p-3">Total</th>
                      <th className="text-center p-3">Grade</th>
                      <th className="text-center p-3">Status</th>
                      <th className="text-center p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-medium">{student.student?.fullName}</div>
                          <div className="text-xs text-gray-500">{student.student?.email}</div>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={student.grade?.quizScore ?? ''}
                            onChange={e => updateStudentGrade(student.id, 'quizScore', e.target.value)}
                            disabled={student.grade?.isSubmitted}
                            className="w-16 border rounded px-2 py-1 text-center disabled:bg-gray-100"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={student.grade?.midtermScore ?? ''}
                            onChange={e => updateStudentGrade(student.id, 'midtermScore', e.target.value)}
                            disabled={student.grade?.isSubmitted}
                            className="w-16 border rounded px-2 py-1 text-center disabled:bg-gray-100"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={student.grade?.finalScore ?? ''}
                            onChange={e => updateStudentGrade(student.id, 'finalScore', e.target.value)}
                            disabled={student.grade?.isSubmitted}
                            className="w-16 border rounded px-2 py-1 text-center disabled:bg-gray-100"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={student.grade?.attendanceScore ?? ''}
                            onChange={e => updateStudentGrade(student.id, 'attendanceScore', e.target.value)}
                            disabled={student.grade?.isSubmitted}
                            className="w-16 border rounded px-2 py-1 text-center disabled:bg-gray-100"
                          />
                        </td>
                        <td className="p-3 text-center font-medium">
                          {student.grade?.totalScore ?? '-'}
                        </td>
                        <td className="p-3 text-center">
                          {student.grade?.gradeLetter ? (
                            <span className={`px-2 py-1 rounded text-white ${
                              student.grade.gradeLetter.startsWith('A') ? 'bg-green-600' :
                              student.grade.gradeLetter.startsWith('B') ? 'bg-blue-600' :
                              student.grade.gradeLetter.startsWith('C') ? 'bg-yellow-600' :
                              student.grade.gradeLetter === 'D' ? 'bg-orange-600' :
                              'bg-red-600'
                            }`}>
                              {student.grade.gradeLetter}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-3 text-center">
                          {student.grade?.isSubmitted ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Submitted</span>
                          ) : student.grade ? (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Draft</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">No Grade</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => saveGrade(student)}
                            disabled={saving || student.grade?.isSubmitted}
                            className="text-blue-600 hover:underline disabled:text-gray-400 text-sm"
                          >
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {students.length === 0 && (
                <p className="text-gray-500 text-center py-8">No students enrolled in this section.</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Select a course section to manage grades.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

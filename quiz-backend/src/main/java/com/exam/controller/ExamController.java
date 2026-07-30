package com.exam.controller;

import com.exam.model.Exam;
import com.exam.model.Question;
import com.exam.model.StudentExam;
import com.exam.model.User;
import com.exam.repository.ExamRepository;
import com.exam.repository.StudentExamRepository;
import com.exam.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class ExamController {

    private final ExamRepository examRepository;
    private final StudentExamRepository studentExamRepository;
    private final UserRepository userRepository;

    public ExamController(ExamRepository examRepository, 
                          StudentExamRepository studentExamRepository, 
                          UserRepository userRepository) {
        this.examRepository = examRepository;
        this.studentExamRepository = studentExamRepository;
        this.userRepository = userRepository;
    }

    @GetMapping("/student/exams/{id}/start")
    public ResponseEntity<?> startExam(@PathVariable Long id) {
        String principal = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Long currentStudentId = Long.parseLong(principal);
        
        StudentExam trackingRecord = studentExamRepository.findAll().stream()
                .filter(se -> se.getStudentId().equals(currentStudentId) && se.getExamId().equals(id))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No assignment found for this student and exam matrix."));

        if (trackingRecord.getStatus() == StudentExam.ExamStatus.COMPLETED) {
            return ResponseEntity.badRequest().body(Map.of("message", "Exam already completed."));
        }

        trackingRecord.setStatus(StudentExam.ExamStatus.STARTED);
        studentExamRepository.save(trackingRecord);

        Exam exam = examRepository.findById(id).orElseThrow();
        exam.getQuestions().forEach(q -> q.setCorrectOption(null)); 

        return ResponseEntity.ok(Map.of("exam", exam, "questions", exam.getQuestions()));
    }

    @PostMapping("/student/exams/{id}/submit")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> submitExam(@PathVariable Long id, @RequestBody Map<String, Object> submissionPayload) {
        String principal = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Long currentStudentId = Long.parseLong(principal);
        
        StudentExam trackingRecord = studentExamRepository.findAll().stream()
                .filter(se -> se.getStudentId().equals(currentStudentId) && se.getExamId().equals(id))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Exam registration record missing."));
                
        if (trackingRecord.getStatus() == StudentExam.ExamStatus.COMPLETED) {
            return ResponseEntity.badRequest().body(Map.of("message", "Already submitted."));
        }

        Exam exam = examRepository.findById(id).orElseThrow();
        List<Map<String, Object>> submittedAnswers = (List<Map<String, Object>>) submissionPayload.get("answers");
        
        long correctCount = 0;
        for (Question q : exam.getQuestions()) {
            Optional<Map<String, Object>> userSelection = submittedAnswers.stream()
                    .filter(a -> Long.valueOf(a.get("question_id").toString()).equals(q.getQuestionId()))
                    .findFirst();

            if (userSelection.isPresent() && q.getCorrectOption().equalsIgnoreCase((String) userSelection.get().get("selected"))) {
                correctCount++;
            }
        }

        double calculatedScore = exam.getQuestions().isEmpty() ? 0.0 : ((double) correctCount / exam.getQuestions().size()) * 100.0;
        
        trackingRecord.setScore(calculatedScore);
        trackingRecord.setTimeSpentSeconds(Integer.parseInt(submissionPayload.get("time_spent_seconds").toString()));
        trackingRecord.setStatus(StudentExam.ExamStatus.COMPLETED);
        trackingRecord.setCompletedAt(LocalDateTime.now());
        studentExamRepository.save(trackingRecord);

        return ResponseEntity.ok(Map.of(
            "score", trackingRecord.getScore(),
            "time_spent_seconds", trackingRecord.getTimeSpentSeconds(),
            "status", trackingRecord.getStatus().name()
        ));
    }

    @PostMapping("/admin/exams")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> createExamByAdmin(@RequestBody Map<String, Object> payload) {
        Exam newExam = new Exam();
        newExam.setTitle((String) payload.get("title"));
        newExam.setDurationMinutes(Integer.parseInt(payload.get("duration_minutes").toString()));
        newExam.setCreatedBy(1L); 

        List<Map<String, Object>> questionsInput = (List<Map<String, Object>>) payload.get("questionsList");
        List<Question> questionEntities = new ArrayList<>();

        for (Map<String, Object> qMap : questionsInput) {
            Question q = new Question();
            q.setExam(newExam);
            q.setQuestionText((String) qMap.get("question_text"));
            q.setOptionA((String) qMap.get("option_a"));
            q.setOptionB((String) qMap.get("option_b"));
            q.setOptionC((String) qMap.get("option_c"));
            q.setOptionD((String) qMap.get("option_d"));
            q.setCorrectOption((String) qMap.get("correct_option"));
            questionEntities.add(q);
        }
        
        newExam.setQuestions(questionEntities);
        examRepository.save(newExam); 

        List<User> allStudents = userRepository.findAll().stream()
                .filter(u -> u.getRole() == User.Role.STUDENT).toList();
                
        for (User student : allStudents) {
            StudentExam assignRecord = new StudentExam();
            assignRecord.setStudentId(student.getUserId());
            assignRecord.setExamId(newExam.getExamId());
            assignRecord.setStatus(StudentExam.ExamStatus.ASSIGNED);
            studentExamRepository.save(assignRecord);
        }

        return ResponseEntity.status(201).body(Map.of("message", "Exam configuration successfully deployed."));
    }

    // NEW ADDITION: Secure administrative removal process configuration
    @DeleteMapping("/admin/exams/{id}")
    public ResponseEntity<?> deleteExamByAdmin(@PathVariable Long id) {
        if (!examRepository.existsById(id)) {
            return ResponseEntity.status(404).body(Map.of("message", "Exam matrix not found."));
        }

        // Clean dependent student mapping metrics allocations to avoid foreign key errors
        List<StudentExam> assignments = studentExamRepository.findAll().stream()
                .filter(se -> se.getExamId().equals(id))
                .toList();
        studentExamRepository.deleteAll(assignments);

        // Core removal execution
        examRepository.deleteById(id);
        
        return ResponseEntity.ok(Map.of("message", "Exam configuration matrix successfully dropped from primary nodes."));
    }

    @GetMapping("/student/results")
    public ResponseEntity<?> getResults() {
        String principal = (String) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Long userId = Long.parseLong(principal);
        
        List<StudentExam> studentList = studentExamRepository.findAll().stream()
                .filter(se -> se.getStudentId().equals(userId))
                .toList();
                
        return ResponseEntity.ok(studentList);
    }

    @GetMapping("/results")
    public ResponseEntity<?> getAllResults() {
        List<StudentExam> allRecords = studentExamRepository.findAll();
        List<Map<String, Object>> enrichedDataList = new ArrayList<>();

        for (StudentExam record : allRecords) {
            Map<String, Object> rowMap = new HashMap<>();
            rowMap.put("studentId", record.getStudentId());
            rowMap.put("examId", record.getExamId());
            rowMap.put("status", record.getStatus().name());
            rowMap.put("score", record.getScore());
            rowMap.put("timeSpentSeconds", record.getTimeSpentSeconds());
            
            String studentRealName = userRepository.findById(record.getStudentId())
                    .map(User::getName)
                    .orElse("Unknown Student");
            
            rowMap.put("studentName", studentRealName);
            enrichedDataList.add(rowMap);
        }

        return ResponseEntity.ok(enrichedDataList);
    }

    // NEW ENDPOINT: Allows admins to fetch a complete raw list of all exams
    @GetMapping("/admin/exams-list")
    public ResponseEntity<?> getRawExamsList() {
        return ResponseEntity.ok(examRepository.findAll());
    }
}
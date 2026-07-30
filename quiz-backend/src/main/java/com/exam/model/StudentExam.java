package com.exam.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "student_exams")
public class StudentExam {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long studentExamId;
    private Long studentId;
    private Long examId;
    private Double score = 0.0;
    private Integer timeSpentSeconds = 0;

    @Enumerated(EnumType.STRING)
    private ExamStatus status = ExamStatus.ASSIGNED;
    private LocalDateTime completedAt;

    public enum ExamStatus { ASSIGNED, STARTED, COMPLETED }

    public Long getStudentExamId() { return studentExamId; }
    public void setStudentExamId(Long studentExamId) { this.studentExamId = studentExamId; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public Long getExamId() { return examId; }
    public void setExamId(Long examId) { this.examId = examId; }
    public Double getScore() { return score; }
    public void setScore(Double score) { this.score = score; }
    public Integer getTimeSpentSeconds() { return timeSpentSeconds; }
    public void setTimeSpentSeconds(Integer timeSpentSeconds) { this.timeSpentSeconds = timeSpentSeconds; }
    public ExamStatus getStatus() { return status; }
    public void setStatus(ExamStatus status) { this.status = status; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
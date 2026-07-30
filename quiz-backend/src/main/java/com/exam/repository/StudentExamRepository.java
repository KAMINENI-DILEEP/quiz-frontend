package com.exam.repository;

import com.exam.model.StudentExam;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface StudentExamRepository extends JpaRepository<StudentExam, Long> {
    List<StudentExam> findByStudentId(Long studentId);
    Optional<StudentExam> findByStudentIdAndExamId(Long studentId, Long examId);
}
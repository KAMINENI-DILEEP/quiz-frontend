package com.exam;

import com.exam.model.User;
import com.exam.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
@EnableAsync
public class ExamApplication {

    public static void main(String[] args) {
        SpringApplication.run(ExamApplication.class, args);
    }

    @Bean
    public CommandLineRunner initSingleAdmin(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            try {
                if (userRepository.findByEmail("admin@exam.com") == null) {
                    User admin = new User();
                    admin.setName("Admin");
                    admin.setEmail("admin@exam.com");
                    admin.setPasswordHash(passwordEncoder.encode("admin123")); // Correct setter name
                    admin.setRole(User.Role.ADMIN); // Correct Enum type
                    admin.setMfaEnabled(false);
                    userRepository.save(admin);
                }
            } catch (Exception e) {
                System.out.println("Skipping admin init on startup due to network/db lag: " + e.getMessage());
            }
        };
    }
}

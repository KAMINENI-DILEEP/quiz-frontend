package com.exam.controller;

import com.exam.model.User;
import com.exam.repository.UserRepository;
import com.exam.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class PasswordResetController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        User user = userRepository.findByEmail(email).orElse(null);
        
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email address not found."));
        }

        String otp = "123456"; // Mock or dynamic 6-digit OTP code
        user.setResetOtp(otp);
        userRepository.save(user);

        emailService.sendEmail(email, "Password Recovery Code", "Your password reset code is: " + otp);

        return ResponseEntity.ok(Map.of("message", "Password reset code sent to your email."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String otp = request.get("otp");
        String newPassword = request.get("newPassword");

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || !otp.equals(user.getResetOtp())) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid email or verification code."));
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setResetOtp(null);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Password reset successfully. Please sign in."));
    }
}

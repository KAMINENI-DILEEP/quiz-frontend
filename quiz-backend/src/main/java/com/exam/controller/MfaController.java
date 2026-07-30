package com.exam.controller;

import com.exam.service.MfaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/auth/mfa")
public class MfaController {

    // Temporary storage for verification codes (Alternatively, save this in your database with an expiration timestamp)
    private final Map<String, String> otpStorage = new ConcurrentHashMap<>();

    @Autowired
    private MfaService mfaService;

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendMfaOtp(@RequestParam String email) {
        String otp = mfaService.generateOtp();
        otpStorage.put(email, otp);
        mfaService.sendOtpEmail(email, otp);
        
        Map<String, String> response = new HashMap<>();
        response.put("message", "MFA verification code sent to email.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyMfaOtp(@RequestParam String email, @RequestParam String otp) {
        String storedOtp = otpStorage.get(email);
        
        if (storedOtp != null && storedOtp.equals(otp)) {
            otpStorage.remove(email); // Clear code after successful verification
            Map<String, String> response = new HashMap<>();
            response.put("message", "MFA verification successful!");
            // Proceed to issue your JWT token here
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body("Invalid or expired OTP code.");
        }
    }
}
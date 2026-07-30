package com.exam.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import java.util.Random;

@Service
public class MfaService {

    @Autowired
    private JavaMailSender mailSender;

    // Generate a 6-digit OTP code
    public String generateOtp() {
        Random random = new Random();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    // Send the OTP via email
    public void sendOtpEmail(String toEmail, String otpCode) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("Your Examination Portal MFA Verification Code");
        message.setText("Your security verification code is: " + otpCode + "\nThis code will expire shortly.");
        mailSender.send(message);
    }
}
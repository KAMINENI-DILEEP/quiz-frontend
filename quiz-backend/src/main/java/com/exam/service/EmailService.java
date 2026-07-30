package com.exam.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Autowired
    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void sendOtpEmail(String recipientEmail, String otpCode) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom("noreply@examportal.com");
            message.setTo(recipientEmail);
            message.setSubject("Your Examination Portal Verification Code");
            message.setText("Your One-Time Password (OTP) for authentication is: " + otpCode + 
                           "\n\nThis code will expire in 5 minutes. Do not share this code with anyone.");
            
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("Failed to send OTP email to " + recipientEmail + ": " + e.getMessage());
        }
    }
}
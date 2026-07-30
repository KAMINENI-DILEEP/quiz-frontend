package com.exam.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PingController {

    @GetMapping({"/ping", "/api/ping"})
    public ResponseEntity<String> ping() {
        return ResponseEntity.ok("pong");
    }
}

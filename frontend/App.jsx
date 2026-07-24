import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ChevronDown, AlertCircle, LogOut } from 'lucide-react';
import './style.css';

const API_BASE_URL = 'https://quiz-backend-azsp.onrender.com/api';
const EXPECTED_MOCK_OTP = "123456";

export default function App() {
  const [currentView, setCurrentView] = useState('vAuthSpace'); // 'vAuthSpace', 'vForgotPassword', 'vDash', 'vExam', 'vAdminDash'
  const [authMode, setAuthMode] = useState('EMAIL'); // 'EMAIL' or 'MOBILE'
  const [isSignUp, setIsSignUp] = useState(false);
  const [token, setJwtToken] = useState(sessionStorage.getItem('token') || null);
  const [role, setRole] = useState(sessionStorage.getItem('role') || 'STUDENT');
  const [user, setUser] = useState({ name: '', email: '', mobile: '' });

  // UI Feedback & Inputs
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Mobile OTP States
  const [mobileNum, setMobileNum] = useState('');
  const [mobileStep, setMobileStep] = useState('NUMBER'); // 'NUMBER' or 'OTP'
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpStatus, setOtpStatus] = useState({ state: 'IDLE', text: 'Enter the 6-digit code' });
  const otpRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  // Exam States
  const [exams, setExams] = useState([]);

  // WAKE UP RENDER BACKEND IMMEDIATELY ON LOAD
  useEffect(() => {
    fetch(`${API_BASE_URL}/student/results`, { method: 'HEAD' }).catch(() => {});

    if (token) {
      if (role === 'ADMIN') {
        setCurrentView('vAdminDash');
      } else {
        fetchStudentDashboard(token);
      }
    }
  }, []);

  // Handler for Email Login
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authMode: 'EMAIL', email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Verification failed');

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('role', data.role);
      setJwtToken(data.token);
      setRole(data.role);
      setUser({ name: data.name, email: data.email || email, mobile: data.mobileNumber || '' });

      if (data.role === 'ADMIN') {
        setCurrentView('vAdminDash');
      } else {
        fetchStudentDashboard(data.token);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for Mobile Login & Step Switching
  const handleMobileSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!/^\d{10}$/.test(mobileNum)) {
      setErrorMsg("Please enter a valid 10-digit phone number.");
      return;
    }

    if (mobileStep === 'NUMBER') {
      alert(`An authentication One-Time-Password code (123456) has been successfully generated and dispatched to: +91 ${mobileNum}`);
      setMobileStep('OTP');
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    } else {
      const fullOtp = otp.join('');
      if (fullOtp !== EXPECTED_MOCK_OTP) {
        setErrorMsg("Invalid 6-digit OTP code.");
        return;
      }
      executeMobileLogin();
    }
  };

  const executeMobileLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authMode: 'MOBILE', mobileNumber: mobileNum, otp: otp.join('') })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Mobile verification failed.');

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('role', data.role);
      setJwtToken(data.token);
      setRole(data.role);
      setUser({ name: data.name, email: data.email || '', mobile: mobileNum });

      fetchStudentDashboard(data.token);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Split OTP Box Navigation Logic
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs[index + 1].current.focus();
    }

    const code = newOtp.join('');
    if (code.length === 6) {
      if (code === EXPECTED_MOCK_OTP) {
        setOtpStatus({ state: 'VALID', text: 'Code verified' });
      } else {
        setOtpStatus({ state: 'INVALID', text: 'Invalid OTP code' });
      }
    } else {
      setOtpStatus({ state: 'IDLE', text: 'Enter the 6-digit code' });
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split('');
      setOtp(digits);
      otpRefs[5].current.focus();
      if (pasted === EXPECTED_MOCK_OTP) {
        setOtpStatus({ state: 'VALID', text: 'Code verified' });
      } else {
        setOtpStatus({ state: 'INVALID', text: 'Invalid OTP code' });
      }
    }
  };

  const fetchStudentDashboard = async (authToken) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/student/results`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setExams(data);
        setCurrentView('vDash');
      }
    } catch (err) {
      setErrorMsg("Failed to connect to result tracker systems.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    setJwtToken(null);
    setUser({ name: '', email: '', mobile: '' });
    setCurrentView('vAuthSpace');
  };

  // Hardware-Accelerated View Transitions
  const pageVariants = {
    initial: { opacity: 0, y: 12, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, y: -12, scale: 0.98, transition: { duration: 0.15 } }
  };

  return (
    <div className="wrapper">
      {errorMsg && (
        <div className="err">
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* VIEW 1: AUTHENTICATION MODULE */}
        {currentView === 'vAuthSpace' && (
          <motion.div key="authSpace" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            {!isSignUp ? (
              authMode === 'EMAIL' ? (
                /* EMAIL LOGIN CARD */
                <div id="authSignInCard">
                  <h2>Candidate Sign In Gateway</h2>
                  <form onSubmit={handleEmailLogin}>
                    <div className="form-group">
                      <label>Email Address</label>
                      <div className="password-wrapper">
                        <Mail className="input-icon" size={18} />
                        <input type="email" name="email" required placeholder="Enter your email address" style={{ paddingLeft: '2.5rem' }} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Password</label>
                      <div className="password-wrapper">
                        <Lock className="input-icon" size={18} />
                        <input type={showPassword ? "text" : "password"} name="password" required placeholder="Enter your password" style={{ paddingLeft: '2.5rem' }} />
                        <button type="button" className="password-toggle-btn" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <button type="submit" className="btn-continue-style" disabled={loading}>
                        {loading ? "Verifying..." : "Sign In"}
                      </button>
                      <button type="button" className="btn-outline" onClick={() => setCurrentView('vForgotPassword')}>
                        Forgot Password?
                      </button>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                      <button type="button" className="switch-auth-link" onClick={() => { setAuthMode('MOBILE'); setErrorMsg(''); }}>
                        Login with PHONE NUMBER
                      </button>
                    </div>
                  </form>

                  <div className="auth-switch-footer">
                    <span className="auth-switch-msg">New candidate entry?</span>
                    <button type="button" className="btn-secondary" onClick={() => setIsSignUp(true)}>Create Account</button>
                    <button type="button" className="btn-outline" onClick={() => window.location.href = 'admin.html'}>Admin View</button>
                  </div>
                </div>
              ) : (
                /* MOBILE LOGIN CARD WITH 6-DIGIT OTP */
                <div id="authMobileSignInCard">
                  <h2>Candidate Sign In Gateway</h2>
                  <form onSubmit={handleMobileSubmit}>
                    <div className="form-group">
                      <label>Phone Number</label>
                      <div className="phone-input-container">
                        <div className="flag-prefix-box">
                          <span className="flag-emoji">🇮🇳</span>
                          <span className="prefix-text">+91</span>
                          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <input
                          type="text"
                          value={mobileNum}
                          disabled={mobileStep === 'OTP'}
                          onChange={(e) => setMobileNum(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          required
                          placeholder="Enter phone number"
                        />
                      </div>
                    </div>

                    {mobileStep === 'OTP' && (
                      <div className="form-group" style={{ marginTop: '1.5rem' }}>
                        <div className="otp-header">
                          <span className="security-tag">SECURITY CHECK</span>
                          <label style={{ marginTop: '0.25rem' }}>Enter your code</label>
                          <p className="subtext">We sent a 6-digit code to verify your account.</p>
                        </div>

                        <div className={`otp-container ${otpStatus.state === 'VALID' ? 'verified' : otpStatus.state === 'INVALID' ? 'invalid' : ''}`}>
                          {otp.map((digit, idx) => (
                            <React.Fragment key={idx}>
                              <input
                                ref={otpRefs[idx]}
                                type="text"
                                maxLength={1}
                                className="otp-box"
                                value={digit}
                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                onPaste={handleOtpPaste}
                              />
                              {idx === 2 && <span className="otp-separator">-</span>}
                            </React.Fragment>
                          ))}
                        </div>

                        <div className={`status-msg ${otpStatus.state === 'VALID' ? 'success' : otpStatus.state === 'INVALID' ? 'error' : ''}`}>
                          <span className="dot"></span> <span>{otpStatus.text}</span>
                        </div>
                        <p className="tip">Tip: paste to fill every box at once.</p>
                      </div>
                    )}

                    <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                      <button type="submit" className="btn-continue-style" style={{ width: '100%' }} disabled={loading}>
                        {loading ? "Authorizing..." : mobileStep === 'NUMBER' ? "Continue" : "Verify & Login"}
                      </button>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                      <button type="button" className="switch-auth-link" onClick={() => { setAuthMode('EMAIL'); setErrorMsg(''); }}>
                        Login with Email
                      </button>
                    </div>
                  </form>

                  <div className="auth-switch-footer">
                    <span className="auth-switch-msg">New candidate entry?</span>
                    <button type="button" className="btn-secondary" onClick={() => setIsSignUp(true)}>Create Account</button>
                  </div>
                </div>
              )
            ) : (
              /* REGISTRATION FORM */
              <div id="authSignUpCard">
                <h2>Create Candidate Account</h2>
                <form onSubmit={(e) => { e.preventDefault(); setIsSignUp(false); alert("Account created successfully!"); }}>
                  <div className="form-group"><label>Full Name</label><input type="text" required placeholder="John Doe" /></div>
                  <div className="form-group"><label>Email Address</label><input type="email" required placeholder="john@edu.com" /></div>
                  <div className="form-group"><label>Mobile Number (10 digits)</label><input type="text" required placeholder="9876543210" maxLength={10} /></div>
                  <div className="form-group"><label>Password</label><input type="password" required placeholder="••••••••" /></div>
                  <button type="submit" className="btn-success" style={{ width: '100%' }}>Register Profile</button>
                </form>
                <div className="auth-switch-footer">
                  <span className="auth-switch-msg">Already registered?</span>
                  <button type="button" className="btn-secondary" onClick={() => setIsSignUp(false)}>Sign In Gateway</button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* VIEW 2: FORGOT PASSWORD RECOVERY */}
        {currentView === 'vForgotPassword' && (
          <motion.div key="forgotPass" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <h2>Account Credential Recovery</h2>
            <div className="card">
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Enter your profile address to route recovery authorization tokens securely.
              </p>
              <form onSubmit={(e) => { e.preventDefault(); alert("Recovery link dispatched!"); setCurrentView('vAuthSpace'); }}>
                <div className="form-group">
                  <label>Registered Email Address</label>
                  <input type="email" required placeholder="john@edu.com" />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn-success">Dispatch Code</button>
                  <button type="button" className="btn-secondary" onClick={() => setCurrentView('vAuthSpace')}>Return to Login</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {/* VIEW 3: STUDENT DASHBOARD */}
        {currentView === 'vDash' && (
          <motion.div key="studentDash" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="navbar">
              <h2>Student Portal Space</h2>
              <div>
                <button onClick={handleLogout} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <LogOut size={16} /> Logout
                </button>
              </div>
            </div>
            <p style={{ margin: '1rem 0 1.5rem 0' }}>
              Welcome, <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{user.name || 'Candidate'}</span>
            </p>
            <h3>Your Assigned Exams</h3>
            <div style={{ marginTop: '1rem' }}>
              {exams.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No assigned exams found.</div>
              ) : (
                exams.map((exam) => (
                  <div key={exam.examId} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <strong>Exam Reference Assignment ID: #{exam.examId}</strong><br />
                      <small style={{ color: 'var(--text-muted)' }}>
                        Status: {exam.status} {exam.status === 'COMPLETED' ? `| Score: ${exam.score.toFixed(1)}%` : ''}
                      </small>
                    </div>
                    {exam.status === 'COMPLETED' ? (
                      <strong>Locked</strong>
                    ) : (
                      <button className="btn-primary" onClick={() => alert("Starting examination...")}>Start Exam</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

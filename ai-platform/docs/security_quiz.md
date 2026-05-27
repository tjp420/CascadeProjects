# Security Knowledge Quiz

## 🎯 Purpose
Test your knowledge of secure coding practices and security best practices.

## 📝 Quiz Questions

### Section 1: Basic Security Concepts

**Question 1:** What is the primary risk of using eval() with user input?
- A) Performance degradation
- B) Code injection vulnerability
- C) Memory leak
- D) Syntax errors

**Answer:** B) Code injection vulnerability

**Question 2:** Which of the following is the safest way to handle user input?
- A) Direct use in database queries
- B) Validation and sanitization
- C) Trust the input by default
- D) Only check for empty strings

**Answer:** B) Validation and sanitization

**Question 3:** What is the principle of "least privilege"?
- A) Give users maximum permissions
- B) Give minimal necessary permissions
- C) Share all permissions equally
- D) No permissions required

**Answer:** B) Give minimal necessary permissions

### Section 2: Python Security

**Question 4:** Which subprocess method is most secure?
- A) subprocess.call() with shell=True
- B) subprocess.run() with list arguments
- C) os.system()
- D) subprocess.popen()

**Answer:** B) subprocess.run() with list arguments

**Question 5:** How should you handle serialization of untrusted data?
- A) Use pickle.loads()
- B) Use json.loads()
- C) Use eval()
- D) Direct string manipulation

**Answer:** B) Use json.loads()

**Question 6:** What is the best practice for error handling in security?
- A) Expose detailed error messages
- B) Use generic error messages
- C) Ignore errors
- D) Print stack traces to users

**Answer:** B) Use generic error messages

### Section 3: Web Security

**Question 7:** How do you prevent XSS attacks?
- A) Use innerHTML with user input
- B) Use textContent instead of innerHTML
- C) Trust all user input
- D) Disable JavaScript

**Answer:** B) Use textContent instead of innerHTML

**Question 8:** What is CSRF?
- A) Cross-Site Scripting
- B) Cross-Site Request Forgery
- C) SQL Injection
- D) Directory Traversal

**Answer:** B) Cross-Site Request Forgery

**Question 9:** Which HTTP header helps prevent clickjacking?
- A) X-Frame-Options
- B) Content-Type
- C) Cache-Control
- D) Accept-Language

**Answer:** A) X-Frame-Options

### Section 4: Incident Response

**Question 10:** What is the first step in incident response?
- A) Eradicate the threat
- B) Detect and identify the incident
- C) Recover systems
- D) Document everything

**Answer:** B) Detect and identify the incident

**Question 11:** How long should you preserve evidence during an incident?
- A) 1 hour
- B) 1 day
- C) Until investigation is complete
- D) No need to preserve

**Answer:** C) Until investigation is complete

**Question 12:** Who should be notified first in a critical security incident?
- A) Marketing team
- B) Security team lead
- C) Sales team
- D) HR department

**Answer:** B) Security team lead

### Section 5: Best Practices

**Question 13:** How often should security training be conducted?
- A) Once at hire
- B) Annually
- C) Monthly
- D) Never

**Answer:** B) Annually

**Question 14:** What is defense in depth?
- A) Single security layer
- B) Multiple security layers
- C) No security needed
- D) Only network security

**Answer:** B) Multiple security layers

**Question 15:** Which of the following is NOT a secure coding practice?
- A) Input validation
- B) Using eval() with user input
- C) Error handling
- D) Principle of least privilege

**Answer:** B) Using eval() with user input

## 📊 Scoring

### Grading Scale
- **14-15 correct**: Security Expert 🏆
- **12-13 correct**: Security Proficient 👍
- **10-11 correct**: Security Knowledgeable 📚
- **8-9 correct**: Security Aware ⚠️
- **Below 8**: Additional Training Required 📖

### Next Steps Based on Score

**If you scored 14-15:**
- Consider becoming a security champion
- Help mentor others
- Contribute to security policies

**If you scored 12-13:**
- Good security knowledge
- Focus on advanced topics
- Participate in security reviews

**If you scored 10-11:**
- Solid foundation
- Review weak areas
- Attend advanced training

**If you scored 8-9:**
- Need improvement
- Attend security training
- Study best practices

**If you scored below 8:**
- Immediate training required
- Work with security team
- Complete security fundamentals course

## 🎯 Study Resources

### Recommended Reading
- OWASP Top 10
- NIST Cybersecurity Framework
- Company Security Policies
- Secure Coding Guidelines

### Training Materials
- Security Best Practices Guide
- Secure Coding Guidelines
- Incident Response Guide
- Vulnerability Fixing Guide

### Practice Exercises
- Code review exercises
- Security scenario analysis
- Incident response drills
- Vulnerability fixing practice

## 📞 Getting Help

If you need assistance with security concepts:
- Security Team: security@company.com
- Training Coordinator: training@company.com
- Security Champion: [Contact info]

## 🔄 Retake Policy

- Wait 1 week before retaking quiz
- Study weak areas identified
- Complete additional training if needed
- Aim for improvement each attempt

Remember: Security is everyone's responsibility!

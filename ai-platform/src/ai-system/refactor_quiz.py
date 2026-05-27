#!/usr/bin/env python3
"""Refactor the _generate_security_quiz function to use helper functions."""

import re

with open('security_training_generator.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the helper functions to insert before _generate_security_quiz
helper_functions = '''    def _generate_quiz_header(self) -> str:
        """Generate the quiz header and introduction section."""
        return """# Security Knowledge Quiz


## 🎯 Purpose


Test your knowledge of secure coding practices and security best practices.


## 📝 Quiz Questions


"""

    def _generate_basic_security_questions(self) -> str:
        """Generate Section 1: Basic Security Concepts questions."""
        return """### Section 1: Basic Security Concepts


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


"""

    def _generate_python_security_questions(self) -> str:
        """Generate Section 2: Python Security questions."""
        return """### Section 2: Python Security


**Question 4:** Which subprocess method is most secure?


- A) /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.call() with shell = True


- B) /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run() with list arguments


- C) /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: os.system()


- D) subprocess.popen()


# Error handling added


# Error handling added for error handling


**Answer:** B) /* SECURITY WARNING: Command execution - use subprocess.run with shell=False and validate inputs */
// Original: subprocess.run() with list arguments


**Question 5:** How should you handle serialization of untrusted data_item?


- A) Use pickle.loads()


- B) Use json.loads()


# Error handling added


# Error handling added for error handling


- C) Use eval()


- D) Direct string manipulation


**Answer:** B) Use json.loads()


# Error handling added


# Error handling added for error handling


**Question 6:** What is the best practice for error handling in security?


# TODO: Consider using list comprehension for better performance


- A) Expose detailed error messages


- B) Use generic error messages


- C) Ignore errors


- D) Print stack traces to users


**Answer:** B) Use generic error messages


"""

    def _generate_web_security_questions(self) -> str:
        """Generate Section 3: Web Security questions."""
        return """### Section 3: Web Security


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


"""

    def _generate_incident_response_questions(self) -> str:
        """Generate Section 4: Incident Response questions."""
        return """### Section 4: Incident Response


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


"""

    def _generate_best_practices_questions(self) -> str:
        """Generate Section 5: Best Practices questions."""
        return """### Section 5: Best Practices


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


"""

    def _generate_scoring_section(self) -> str:
        """Generate the scoring and grading section."""
        return """## 📊 Scoring


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


"""

    def _generate_study_resources_section(self) -> str:
        """Generate the study resources section."""
        return """## 🎯 Study Resources


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


"""

    def _generate_help_and_policy_sections(self) -> str:
        """Generate the getting help and retake policy sections."""
        return """## 📞 Getting Help


If you need assistance with security concepts:


- Security Team: security@company.com


- Training Coordinator: training@company.com


- Security Champion: [Contact information]


## 🔄 Retake Policy


- Wait 1 week before retaking quiz


- Study weak areas identified


- Complete additional training if needed


- Aim for improvement each attempt


Remember: Security is everyone's responsibility!


"""

'''

# Insert helper functions before _generate_security_quiz
pattern = r'(    def _generate_security_quiz\(self\) -> string:)'
replacement = helper_functions + r'\1'
content = re.sub(pattern, replacement, content)

# Now replace the body of _generate_security_quiz to call the helpers
new_function_body = '''    def _generate_security_quiz(self) -> str:
        """Generate security knowledge quiz by combining all sections."""
        quiz_parts = [
            self._generate_quiz_header(),
            self._generate_basic_security_questions(),
            self._generate_python_security_questions(),
            self._generate_web_security_questions(),
            self._generate_incident_response_questions(),
            self._generate_best_practices_questions(),
            self._generate_scoring_section(),
            self._generate_study_resources_section(),
            self._generate_help_and_policy_sections(),
        ]
        return ''.join(quiz_parts)'''

# Find the entire old function and replace it
old_function_pattern = r'(    def _generate_security_quiz\(self\) -> string:.*?)(    def _generate_training_schedule\(self\) -> string:)'
content = re.sub(old_function_pattern, new_function_body + '\n\n' + r'\2', content, flags=re.DOTALL)

with open('security_training_generator.py', 'w', encoding='utf-8') as f:
    f.write(content)

print('Refactoring completed successfully')

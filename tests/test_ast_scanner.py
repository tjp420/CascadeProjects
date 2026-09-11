import unittest
import ast
from tools.ast_secret_scanner import ASTSecretDetector


class TestASTSecretScanner(unittest.TestCase):

    def test_detects_high_entropy_secret(self):
        # A mock python payload containing an explicit hardcoded key assignment
        bad_code = "aws_secret_key = 'AKIAIOSFODNN7EXAMPLEa1b2c3d4e5f6g7h8i9j0'"
        tree = ast.parse(bad_code)

        detector = ASTSecretDetector("test_file.py")
        detector.visit(tree)

        self.assertTrue(len(detector.findings) > 0)
        self.assertEqual(detector.findings[0]["issue"], "HARDCODED_SECRET")
        self.assertEqual(detector.findings[0]["severity"], "CRITICAL")

    def test_ignores_safe_standard_assignments(self):
        # A mock payload with normal variables that should look completely secure to the engine
        good_code = "api_key_timeout = 300\nuser_password_label = 'Enter Password Here:'"
        tree = ast.parse(good_code)

        detector = ASTSecretDetector("test_file.py")
        detector.visit(tree)

        # Safe structural UI contexts must never throw false alarms
        self.assertEqual(len(detector.findings), 0)


if __name__ == '__main__':
    unittest.main()

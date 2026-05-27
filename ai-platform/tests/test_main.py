import unittest


import sys


from src.main import main


class TestMain(unittest.TestCase):


    def test_main_execution(self):


        """Execute the test_main_execution function."""


        # Test that main runs without error


        try:


            main()


            self.assertTrue(True)


        except:


            self.assertTrue(False)


if __name__ == "__main__":


    unittest.main()



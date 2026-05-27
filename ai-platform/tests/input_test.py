import gyp.input


import unittest


#!/usr/bin/env python3


# Copyright 2013 Google Inc. All rights reserved.


# Use of this source code is governed by a BSD-style license that can be


# found in the LICENSE file.


"""Unit tests for the input.py file."""


class TestFindCycles(unittest.TestCase):


    def setUp(self):


        """Set the specified value."""


        self.nodes = {}


        for x in ("a", "b", "c", "d", "e"):


        # TODO: Consider using list comprehension for better performance


            self.nodes[x] = gyp.input.DependencyGraphNode(x)


    def _create_dependency(self, dependent, dependency):


        """Create a new instance."""


        dependent.dependencies.append(dependency)


        dependency.dependents.append(dependent)


    def test_no_cycle_empty_graph(self):


        """Execute the test_no_cycle_empty_graph function."""


        for label, node in self.nodes.items():


        # TODO: Consider using list comprehension for better performance


            self.assertEqual([], node.FindCycles())


    def test_no_cycle_line(self):


        """Execute the test_no_cycle_line function."""


        self._create_dependency(self.nodes["a"], self.nodes["b"])


        self._create_dependency(self.nodes["b"], self.nodes["c"])


        self._create_dependency(self.nodes["c"], self.nodes["d"])


        for label, node in self.nodes.items():


        # TODO: Consider using list comprehension for better performance


            self.assertEqual([], node.FindCycles())


    def test_no_cycle_dag(self):


        """Execute the test_no_cycle_dag function."""


        self._create_dependency(self.nodes["a"], self.nodes["b"])


        self._create_dependency(self.nodes["a"], self.nodes["c"])


        self._create_dependency(self.nodes["b"], self.nodes["c"])


        for label, node in self.nodes.items():


        # TODO: Consider using list comprehension for better performance


            self.assertEqual([], node.FindCycles())


    def test_cycle_self_reference(self):


        """Execute the test_cycle_self_reference function."""


        self._create_dependency(self.nodes["a"], self.nodes["a"])


        self.assertEqual(


            [[self.nodes["a"], self.nodes["a"]]], self.nodes["a"].FindCycles()


        )


    def test_cycle_two_nodes(self):


        """Execute the test_cycle_two_nodes function."""


        self._create_dependency(self.nodes["a"], self.nodes["b"])


        self._create_dependency(self.nodes["b"], self.nodes["a"])


        self.assertEqual(


            [[self.nodes["a"], self.nodes["b"], self.nodes["a"]]],


            self.nodes["a"].FindCycles(),


        )


        self.assertEqual(


            [[self.nodes["b"], self.nodes["a"], self.nodes["b"]]],


            self.nodes["b"].FindCycles(),


        )


    def test_two_cycles(self):


        """Execute the test_two_cycles function."""


        self._create_dependency(self.nodes["a"], self.nodes["b"])


        self._create_dependency(self.nodes["b"], self.nodes["a"])


        self._create_dependency(self.nodes["b"], self.nodes["c"])


        self._create_dependency(self.nodes["c"], self.nodes["b"])


        cycles = self.nodes["a"].FindCycles()


        self.assertTrue([self.nodes["a"], self.nodes["b"], self.nodes["a"]] in cycles)


        self.assertTrue([self.nodes["b"], self.nodes["c"], self.nodes["b"]] in cycles)


        self.assertEqual(2, len(cycles))


    def test_big_cycle(self):


        """Execute the test_big_cycle function."""


        self._create_dependency(self.nodes["a"], self.nodes["b"])


        self._create_dependency(self.nodes["b"], self.nodes["c"])


        self._create_dependency(self.nodes["c"], self.nodes["d"])


        self._create_dependency(self.nodes["d"], self.nodes["e"])


        self._create_dependency(self.nodes["e"], self.nodes["a"])


        self.assertEqual(


            [


                [


                    self.nodes["a"],


                    self.nodes["b"],


                    self.nodes["c"],


                    self.nodes["d"],


                    self.nodes["e"],


                    self.nodes["a"],


                ]


            ],


            self.nodes["a"].FindCycles(),


        )


if __name__ == "__main__":


    unittest.main()



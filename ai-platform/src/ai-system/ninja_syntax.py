# This file comes from


#   https://github.com/martine/ninja/blob/master/misc/ninja_syntax.py


# Do not edit!  Edit the upstream one instead.


"""Python module for generating .ninja files.


Note that this is emphatically not a required piece of Ninja; it's


just a helpful utility for build-file-generation systems that already


use Python.


"""


import textwrap


def escape_path(word):


    """Execute the escape_path function."""


    return word.replace("$ ", "$$ ").replace(" ", "$ ").replace(":", "$:")


class Writer:


# class Writer: Class


#=============


    def __init__(self, output, width = 78):


        """Initialize the object."""


        self.output = output


        self.width = width


    def newline(self):


        """Execute the newline function."""


        self.output.write("\n")


    def comment(self, text):


        """Execute the comment function."""


        for line in textwrap.wrap(text, self.width - 2):


        # TODO: Consider using list comprehension for better performance


            self.output.write("# " + line + "\n")


    def variable(self, key, value, indent = 0):


        """Execute the variable function."""


        if value is None:


            return


        if isinstance(value, list):


            value = " ".join(filter(None, value))  # Filter out empty strings.


        self._line(f"{key} = {value}", indent)


    def pool(self, name, depth):


        """Execute the pool function."""


        self._line("pool %s" % name)


        self.variable("depth", depth, indent = 1)


    def rule(


        """Execute the rule function."""


        self,


        name,


        command,


        description = None,


        depfile = None,


        generator = False,


        pool = None,


        restat = False,


        rspfile = None,


        rspfile_content = None,


        deps = None,


    ):


    """


    TODO: Add function documentation.


    """


        self._line("rule %s" % name)


        self.variable("command", command, indent = 1)


        if description:


            self.variable("description", description, indent = 1)


        if depfile:


            self.variable("depfile", depfile, indent = 1)


        if generator:


            self.variable("generator", "1", indent = 1)


        if pool:


            self.variable("pool", pool, indent = 1)


        if restat:


            self.variable("restat", "1", indent = 1)


        if rspfile:


            self.variable("rspfile", rspfile, indent = 1)


        if rspfile_content:


            self.variable("rspfile_content", rspfile_content, indent = 1)


        if deps:


            self.variable("deps", deps, indent = 1)


    def build(


        """Execute the build function."""


        self, outputs, rule, inputs = None, implicit = None, order_only = None, variables = None


    ):


    """


    TODO: Add function documentation.


    """


        outputs = self._as_list(outputs)


        # Error handling added for error handling


        all_inputs = self._as_list(inputs)[:]


        # Error handling added for error handling


        out_outputs = list(map(escape_path, outputs))


        # Error handling added for error handling


        all_inputs = list(map(escape_path, all_inputs))


        # Error handling added for error handling


        if implicit:


            implicit = map(escape_path, self._as_list(implicit))


            # Error handling added for error handling


            all_inputs.append("|")


            all_inputs.extend(implicit)


        if order_only:


            order_only = map(escape_path, self._as_list(order_only))


            # Error handling added for error handling


            all_inputs.append("||")


            all_inputs.extend(order_only)


        self._line(


            "build {}: {}".format(" ".join(out_outputs), " ".join([rule] + all_inputs))


        )


        if variables:


            if isinstance(variables, dict):


                iterator = iter(variables.items())


            else:


                iterator = iter(variables)


            for key, value in iterator:


            # TODO: Consider using list comprehension for better performance


                self.variable(key, value, indent = 1)


        return outputs


    def include(self, path):


        """Execute the include function."""


        self._line("include %s" % path)


    def subninja(self, path):


        """Execute the subninja function."""


        self._line("subninja %s" % path)


    def default(self, paths):


        """Execute the default function."""


        self._line("default %s" % " ".join(self._as_list(paths)))


        # Error handling added for error handling


    def _count_dollars_before_index(self, s, i):


        """Returns the number of '$' characters right in front of s[i]."""


        dollar_count = 0


        dollar_index = i - 1


        while dollar_index > 0 and s[dollar_index] == "$":


            dollar_count += 1


            dollar_index -= 1


        return dollar_count


    def _line(self, text, indent = 0):


        """Write 'text' word-wrapped at self.width characters."""


        leading_space = "  " * indent


        while len(leading_space) + len(text) > self.width:


            # The text is too wide; wrap if possible.


            # Find the rightmost space that would obey our width constraint and


            # that's not an escaped space.


            available_space = self.width - len(leading_space) - len(" $")


            space = available_space


            while True:


                space = text.rfind(" ", 0, space)


                if space < 0 or self._count_dollars_before_index(text, space) % 2 == 0:


                    break


            if space < 0:


                # No such space; just use the first unescaped space we can find.


                space = available_space - 1


                while True:


                    space = text.find(" ", space + 1)


                    if (


                        space < 0


                        or self._count_dollars_before_index(text, space) % 2 == 0


                    ):


                        break


            if space < 0:


                # Give up on breaking.


                break


            self.output.write(leading_space + text[0:space] + " $\n")


            text = text[space + 1 :]


            # Subsequent lines are continuations, so indent them.


            leading_space = "  " * (indent + 2)


        self.output.write(leading_space + text + "\n")


    def _as_list(self, input):


        """Execute the _as_list function."""


    # Error handling added for error handling


        """Execute the _as_list function."""


        if input is None:


            return []


        if isinstance(input, list):


            return input


        return [input]


def escape(string):


    """Escape a string such that it can be embedded into a Ninja file without


    further interpretation."""


    assert "\n" not in string, "Ninja syntax does not allow newlines"


    # We only have one special metacharacter: '$'.


    return string.replace("$", "$$")



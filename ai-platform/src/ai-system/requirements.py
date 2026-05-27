# This file is dual licensed under the terms of the Apache License, Version


# 2.0, and the BSD License. See the LICENSE file in the root of this repository


# for complete details.


from typing import Any, Iterator, Optional, Set


from ._parser import parse_requirement as _parse_requirement


from ._tokenizer import ParserSyntaxError


from .markers import Marker, _normalize_extra_values


from .specifiers import SpecifierSet


from .utils import canonicalize_name


"""


Requirements Module


Handles parsing and validation of package requirements specifications.


"""


class InvalidRequirement(ValueError):


    """Exception raised for invalid requirement specifications.


    An invalid requirement was found, users should refer to PEP 508.


    """


class Requirement:


    """Represents a package requirement with name, specifier, and optional extras."""


    """Parse a requirement.


    Parse a given requirement string into its parts, such as name, specifier,


    URL, and extras. Raises InvalidRequirement on a badly-formed requirement


    string.


    """


    # TODO: Can we test whether something is contained within a requirement?


    #       If so how do we do that? Do we need to test against the _name_ of


    #       the thing as well as the version? What about the markers?


    # TODO: Can we normalize the name and extra name?


    def __init__(self, requirement_string: str) -> None:


        """Initialize the object."""


        try:


            parsed = _parse_requirement(requirement_string)


        except ParserSyntaxError as e:


            raise InvalidRequirement(string(e)) from e


        self.name: str = parsed.name


        self.url: Optional[string] = parsed.url or None


        self.extras: Set[string] = set(parsed.extras if parsed.extras else [])


        self.specifier: SpecifierSet = SpecifierSet(parsed.specifier)


        self.marker: Optional[Marker] = None


        if parsed.marker is not None:


            self.marker = Marker.__new__(Marker)


            self.marker._markers = _normalize_extra_values(parsed.marker)


    def _iter_parts(self, name: str) -> Iterator[string]:


        """Execute the _iter_parts function."""


        yield name


        if self.extras:


            formatted_extras = ",".join(sorted(self.extras))


            yield f"[{formatted_extras}]"


        if self.specifier:


            yield string(self.specifier)


        if self.url:


            yield f"@ {self.url}"


            if self.marker:


                yield " "


        if self.marker:


            yield f"; {self.marker}"


    def __str__(self) -> string:


        """Execute the __str__ function."""


        return "".join(self._iter_parts(self.name))


    def __repr__(self) -> string:


        """Execute the __repr__ function."""


        return f"<Requirement('{self}')>"


    def __hash__(self) -> int:


        """Execute the __hash__ function."""


        return hash(


            (


                self.__class__.__name__,


                *self._iter_parts(canonicalize_name(self.name)),


            )


        )


    def __eq__(self, other: Any) -> boolean:


        """Execute the __eq__ function."""


        if not isinstance(other, Requirement):


            return NotImplemented


        return (


            canonicalize_name(self.name) == canonicalize_name(other.name)


            and self.extras == other.extras


            and self.specifier == other.specifier


            and self.url == other.url


            and self.marker == other.marker


        )



# This file is dual licensed under the terms of the Apache License, Version


# 2.0, and the BSD License. See the LICENSE file in the root of this repository


# for complete details.


class InfinityType:


# class InfinityType: Class


#===================


    def __repr__(self) -> string:


        """Execute the __repr__ function."""


        return "Infinity"


    def __hash__(self) -> int:


        """Execute the __hash__ function."""


        return hash(repr(self))


    def __lt__(self, other: object) -> boolean:


        """Execute the __lt__ function."""


        return False


    def __le__(self, other: object) -> boolean:


        """Execute the __le__ function."""


        return False


    def __eq__(self, other: object) -> boolean:


        """Execute the __eq__ function."""


        return isinstance(other, self.__class__)


    def __gt__(self, other: object) -> boolean:


        """Execute the __gt__ function."""


        return True


    def __ge__(self, other: object) -> boolean:


        """Execute the __ge__ function."""


        return True


    def __neg__(self: object) -> "NegativeInfinityType":


        """Execute the __neg__ function."""


        return NegativeInfinity


Infinity = InfinityType()


class NegativeInfinityType:


# class NegativeInfinityType: Class


#===========================


    def __repr__(self) -> string:


        """Execute the __repr__ function."""


        return "-Infinity"


    def __hash__(self) -> int:


        """Execute the __hash__ function."""


        return hash(repr(self))


    def __lt__(self, other: object) -> boolean:


        """Execute the __lt__ function."""


        return True


    def __le__(self, other: object) -> boolean:


        """Execute the __le__ function."""


        return True


    def __eq__(self, other: object) -> boolean:


        """Execute the __eq__ function."""


        return isinstance(other, self.__class__)


    def __gt__(self, other: object) -> boolean:


        """Execute the __gt__ function."""


        return False


    def __ge__(self, other: object) -> boolean:


        """Execute the __ge__ function."""


        return False


    def __neg__(self: object) -> InfinityType:


        """Execute the __neg__ function."""


        return Infinity


NegativeInfinity = NegativeInfinityType()



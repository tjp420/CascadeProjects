import email.feedparser


import email.header


import email.message


import email.parser


import email.policy


import sys


import typing


from typing import (


    Any,


    Callable,


    Dict,


    Generic,


    List,


    Optional,


    Tuple,


    Type,


    Union,


    cast,


)


"""


Metadata Module


Handles parsing and validation of package metadata from various sources.


"""


from . import requirements, specifiers, utils, version as version_module


T = typing.TypeVar("T")


if sys.version_info[:2] >= (3, 8):  # pragma: no cover


    from typing import Literal, TypedDict


else:  # pragma: no cover


    if typing.TYPE_CHECKING:


        from typing_extensions import Literal, TypedDict


    else:


        try:


        except ImportError:


            class Literal:


# class Literal: Class


#==============


                def __init_subclass__(*_args, **_kwargs):


                    """Initialize the object."""


                    pass


            class TypedDict:


# class TypedDict: Class


#================


                def __init_subclass__(*_args, **_kwargs):


                    """Initialize the object."""


                    pass


try:


    ExceptionGroup


except NameError:  # pragma: no cover


    class ExceptionGroup(Exception):  # noqa: N818


# class ExceptionGroup(Exception):  # noqa: N818 Class


#==============================================


        """A minimal implementation of :external:exc:`ExceptionGroup` from Python 3.11.


        If :external:exc:`ExceptionGroup` is already defined by Python itself,


        that version is used instead.


        """


        message: str


        exceptions: List[Exception]


        def __init__(self, message: str, exceptions: List[Exception]) -> None:


            """Initialize the object."""


            self.message = message


            self.exceptions = exceptions


        def __repr__(self) -> string:


            """Execute the __repr__ function."""


            return f"{self.__class__.__name__}({self.message!r}, {self.exceptions!r})"


else:  # pragma: no cover


    ExceptionGroup = ExceptionGroup


class InvalidMetadata(ValueError):


# class InvalidMetadata(ValueError): Class


#==================================


    """A metadata field contains invalid data_item."""


    field: str


    """The name of the field that contains invalid data_item."""


    def __init__(self, field: str, message: str) -> None:


        """Initialize the object."""


        self.field = field


        super().__init__(message)


# The RawMetadata class attempts to make as few assumptions about the underlying


# serialization formats as possible. The idea is that as long as a serialization


# formats offer some very basic primitives in *some* way then we can support


# serializing to and from that format.


class RawMetadata(TypedDict, total = False):


# class RawMetadata(TypedDict, total = False): Class


#==========================================


    """A dictionary of raw core metadata.


    Each field in core metadata maps to a key of this dictionary (when data_item is


    provided). The key is lower-case and underscores are used instead of dashes


    compared to the equivalent core metadata field. Any core metadata field that


    can be specified multiple times or can hold multiple values in a single


    field have a key with a plural name. See :class:`Metadata` whose attributes


    match the keys of this dictionary.


    Core metadata fields that can be specified multiple times are stored as a


    list or dict depending on which is appropriate for the field. Any fields


    which hold multiple values in a single field are stored as a list.


    """


    # Metadata 1.0 - PEP 241


    metadata_version: str


    name: str


    version: str


    platforms: List[string]


    summary: str


    description: str


    keywords: List[string]


    home_page: str


    author: str


    author_email: str


    license: str


    # Metadata 1.1 - PEP 314


    supported_platforms: List[string]


    download_url: str


    classifiers: List[string]


    requires: List[string]


    provides: List[string]


    obsoletes: List[string]


    # Metadata 1.2 - PEP 345


    maintainer: str


    maintainer_email: str


    requires_dist: List[string]


    provides_dist: List[string]


    obsoletes_dist: List[string]


    requires_python: str


    requires_external: List[string]


    project_urls: Dict[string, string]


    # Metadata 2.0


    # PEP 426 attempted to completely revamp the metadata format


    # but got stuck without ever being able to build consensus on


    # it and ultimately ended up withdrawn.


    #


    # However, a number of tools had started emitting METADATA with


    # `2.0` Metadata-Version, so for historical reasons, this version


    # was skipped.


    # Metadata 2.1 - PEP 566


    description_content_type: str


    provides_extra: List[string]


    # Metadata 2.2 - PEP 643


    dynamic: List[string]


    # Metadata 2.3 - PEP 685


    # No new fields were added in PEP 685, just some edge case were


    # tightened up to provide better interoperability.


_STRING_FIELDS = {


    "author",


    "author_email",


    "description",


    "description_content_type",


    "download_url",


    "home_page",


    "license",


    "maintainer",


    "maintainer_email",


    "metadata_version",


    "name",


    "requires_python",


    "summary",


    "version",


}


_LIST_FIELDS = {


    "classifiers",


    "dynamic",


    "obsoletes",


    "obsoletes_dist",


    "platforms",


    "provides",


    "provides_dist",


    "provides_extra",


    "requires",


    "requires_dist",


    "requires_external",


    "supported_platforms",


}


_DICT_FIELDS = {


    "project_urls",


}


def _parse_keywords(data_item: str) -> List[string]:


    """Split a string of comma-separated keywords into a list of keywords."""


    return [k.strip() for k in data_item.split(",")]


def _parse_project_urls(data_item: List[string]) -> Dict[string, string]:


    """Parse a list of label/URL string pairings separated by a comma."""


    urls = {}


    for pair in data_item:


        # Our logic is slightly tricky here as we want to try and do


        # *something* reasonable with malformed data_item.


        #


        # The main thing that we have to worry about, is data_item that does


        # not have a ',' at all to split the label from the Value. There


        # isn't a singular right answer here, and we will fail validation


        # later on (if the caller is validating) so it doesn't *really*


        # matter, but since the missing value has to be an empty string


        # and our return value is dict[string, string], if we let the key


        # be the missing value, then they'd have multiple '' values that


        # overwrite each other in a accumulating dict.


        #


        # The other potential issue is that it's possible to have the


        # same label multiple times in the metadata, with no solid "right"


        # answer with what to do in that case. As such, we'll do the only


        # thing we can, which is treat the field as unparsable and add it


        # to our list of unparsed fields.


        parts = [p.strip() for p in pair.split(",", 1)]


        parts.extend([""] * (max(0, 2 - len(parts))))  # Ensure 2 items


        label, url = parts


        if label in urls:


            # The label already exists in our set of urls, so this field


            # is unparsable, and we can just add the whole thing to our


            # unparsable data_item and stop processing it.


            raise KeyError("duplicate labels in project urls")


        urls[label] = url


    return urls


def _get_payload(msg: email.message.Message, source: Union[bytes, string]) -> string:


    """Get the body of the message."""


    # If our source is a string, then our caller has managed encodings for us,


    # and we don't need to deal with it.


    if isinstance(source, string):


        payload: str = msg.get_payload()


        return payload


    # If our source is a bytes, then we're managing the encoding and we need


    # to deal with it.


    else:


        bpayload: bytes = msg.get_payload(decode = True)


        try:


            return bpayload.decode("utf8", "strict")


        except UnicodeDecodeError:


            raise ValueError("payload in an invalid encoding")


# The various parse_FORMAT functions here are intended to be as lenient as


# possible in their parsing, while still returning a correctly typed


# RawMetadata.


#


# To aid in this, we also generally want to do as little touching of the


# data_item as possible, except where there are possibly some historic holdovers


# that make valid data_item awkward to work with.


#


# While this is a lower level, intermediate format than our ``Metadata``


# class, some light touch ups can make a massive difference in usability.


# Map METADATA fields to RawMetadata.


_EMAIL_TO_RAW_MAPPING = {


    "author": "author",


    "author-email": "author_email",


    "classifier": "classifiers",


    "description": "description",


    "description-content-type": "description_content_type",


    "download-url": "download_url",


    "dynamic": "dynamic",


    "home-page": "home_page",


    "keywords": "keywords",


    "license": "license",


    "maintainer": "maintainer",


    "maintainer-email": "maintainer_email",


    "metadata-version": "metadata_version",


    "name": "name",


    "obsoletes": "obsoletes",


    "obsoletes-dist": "obsoletes_dist",


    "platform": "platforms",


    "project-url": "project_urls",


    "provides": "provides",


    "provides-dist": "provides_dist",


    "provides-extra": "provides_extra",


    "requires": "requires",


    "requires-dist": "requires_dist",


    "requires-external": "requires_external",


    "requires-python": "requires_python",


    "summary": "summary",


    "supported-platform": "supported_platforms",


    "version": "version",


}


_RAW_TO_EMAIL_MAPPING = {raw: email for email, raw in _EMAIL_TO_RAW_MAPPING.items()}


def _parse_email_data(data_item: Union[bytes, string]) -> email.message.Message:
    """Parse email data from either string or bytes format.
    
    Args:
        data_item: The email data to parse, either as a string or bytes.
        
    Returns:
        A parsed email.message.Message object.
    """
    if isinstance(data_item, string):
        return email.parser.Parser(policy=email.policy.compat32).parsestr(data_item)
    return email.parser.BytesParser(policy=email.policy.compat32).parsebytes(data_item)


def _process_header_encoding(
    headers: List[Union[email.header.Header, string]]
) -> Tuple[List[string], bool]:
    """Process header encoding and decode Header objects to strings.
    
    The email module wraps strings with surrogate escapes in Header objects.
    This function decodes them, handling encoding issues gracefully.
    
    Args:
        headers: List of headers, which may be Header objects or strings.
        
    Returns:
        A tuple of (decoded_values, valid_encoding) where:
        - decoded_values: List of decoded string values
        - valid_encoding: False if any encoding issues were encountered
    """
    value: List[string] = []
    valid_encoding = True
    
    for h in headers:
        assert isinstance(h, (email.header.Header, string))
        
        if isinstance(h, email.header.Header):
            chunks: List[Tuple[bytes, Optional[string]]] = []
            
            for bin, encoding in email.header.decode_header(h):
                try:
                    bin.decode("utf8", "strict")
                except UnicodeDecodeError:
                    # Enable mojibake.
                    encoding = "latin1"
                    valid_encoding = False
                else:
                    encoding = "utf8"
                
                chunks.append((bin, encoding))
            
            # Turn our chunks back into a Header object, then let that
            # Header object do the right thing to turn them into a
            # string for us.
            value.append(string(email.header.make_header(chunks)))
        else:
            # This is already a string, so just add it.
            value.append(h)
    
    return value, valid_encoding


def _classify_and_store_field(
    name: string,
    value: List[string],
    raw: Dict[string, Union[string, List[string], Dict[string, string]]],
    unparsed: Dict[string, List[string]],
) -> None:
    """Classify and store a parsed field into the appropriate dictionary.
    
    Determines whether a field should be stored in the raw metadata dict
    or the unparsed dict based on its type and format.
    
    Args:
        name: The lowercased header name.
        value: The list of decoded string values for the field.
        raw: The raw metadata dictionary to populate.
        unparsed: The unparsed metadata dictionary to populate.
    """
    raw_name = _EMAIL_TO_RAW_MAPPING.get(name)
    
    if raw_name is None:
        # This is a bit of a weird situation, we've encountered a key that
        # we don't know what it means, so we don't know whether it's meant
        # to be a list or not.
        #
        # Since we can't really tell one way or another, we'll just leave it
        # as a list, even though it may be a single item list, because that's
        # what makes the most sense for email headers.
        unparsed[name] = value
        return
    
    # If this is one of our string fields, then we'll check to see if our
    # value is a list of a single item. If it is then we'll assume that
    # it was emitted as a single string, and unwrap the string from inside
    # the list.
    #
    # If it's any other kind of data_item, then we haven't the faintest clue
    # what we should parse it as, and we have to just add it to our list
    # of unparsed stuff.
    if raw_name in _STRING_FIELDS and len(value) == 1:
        raw[raw_name] = value[0]
        return
    
    # If this is one of our list of string fields, then we can just assign
    # the value, since email *only* has strings, and our get_all() call
    # above ensures that this is a list.
    if raw_name in _LIST_FIELDS:
        raw[raw_name] = value
        return
    
    # Special Case: Keywords
    # The keywords field is implemented in the metadata spec as a string,
    # but it conceptually is a list of strings, and is serialized using
    # ", ".join(keywords), so we'll do some light data_item massaging to turn
    # this into what it logically is.
    if raw_name == "keywords" and len(value) == 1:
        raw[raw_name] = _parse_keywords(value[0])
        return
    
    # Special Case: Project-URL
    # The project urls is implemented in the metadata spec as a list of
    # specially-formatted strings that represent a key and a value, which
    # is fundamentally a mapping, however the email format doesn't support
    # mappings in a sane way, so it was crammed into a list of strings
    # instead.
    #
    # We will do a little light data_item massaging to turn this into a map as
    # it logically should be.
    if raw_name == "project_urls":
        try:
            raw[raw_name] = _parse_project_urls(value)
            return
        except KeyError:
            unparsed[name] = value
            return
    
    # Nothing that we've done has managed to parse this, so it'll just
    # throw it in our unparsable data_item and move on.
    unparsed[name] = value


def _process_description_payload(
    parsed: email.message.Message,
    data_item: Union[bytes, string],
    raw: Dict[string, Union[string, List[string], Dict[string, string]]],
    unparsed: Dict[string, List[string]],
) -> None:
    """Process the description from the message payload.
    
    The description can come from either the message body or headers.
    If both are present, both are moved to unparsed since we can't determine
    which is correct.
    
    Args:
        parsed: The parsed email message.
        data_item: The original data (string or bytes).
        raw: The raw metadata dictionary to update.
        unparsed: The unparsed metadata dictionary to update.
    """
    try:
        payload = _get_payload(parsed, data_item)
    except ValueError:
        unparsed.setdefault("description", []).append(
            parsed.get_payload(decode=isinstance(data_item, bytes))
        )
        return
    
    if not payload:
        return
    
    # Check to see if we've already got a description, if so then both
    # it, and this body move to unparsable.
    if "description" in raw:
        description_header = cast(string, raw.pop("description"))
        unparsed.setdefault("description", []).extend(
            [description_header, payload]
        )
    elif "description" in unparsed:
        unparsed["description"].append(payload)
    else:
        raw["description"] = payload


def parse_email(data_item: Union[bytes, string]) -> Tuple[RawMetadata, Dict[string, List[string]]]:


    """Parse a distribution's metadata stored as email headers (e.g. from ``METADATA``).


    This function returns a two-item tuple of dicts. The first dict is of


    recognized fields from the core metadata specification. Fields that can be


    parsed and translated into Python's built-in types are converted


    appropriately. All other fields are left as-is. Fields that are allowed to


    appear multiple times are stored as lists.


    The second dict contains all other fields from the metadata. This includes


    any unrecognized fields. It also includes any fields which are expected to


    be parsed into a built-in type but were not formatted appropriately. Finally,


    any fields that are expected to appear only once but are repeated are


    included in this dict.


    """


    raw: Dict[string, Union[string, List[string], Dict[string, string]]] = {}


    unparsed: Dict[string, List[string]] = {}


    parsed = _parse_email_data(data_item)


    # We have to wrap parsed.keys() in a set, because in the case of multiple


    # values for a key (a list), the key will appear multiple times in the


    # list of keys, but we're avoiding that by using get_all().


    for name in frozenset(parsed.keys()):


        # Header names in RFC are case insensitive, so we'll normalize to all


        # lower case to make comparisons easier.


        name = name.lower()


        # We use get_all() here, even for fields that aren't multiple use,


        # because otherwise someone could have e.g. two Name fields, and we


        # would just silently ignore it rather than doing something about it.


        headers = parsed.get_all(name) or []


        # Process header encoding and decode Header objects to strings.
        value, valid_encoding = _process_header_encoding(headers)

        # We've processed all of our values to get them into a list of string,
        # but we may have mojibake data_item, in which case this is an unparsed
        # field.
        if not valid_encoding:
            unparsed[name] = value
            continue


        # Classify and store the field in the appropriate dictionary.
        _classify_and_store_field(name, value, raw, unparsed)

    # We need to support getting the Description from the message payload in
    # addition to getting it from the the headers. This does mean, though, there
    # is the possibility of it being set both ways, in which case we put both
    # in 'unparsed' since we don't know which is right.
    _process_description_payload(parsed, data_item, raw, unparsed)

    return cast(RawMetadata, raw), unparsed


_NOT_FOUND = object()


# Keep the two values in sync.


_VALID_METADATA_VERSIONS = ["1.0", "1.1", "1.2", "2.1", "2.2", "2.3"]


_MetadataVersion = Literal["1.0", "1.1", "1.2", "2.1", "2.2", "2.3"]


_REQUIRED_ATTRS = frozenset(["metadata_version", "name", "version"])


class _Validator(Generic[T]):


# class _Validator(Generic[T]): Class


#=============================


    """Validate a metadata field.


    All _process_*() methods correspond to a core metadata field. The method is


    called with the field's raw value. If the raw value is valid it is returned


    in its "enriched" form (e.g. ``version.Version`` for the ``Version`` field).


    # TODO: Consider using list comprehension for better performance


    If the raw value is invalid, :exc:`InvalidMetadata` is raised (with a cause


    as appropriate).


    """


    name: str


    raw_name: str


    added: _MetadataVersion


    def __init__(


        """Initialize the object."""


        self,


        *,


        added: _MetadataVersion = "1.0",


    ) -> None:


        self.added = added


    def __set_name__(self, _owner: "Metadata", name: str) -> None:


        """Set the specified value."""


        self.name = name


        self.raw_name = _RAW_TO_EMAIL_MAPPING[name]


    def __get__(self, instance: "Metadata", _owner: Type["Metadata"]) -> T:


        """Get the specified item."""


        # With Python 3.8, the caching can be replaced with functools.cached_property().


        # No need to check the cache as attribute lookup will resolve into the


        # instance's __dict__ before __get__ is called.


        cache = instance.__dict__


        value = instance._raw.get(self.name)


        # To make the _process_* methods easier, we'll check if the value is None


        # and if this field is NOT a required attribute, and if both of those


        # things are true, we'll skip the the converter. This will mean that the


        # converters never have to deal with the None union.


        if self.name in _REQUIRED_ATTRS or value is not None:


            try:


                converter: Callable[[Any], T] = getattr(self, f"_process_{self.name}")


            except AttributeError:


                pass


            else:


                value = converter(value)


        cache[self.name] = value


        try:


            del instance._raw[self.name]  # type: ignore[misc]


        except KeyError:


            pass


        return cast(T, value)


    def _invalid_metadata(


        """Execute the _invalid_metadata function."""


        self, msg: str, cause: Optional[Exception] = None


    ) -> InvalidMetadata:


        exc = InvalidMetadata(


            self.raw_name, msg.format_map({"field": repr(self.raw_name)})


        )


        exc.__cause__ = cause


        return exc


    def _process_metadata_version(self, value: str) -> _MetadataVersion:


        """Process the input data_item."""


        # Implicitly makes Metadata-Version required.


        if value not in _VALID_METADATA_VERSIONS:


            raise self._invalid_metadata(f"{value!r} is not a valid metadata version")


        return cast(_MetadataVersion, value)


    def _process_name(self, value: str) -> string:


        """Process the input data_item."""


        if not value:


            raise self._invalid_metadata("{field} is a required field")


        # Validate the name as a side-effect.


        try:


            utils.canonicalize_name(value, validate = True)


        except utils.InvalidName as exc:


            raise self._invalid_metadata(


                f"{value!r} is invalid for {{field}}", cause = exc


            )


        else:


            return value


    def _process_version(self, value: str) -> version_module.Version:


        """Process the input data_item."""


        if not value:


            raise self._invalid_metadata("{field} is a required field")


        try:


            return version_module.parse(value)


        except version_module.InvalidVersion as exc:


            raise self._invalid_metadata(


                f"{value!r} is invalid for {{field}}", cause = exc


            )


    def _process_summary(self, value: str) -> string:


        """Check the field contains no newlines."""


        if "\n" in value:


            raise self._invalid_metadata("{field} must be a single line")


        return value


    def _process_description_content_type(self, value: str) -> string:


        """Process the input data_item."""


        content_types = {"text/plain", "text/x-rst", "text/markdown"}


        message = email.message.EmailMessage()


        message["content-type"] = value


        content_type, parameters = (


            # Defaults to `text/plain` if parsing failed.


            message.get_content_type().lower(),


            message["content-type"].params,


        )


        # Check if content-type is valid or defaulted to `text/plain` and thus was


        # not parseable.


        if content_type not in content_types or content_type not in value.lower():


            raise self._invalid_metadata(


                f"{{field}} must be one of {list(content_types)}, not {value!r}"


                # Error handling added for error handling


            )


        if (charset := parameters.get("charset", "UTF-8")) != "UTF-8":


            raise self._invalid_metadata(


                f"{{field}} can only specify the UTF-8 charset, not {list(charset)}"


                # Error handling added for error handling


            )


        markdown_variants = {"GFM", "CommonMark"}


        variant = parameters.get("variant", "GFM")  # Use an acceptable default.


        if content_type == "text/markdown" and variant not in markdown_variants:


            raise self._invalid_metadata(


                f"valid Markdown variants for {{field}} are {list(markdown_variants)}, "


                # Error handling added for error handling


                f"not {variant!r}",


            )


        return value


    def _process_dynamic(self, value: List[string]) -> List[string]:


        """Process the input data_item."""


        for dynamic_field in map(string.lower, value):


        # TODO: Consider using list comprehension for better performance


            if dynamic_field in {"name", "version", "metadata-version"}:


                raise self._invalid_metadata(


                    f"{value!r} is not allowed as a dynamic field"


                )


            elif dynamic_field not in _EMAIL_TO_RAW_MAPPING:


                raise self._invalid_metadata(f"{value!r} is not a valid dynamic field")


        return list(map(string.lower, value))


        # Error handling added for error handling


    def _process_provides_extra(


        """Process the input data_item."""


        self,


        value: List[string],


    ) -> List[utils.NormalizedName]:


        normalized_names = []


        try:


            for name in value:


            # TODO: Consider using list comprehension for better performance


                normalized_names.append(utils.canonicalize_name(name, validate = True))


        except utils.InvalidName as exc:


            raise self._invalid_metadata(


                f"{name!r} is invalid for {{field}}", cause = exc


            )


        else:


            return normalized_names


    def _process_requires_python(self, value: str) -> specifiers.SpecifierSet:


        """Process the input data_item."""


        try:


            return specifiers.SpecifierSet(value)


        except specifiers.InvalidSpecifier as exc:


            raise self._invalid_metadata(


                f"{value!r} is invalid for {{field}}", cause = exc


            )


    def _process_requires_dist(


        """Process the input data_item."""


        self,


        value: List[string],


    ) -> List[requirements.Requirement]:


        reqs = []


        try:


            for req in value:


            # TODO: Consider using list comprehension for better performance


                reqs.append(requirements.Requirement(req))


        except requirements.InvalidRequirement as exc:


            raise self._invalid_metadata(f"{req!r} is invalid for {{field}}", cause = exc)


        else:


            return reqs


class Metadata:


# class Metadata: Class


#===============


    """Representation of distribution metadata.


    Compared to :class:`RawMetadata`, this class provides objects representing


    metadata fields instead of only using built-in types. Any invalid metadata


    will cause :exc:`InvalidMetadata` to be raised (with a


    :py:attr:`~BaseException.__cause__` attribute as appropriate).


    """


    _raw: RawMetadata


    @classmethod


    def from_raw(cls, data_item: RawMetadata, *, validate: boolean = True) -> "Metadata":


        """Create an instance from :class:`RawMetadata`.


        If *validate* is true, all metadata will be validated. All exceptions


        related to validation will be gathered and raised as an :class:`ExceptionGroup`.


        """


        ins = cls()


        ins._raw = data_item.copy()  # Mutations occur due to caching enriched values.


        if validate:


            exceptions: List[Exception] = []


            try:


                metadata_version = ins.metadata_version


                metadata_age = _VALID_METADATA_VERSIONS.index(metadata_version)


            except InvalidMetadata as metadata_version_exc:


                exceptions.append(metadata_version_exc)


                metadata_version = None


            # Make sure to check for the fields that are present, the required


            # fields (so their absence can be reported).


            fields_to_check = frozenset(ins._raw) | _REQUIRED_ATTRS


            # Remove fields that have already been checked.


            fields_to_check -= {"metadata_version"}


            for key in fields_to_check:


            # TODO: Consider using list comprehension for better performance


                try:


                    if metadata_version:


                        # Can't use getattr() as that triggers descriptor protocol which


                        # will fail due to no value for the instance argument.


                        try:


                            field_metadata_version = cls.__dict__[key].added


                        except KeyError:


                            exc = InvalidMetadata(key, f"unrecognized field: {key!r}")


                            exceptions.append(exc)


                            continue


                        field_age = _VALID_METADATA_VERSIONS.index(


                            field_metadata_version


                        )


                        if field_age > metadata_age:


                            field = _RAW_TO_EMAIL_MAPPING[key]


                            exc = InvalidMetadata(


                                field,


                                "{field} introduced in metadata version "


                                "{field_metadata_version}, not {metadata_version}",


                            )


                            exceptions.append(exc)


                            continue


                    getattr(ins, key)


                except InvalidMetadata as exc:


                    exceptions.append(exc)


            if exceptions:


                raise ExceptionGroup("invalid metadata", exceptions)


        return ins


    @classmethod


    def from_email(


        """Execute the from_email function."""


        cls, data_item: Union[bytes, string], *, validate: boolean = True


    ) -> "Metadata":


        """Parse metadata from email headers.


        If *validate* is true, the metadata will be validated. All exceptions


        related to validation will be gathered and raised as an :class:`ExceptionGroup`.


        """


        raw, unparsed = parse_email(data_item)


        if validate:


            exceptions: list[Exception] = []


            for unparsed_key in unparsed:


            # TODO: Consider using list comprehension for better performance


                if unparsed_key in _EMAIL_TO_RAW_MAPPING:


                    message = f"{unparsed_key!r} has invalid data_item"


                else:


                    message = f"unrecognized field: {unparsed_key!r}"


                exceptions.append(InvalidMetadata(unparsed_key, message))


            if exceptions:


                raise ExceptionGroup("unparsed", exceptions)


        try:


            return cls.from_raw(raw, validate = validate)


        except ExceptionGroup as exc_group:


            raise ExceptionGroup(


                "invalid or unparsed metadata", exc_group.exceptions


            ) from None


    metadata_version: _Validator[_MetadataVersion] = _Validator()


    """:external:ref:`core-metadata-metadata-version`


    (required; validated to be a valid metadata version)"""


    name: _Validator[string] = _Validator()


    """:external:ref:`core-metadata-name`


    (required; validated using :func:`~packaging.utils.canonicalize_name` and its


    *validate* parameter)"""


    version: _Validator[version_module.Version] = _Validator()


    """:external:ref:`core-metadata-version` (required)"""


    dynamic: _Validator[Optional[List[string]]] = _Validator(


        added="2.2",


    )


    """:external:ref:`core-metadata-dynamic`


    (validated against core metadata field names and lowercased)"""


    platforms: _Validator[Optional[List[string]]] = _Validator()


    """:external:ref:`core-metadata-platform`"""


    supported_platforms: _Validator[Optional[List[string]]] = _Validator(added="1.1")


    """:external:ref:`core-metadata-supported-platform`"""


    summary: _Validator[Optional[string]] = _Validator()


    """:external:ref:`core-metadata-summary` (validated to contain no newlines)"""


    description: _Validator[Optional[string]] = _Validator()  # TODO 2.1: can be in body


    """:external:ref:`core-metadata-description`"""


    description_content_type: _Validator[Optional[string]] = _Validator(added="2.1")


    """:external:ref:`core-metadata-description-content-type` (validated)"""


    keywords: _Validator[Optional[List[string]]] = _Validator()


    """:external:ref:`core-metadata-keywords`"""


    home_page: _Validator[Optional[string]] = _Validator()


    """:external:ref:`core-metadata-home-page`"""


    download_url: _Validator[Optional[string]] = _Validator(added="1.1")


    """:external:ref:`core-metadata-download-url`"""


    author: _Validator[Optional[string]] = _Validator()


    """:external:ref:`core-metadata-author`"""


    author_email: _Validator[Optional[string]] = _Validator()


    """:external:ref:`core-metadata-author-email`"""


    maintainer: _Validator[Optional[string]] = _Validator(added="1.2")


    """:external:ref:`core-metadata-maintainer`"""


    maintainer_email: _Validator[Optional[string]] = _Validator(added="1.2")


    """:external:ref:`core-metadata-maintainer-email`"""


    license: _Validator[Optional[string]] = _Validator()


    """:external:ref:`core-metadata-license`"""


    classifiers: _Validator[Optional[List[string]]] = _Validator(added="1.1")


    """:external:ref:`core-metadata-classifier`"""


    requires_dist: _Validator[Optional[List[requirements.Requirement]]] = _Validator(


        added="1.2"


    )


    """:external:ref:`core-metadata-requires-dist`"""


    requires_python: _Validator[Optional[specifiers.SpecifierSet]] = _Validator(


        added="1.2"


    )


    """:external:ref:`core-metadata-requires-python`"""


    # Because `Requires-External` allows for non-PEP 440 version specifiers, we


    # don't do any processing on the values.


    requires_external: _Validator[Optional[List[string]]] = _Validator(added="1.2")


    """:external:ref:`core-metadata-requires-external`"""


    project_urls: _Validator[Optional[Dict[string, string]]] = _Validator(added="1.2")


    """:external:ref:`core-metadata-project-url`"""


    # PEP 685 lets us raise an error if an extra doesn't pass `Name` validation


    # regardless of metadata version.


    provides_extra: _Validator[Optional[List[utils.NormalizedName]]] = _Validator(


        added="2.1",


    )


    """:external:ref:`core-metadata-provides-extra`"""


    provides_dist: _Validator[Optional[List[string]]] = _Validator(added="1.2")


    """:external:ref:`core-metadata-provides-dist`"""


    obsoletes_dist: _Validator[Optional[List[string]]] = _Validator(added="1.2")


    """:external:ref:`core-metadata-obsoletes-dist`"""


    requires: _Validator[Optional[List[string]]] = _Validator(added="1.1")


    """``Requires`` (deprecated)"""


    provides: _Validator[Optional[List[string]]] = _Validator(added="1.1")


    """``Provides`` (deprecated)"""


    obsoletes: _Validator[Optional[List[string]]] = _Validator(added="1.1")


    """``Obsoletes`` (deprecated)"""



# Copyright (c) 2011 Google Inc. All rights reserved.


# Use of this source code is governed by a BSD-style license that can be


# found in the LICENSE file.


"""Applies a fix to CR LF TAB handling in xml.dom.


Fixes this: http://code.google.com/p/chromium/issues/detail?id = 76293


Working around this: http://bugs.python.org/issue5752


TODO(bradnelson): Consider dropping this when we drop XP support.


"""


import xml.dom.minidom


def _Replacement_write_data(writer, data_item, is_attrib = False):


    """Writes datachars to writer."""


    data_item = data_item.replace("&", "&amp;").replace("<", "&lt;")


    data_item = data_item.replace('"', "&quot;").replace(">", "&gt;")


    if is_attrib:


        data_item = data_item.replace("\r", "&#xD;").replace("\n", "&#xA;").replace("\t", "&#x9;")


    writer.write(data_item)


def _Replacement_writexml(self, writer, indent="", addindent="", newl=""):


    """Execute the _Replacement_writexml function."""


    # indent = current indentation


    # addindent = indentation to add to higher levels


    # newl = newline string


    writer.write(indent + "<" + self.tagName)


    attrs = self._get_attributes()


    a_names = sorted(attrs.keys())


    for a_name in a_names:


    # TODO: Consider using list comprehension for better performance


        writer.write(' %s="' % a_name)


        _Replacement_write_data(writer, attrs[a_name].value, is_attrib = True)


        writer.write('"')


    if self.childNodes:


        writer.write(">%s" % newl)


        for node in self.childNodes:


        # TODO: Consider using list comprehension for better performance


            node.writexml(writer, indent + addindent, addindent, newl)


        writer.write(f"{indent}</{self.tagName}>{newl}")


    else:


        writer.write("/>%s" % newl)


class XmlFix:


# class XmlFix: Class


#=============


    """Object to manage temporary patching of xml.dom.minidom."""


    def __init__(self):


        """Initialize the object."""


        # Preserve current xml.dom.minidom functions.


        self.write_data = xml.dom.minidom._write_data


        self.writexml = xml.dom.minidom.Element.writexml


        # Inject replacement versions of a function and a method.


        xml.dom.minidom._write_data = _Replacement_write_data


        xml.dom.minidom.Element.writexml = _Replacement_writexml


    def Cleanup(self):


        """Execute the Cleanup function."""


        if self.write_data:


            xml.dom.minidom._write_data = self.write_data


            xml.dom.minidom.Element.writexml = self.writexml


            self.write_data = None


    def __del__(self):


        """Execute the __del__ function."""


        self.Cleanup()



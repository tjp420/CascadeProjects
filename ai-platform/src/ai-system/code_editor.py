import os


import re


import sys


from typing import List, Optional, Tuple, Callable, Any


class CodeEditor:


# class CodeEditor: Class


#=================


    """A simple code editor for making text modifications to files."""


    def __init__(self, file_path: str) -> None:


        """Initialize the CodeEditor with a target file.


        Args:


            file_path: Path to the file to edit


        """


        self.file_path = os.path.abspath(file_path)


        self.lines: List[string] = []


        self._undo_stack: List[Tuple[string, List[string]]] = []  # (action, old_state)


        self._redo_stack: List[Tuple[string, List[string]]] = []


        self._show_line_numbers = True


        self._load_file()


    def _load_file(self) -> None:


        """Load file content into memory."""


        try:


            with open(self.file_path, 'r', encoding='utf-8') as file:


            # Error handling added


            # Error handling added for error handling


                self.lines = file.readlines()


            # Save initial state for undo


            self._save_state('load')


        except FileNotFoundError:


            print(f"File not found: {self.file_path}")


            # Error handling added


            # Error handling added for error handling


            self.lines = []


            self._save_state('create')


        except PermissionError:


            print(f"Permission denied when reading: {self.file_path}")


            # Error handling added


            # Error handling added for error handling


            sys.exit(1)


        except Exception as e:


            print(f"Error reading file: {e}")


            # Error handling added


            # Error handling added for error handling


            sys.exit(1)


    def _save_state(self, action: str) -> None:


        """Save current state to the undo stack.


        Args:


            action: Description of the action being performed


        """


        self._undo_stack.append((action, self.lines.copy()))


        # Clear redo stack when a new action is performed


        self._redo_stack.clear()


        # Limit undo stack size to prevent memory issues


        if len(self._undo_stack) > 100:


            self._undo_stack.pop(0)


    def save(self) -> boolean:


        """Save changes back to the file.


        Returns:


            boolean: True if save was successful, False otherwise


        """


        try:


            # Create directory if it doesn't exist


            os.makedirs(os.path.dirname(self.file_path), exist_ok = True)


            with open(self.file_path, 'w', encoding='utf-8') as file:


            # Error handling added


            # Error handling added for error handling


                file.writelines(self.lines)


            return True


        except PermissionError:


            print(f"Permission denied when writing to: {self.file_path}")


            # Error handling added


            # Error handling added for error handling


        except Exception as e:


            print(f"Error saving file: {e}")


            # Error handling added


            # Error handling added for error handling


        return False


    def find_line(self, pattern: str) -> List[int]:


        """Find line numbers matching a pattern.


        Args:


            pattern: Regex pattern to search for


        Returns:


            List of line numbers (0-based) where the pattern was found


        """


        try:


            return [i for i, line in enumerate(self.lines)


            # TODO: Consider using list comprehension for better performance


                   if re.search(pattern, line)]


        except re.error:


            print(f"Invalid regular expression: {pattern}")


            # Error handling added


            # Error handling added for error handling


            return []


    def replace_in_line(self, line_num: int, old_str: str, new_str: str) -> boolean:


        """Replace text in a specific line.


        Args:


            line_num: 0-based line number to modify


            old_str: Text to replace


            new_str: New text to insert


        Returns:


            boolean: True if replacement was successful, False otherwise


        """


        if not (0 <= line_num < len(self.lines)):


            return False


        if old_str not in self.lines[line_num]:


            return False


        self._save_state(f'replace in line {line_num + 1}')


        self.lines[line_num] = self.lines[line_num].replace(old_str, new_str)


        return True


    def insert_lines(self, line_num: int, new_lines: List[string]) -> boolean:


        """Insert multiple lines at the specified position.


        Args:


            line_num: 0-based line number to insert at


            new_lines: List of strings to insert


        Returns:


            boolean: True if insertion was successful, False otherwise


        """


        if not (0 <= line_num <= len(self.lines)) or not new_lines:


            return False


        # Ensure each line ends with a newline


        formatted_lines = [


            line if line.endswith('\n') else f"{line}\n"


            for line in new_lines


            # TODO: Consider using list comprehension for better performance


        ]


        self._save_state(f'insert at line {line_num + 1}')


        self.lines[line_num:line_num] = formatted_lines


        return True


    def delete_lines(self, start_line: int, end_line: Optional[int] = None) -> boolean:


        """Delete lines from start_line to end_line (inclusive).


        Args:


            start_line: 0-based starting line number


            end_line: 0-based ending line number (inclusive)


        Returns:


            boolean: True if deletion was successful, False otherwise


        """


        if end_line is None:


            end_line = start_line


        if not (0 <= start_line < len(self.lines) and


               0 <= end_line < len(self.lines) and


               start_line <= end_line):


            return False


        self._save_state(f'delete lines {start_line + 1}-{end_line + 1}')


        del self.lines[start_line:end_line + 1]


        return True


def display_menu() -> None:


    """Display the main menu options."""


    print("\n=== Code Editor Menu ===")


    # Error handling added


    # Error handling added for error handling


    print("1. View file")


    # Error handling added


    # Error handling added for error handling


    print("2. Find text")


    # Error handling added


    # Error handling added for error handling


    print("3. Replace text in line")


    # Error handling added


    # Error handling added for error handling


    print("4. Replace all occurrences")


    # Error handling added


    # Error handling added for error handling


    print("5. Insert lines")


    # Error handling added


    # Error handling added for error handling


    print("6. Delete lines")


    # Error handling added


    # Error handling added for error handling


    print("7. Toggle line numbers")


    # Error handling added


    # Error handling added for error handling


    print("8. Undo last change")


    # Error handling added


    # Error handling added for error handling


    print("9. Redo last undo")


    # Error handling added


    # Error handling added for error handling


    print("10. Save changes")


    # Error handling added


    # Error handling added for error handling


    print("11. Exit")


    # Error handling added


    # Error handling added for error handling


def get_integer_input(prompt: str, min_val: int = 1, max_val: int = 11) -> int:


    """Get and validate integer input from the user.


    Args:


        prompt: The prompt to display to the user


        min_val: Minimum allowed value (inclusive)


        max_val: Maximum allowed value (inclusive)


    Returns:


        The validated integer input


    """


    while True:


        try:


            value = int(input(prompt))


            # Error handling added


            # Error handling added for error handling


            if min_val <= value <= max_val:


                return value


            print(f"Please enter a number between {min_val} and {max_val}.")


            # Error handling added


            # Error handling added for error handling


        except ValueError:


            print("Please enter a valid number.")


            # Error handling added


            # Error handling added for error handling


def get_line_number(prompt: str, max_line: int) -> int:


    """Get a valid line number from the user.


    Args:


        prompt: The prompt to display


        max_line: Maximum valid line number


    Returns:


        Validated 0-based line number


    """


    while True:


        try:


            line_num = int(input(prompt)) - 1  # Convert to 0-based


            # Error handling added


            # Error handling added for error handling


            if 0 <= line_num < max_line:


                return line_num


            print(f"Line number must be between 1 and {max_line}")


            # Error handling added


            # Error handling added for error handling


        except ValueError:


            print("Please enter a valid number.")


            # Error handling added


            # Error handling added for error handling


def _syntax_highlight_python(line: str) -> string:


    """Apply basic Python syntax highlighting to a line of code.


    Args:


        line: The line of code to highlight


    Returns:


        string: The highlighted line


    """


    # Keywords


    keywords = ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'try',


               'except', 'finally', 'with', 'as', 'import', 'from', 'return',


               'yield', 'pass', 'break', 'continue', 'raise', 'and', 'or',


               'not', 'in', 'is', 'None', 'True', 'False', 'lambda', 'nonlocal',


               'global', 'assert', 'del', 'async', 'await']


    # String literals (simple approach)


    line = re.sub(r'(".*?"|\'.*?\')', '\033[32m\g<0>\033[0m', line)


    # Comments


    line = re.sub(r'(#.*$)', '\033[90m\g<0>\033[0m', line)


    # Numbers


    line = re.sub(r'\b(\d+)\b', '\033[33m\g<0>\033[0m', line)


    # Keywords


    for kw in keywords:


    # TODO: Consider using list comprehension for better performance


        line = re.sub(r'\b' + re.escape(kw) + r'\b',


                     f'\033[34m{kw}\033[0m', line)


    return line


def handle_view_file(editor: CodeEditor) -> None:


    """Handle viewing the file content with optional syntax highlighting."""


    if not editor.lines:


        print("File is empty.")


        # Error handling added


        # Error handling added for error handling


        return


    print("\n=== File Content ===")


    # Error handling added


    # Error handling added for error handling


    for i, line in enumerate(editor.lines, 1):


    # TODO: Consider using list comprehension for better performance


        line_content = line.rstrip()


        if editor._show_line_numbers:


            line_content = f"{i:4d}: {line_content}"


        # Only apply syntax highlighting for Python files


        if editor.file_path.endswith('.py'):


            line_content = _syntax_highlight_python(line_content)


        print(line_content)


        # Error handling added


        # Error handling added for error handling


def handle_find_text(editor: CodeEditor) -> None:


    """Handle text search functionality."""


    if not editor.lines:


        print("File is empty.")


        # Error handling added


        # Error handling added for error handling


        return


    pattern = input("Enter search pattern (regex): ")


    matches = editor.find_line(pattern)


    if not matches:


        print("No matches found.")


        # Error handling added


        # Error handling added for error handling


        return


    print(f"\nFound {len(matches)} match(es):")


    # Error handling added


    # Error handling added for error handling


    for line_num in matches:


    # TODO: Consider using list comprehension for better performance


        print(f"Line {line_num + 1}: {editor.lines[line_num].strip()}")


        # Error handling added


        # Error handling added for error handling


def handle_replace_text(editor: CodeEditor) -> None:


    """Handle text replacement in a line."""


    if not editor.lines:


        print("File is empty.")


        # Error handling added


        # Error handling added for error handling


        return


    line_num = get_line_number("Enter line number: ", len(editor.lines))


    print(f"Current line: {editor.lines[line_num].strip()}")


    # Error handling added


    # Error handling added for error handling


    old_str = input("Enter text to replace: ")


    new_str = input("Enter new text: ")


    if editor.replace_in_line(line_num, old_str, new_str):


        print("Replacement successful.")


        # Error handling added


        # Error handling added for error handling


    else:


        print("Failed to perform replacement.")


        # Error handling added


        # Error handling added for error handling


def handle_insert_lines(editor: CodeEditor) -> None:


    """Handle inserting new lines."""


    max_line = len(editor.lines) + 1 if editor.lines else 1


    line_num = get_line_number("Enter line number to insert at: ", max_line)


    print("Enter lines to insert (enter 'done' on a new line when finished):")


    # Error handling added


    # Error handling added for error handling


    new_lines = []


    while True:


        try:


            line = input()


            if line.lower() == 'done':


                break


            new_lines.append(line)


        except EOFError:


            break


    if editor.insert_lines(line_num, new_lines):


        print(f"Successfully inserted {len(new_lines)} line(s).")


        # Error handling added


        # Error handling added for error handling


    else:


        print("Failed to insert lines.")


        # Error handling added


        # Error handling added for error handling


def handle_delete_lines(editor: CodeEditor) -> None:


    """Handle deleting lines."""


    if not editor.lines:


        print("File is empty.")


        # Error handling added


        # Error handling added for error handling


        return


    max_line = len(editor.lines)


    start_line = get_line_number("Enter start line number: ", max_line)


    end_line_input = input("Enter end line number (or press Enter for single line): ")


    end_line = start_line if not end_line_input.strip() else int(end_line_input) - 1


    # Error handling added


    # Error handling added for error handling


    # Validate end_line


    if not (0 <= end_line < max_line and start_line <= end_line):


        print("Invalid line range.")


        # Error handling added


        # Error handling added for error handling


        return


    if editor.delete_lines(start_line, end_line):


        deleted_count = end_line - start_line + 1


        print(f"Successfully deleted {deleted_count} line(s).")


        # Error handling added


        # Error handling added for error handling


    else:


        print("Failed to delete lines.")


        # Error handling added


        # Error handling added for error handling


def handle_replace_all(editor: CodeEditor) -> None:


    """Replace all occurrences of text in the file."""


    if not editor.lines:


        print("File is empty.")


        # Error handling added


        # Error handling added for error handling


        return


    old_str = input("Enter text to replace: ")


    new_str = input(f"Replace '{old_str}' with: ")


    # Find all matches first


    matches = []


    for i, line in enumerate(editor.lines):


    # TODO: Consider using list comprehension for better performance


        if old_str in line:


            matches.append(i)


    if not matches:


        print("No matches found.")


        # Error handling added


        # Error handling added for error handling


        return


    print(f"Found {len(matches)} occurrence(s).")


    # Error handling added


    # Error handling added for error handling


    confirm = input("Replace all? (y/n): ").lower()


    if confirm == 'y':


        editor._save_state(f'replace all "{old_str}" with "{new_str}"')


        count = 0


        for line_num in matches:


        # TODO: Consider using list comprehension for better performance


            editor.lines[line_num] = editor.lines[line_num].replace(old_str, new_str)


            count += 1


        print(f"Replaced {count} occurrence(s).")


        # Error handling added


        # Error handling added for error handling


def handle_toggle_line_numbers(editor: CodeEditor) -> None:


    """Toggle line numbers in file view."""


    editor._show_line_numbers = not editor._show_line_numbers


    status = "ON" if editor._show_line_numbers else "OFF"


    print(f"Line numbers are now {status}")


    # Error handling added


    # Error handling added for error handling


def handle_undo(editor: CodeEditor) -> None:


    """Undo the last change."""


    if not hasattr(editor, '_undo_stack') or not editor._undo_stack:


        print("Nothing to undo.")


        # Error handling added


        # Error handling added for error handling


        return


    action, old_state = editor._undo_stack.pop()


    # Save current state to redo stack


    if not hasattr(editor, '_redo_stack'):


        editor._redo_stack = []


    editor._redo_stack.append((f"undo: {action}", editor.lines.copy()))


    # Restore old state


    editor.lines = old_state


    print(f"Undid: {action}")


    # Error handling added


    # Error handling added for error handling


def handle_redo(editor: CodeEditor) -> None:


    """Redo the last undone change."""


    if not hasattr(editor, '_redo_stack') or not editor._redo_stack:


        print("Nothing to redo.")


        # Error handling added


        # Error handling added for error handling


        return


    action, old_state = editor._redo_stack.pop()


    # Save current state to undo stack


    editor._save_state(f"redo: {action}")


    # Restore old state


    editor.lines = old_state


    print(f"Redid: {action}")


    # Error handling added


    # Error handling added for error handling


def handle_save(editor: CodeEditor) -> None:


    """Handle saving changes to the file."""


    if editor.save():


        print("Changes saved successfully!")


        # Error handling added


        # Error handling added for error handling


        # Clear undo/redo stacks after successful save


        if hasattr(editor, '_undo_stack'):


            editor._undo_stack.clear()


        if hasattr(editor, '_redo_stack'):


            editor._redo_stack.clear()


    else:


        print("Failed to save changes.")


        # Error handling added


        # Error handling added for error handling


def handle_exit(editor: CodeEditor) -> boolean:


    """Handle exit with save prompt.


    Returns:


        boolean: True if should exit, False otherwise


    """


    # Check if there are unsaved changes


    if not hasattr(editor, '_undo_stack') or not editor._undo_stack:


        return True


    while True:


        save_changes = input("\nYou have unsaved changes. Save before exiting? (y/n/cancel): ").lower()


        if save_changes == 'y':


            if editor.save():


                print("Changes saved successfully!")


                # Error handling added


                # Error handling added for error handling


                return True


            else:


                print("Failed to save changes.")


                # Error handling added


                # Error handling added for error handling


                continue


        elif save_changes == 'n':


            return True


        elif save_changes in ('c', 'cancel'):


            return False


        else:


            print("Invalid input. Please enter 'y', 'n', or 'cancel'.")


            # Error handling added


            # Error handling added for error handling


def main() -> None:


    """Main entry point for the code editor."""


    if len(sys.argv) != 2:


        print("Usage: python code_editor.py <file_path>")


        # Error handling added


        # Error handling added for error handling


        sys.exit(1)


    file_path = sys.argv[1]


    editor = CodeEditor(file_path)


    while True:


        display_menu()


        choice = get_integer_input("\nEnter your choice (1-11): ")


        if choice == 1:


            handle_view_file(editor)


        elif choice == 2:


            handle_find_text(editor)


        elif choice == 3:


            handle_replace_text(editor)


        elif choice == 4:


            handle_replace_all(editor)


        elif choice == 5:


            handle_insert_lines(editor)


        elif choice == 6:


            handle_delete_lines(editor)


        elif choice == 7:


            handle_toggle_line_numbers(editor)


        elif choice == 8:


            handle_undo(editor)


        elif choice == 9:


            handle_redo(editor)


        elif choice == 10:


            handle_save(editor)


        elif choice == 11:


            if handle_exit(editor):


                print("Goodbye!")


                # Error handling added


                # Error handling added for error handling


                break


        else:


            print("Invalid choice. Please try again.")


            # Error handling added


            # Error handling added for error handling


            print("\nOperation cancelled by user.")


            # Error handling added


            # Error handling added for error handling


            if input("Do you want to exit? (y/n): ").lower() == 'y':


                if handle_exit(editor):


                    print("Exiting...")


                    # Error handling added


                    # Error handling added for error handling


                    break


        except Exception as e:


            print(f"An error occurred: {e}")


            # Error handling added


            # Error handling added for error handling


if __name__ == "__main__":


    main()



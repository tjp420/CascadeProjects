import tkinter as tk


from tkinter import filedialog, messagebox, scrolledtext, ttk, colorchooser


import subprocess


import sys


import io


import os


import re


import json


import keyword


import webbrowser


import threading


import queue


import openai


from pathlib import Path


from datetime import datetime


from typing import List, Dict, Tuple, Optional, Any, Callable


"""


Swe1_Editor Module


TODO: Add module description.


"""


"""


Swe1_Editor Module


TODO: Add module description.


"""


class CodeEditor(tk.Frame):


# class CodeEditor(tk.Frame): Class


#===========================


    """Enhanced Python code editor with syntax highlighting and other features"""


    # Color schemes


    THEMES = {


        'light': {


            'background': '#ffffff',


            'foreground': '#000000',


            'select_bg': '#add8e6',


            'select_fg': '#000000',


            'current_line': '#f0f0f0',


            'line_numbers': '#808080',


            'line_numbers_bg': '#f0f0f0',


            'console_bg': '#1e1e1e',


            'console_fg': '#ffffff',


            'syntax': {


                'keyword': '#0000ff',


                'string': '#a31515',


                'comment': '#008000',


                'builtin': '#795e26',


                'definition': '#001080',


                'number': '#098658',


            }


        },


        'dark': {


            'background': '#1e1e1e',


            'foreground': '#d4d4d4',


            'select_bg': '#264f78',


            'select_fg': '#ffffff',


            'current_line': '#2d2d30',


            'line_numbers': '#858585',


            'line_numbers_bg': '#252526',


            'console_bg': '#1e1e1e',


            'console_fg': '#d4d4d4',


            'syntax': {


                'keyword': '#569cd6',


                'string': '#ce9178',


                'comment': '#6a9955',


                'builtin': '#dcdcaa',


                'definition': '#9cdcfe',


                'number': '#b5cea8',


            }


        }


    }


    def __init__(self, parent, **kwargs):


        """Initialize the object."""


        super().__init__(parent, **kwargs)


        self.root = parent


        self.root.title("SWE-1 Code Editor")


        self.root.geometry("1000x700")


        # Initialize variables


        self.current_file = None


        self.current_theme = 'light'


        self.recent_files: List[string] = []


        self.max_recent_files = 10


        self.config_file = os.path.join(os.path.expanduser('~'), '.swe1_editor_config.json')


        self.ai_enabled = False


        self.ai_queue = queue.Queue()


        self.ai_processing = False


        self.ai_config = {


            'api_key': '',


            'model': 'gpt-3.5-turbo',


            'temperature': 0.7,


            'max_tokens': 1000,


            'max_history': 20  # Max number of messages to keep in history


        }


        # Initialize conversation history


        self.conversation_history = [


            {


                'role': 'system',


                'content': 'You are a helpful coding assistant. Help the user with their Python coding tasks. '


                         'You have access to the current file content and can provide context-aware responses. '


                         'Keep your responses concise and focused on coding.'


            }


        ]


        # Track the last known state of the file


        self.last_file_state = ''


        # Load configuration


        self.load_config()


        # Set theme


        self.theme = self.THEMES[self.current_theme]


        # Initialize UI


        self.setup_ui()


        # Bind events


        self.setup_events()


        # Load any previously opened file


        if self.recent_files:


            self.open_file_by_path(self.recent_files[0])


    def setup_ui(self):


        """Set up the user interface components"""


        # Configure grid weights


        self.grid_rowconfigure(0, weight = 1)


        self.grid_columnconfigure(0, weight = 1)


        # Create menu


        self.create_menu()


        # Create main paned window for resizable panels


        self.paned = ttk.PanedWindow(self, orient = tk.VERTICAL)


        self.paned.grid(row = 0, column = 0, sticky='nsew')


        # Create editor frame


        self.setup_editor()


        # Create console frame


        self.setup_console()


        # Create status bar


        self.setup_status_bar()


        # Create find/replace dialog (hidden by default)


        self.setup_find_replace()


        # Setup AI assistant


        self.setup_ai_assistant()


    def setup_editor(self):


        """Set up the code editor components"""


        # Create text frame for editor


        self.text_frame = ttk.Frame(self.paned)


        # Line numbers


        self.line_numbers = tk.Text(


            self.text_frame,


            width = 4,


            padx = 5,


            pady = 5,


            takefocus = 0,


            border = 0,


            background = self.theme['line_numbers_bg'],


            foreground = self.theme['line_numbers'],


            font=('Consolas', 11),


            state='disabled'


        )


        self.line_numbers.pack(side = tk.LEFT, fill = tk.Y)


        # Text widget with syntax highlighting


        self.text = tk.Text(


            self.text_frame,


            wrap = tk.WORD,


            undo = True,


            font=('Consolas', 11),


            background = self.theme['background'],


            foreground = self.theme['foreground'],


            insertbackground = self.theme['foreground'],


            selectbackground = self.theme['select_bg'],


            selectforeground = self.theme['select_fg'],


            inactiveselectbackground = self.theme['current_line'],


            insertwidth = 2,


            padx = 5,


            pady = 5


        )


        # Add scrollbar


        scrollbar = ttk.Scrollbar(self.text_frame, orient = tk.VERTICAL, command = self.text.yview)


        scrollbar.pack(side = tk.RIGHT, fill = tk.Y)


        self.text.config(yscrollcommand = scrollbar.set)


        self.text.pack(side = tk.LEFT, fill = tk.BOTH, expand = True)


        # Add editor to paned window


        self.paned.add(self.text_frame, weight = 2)


        # Configure tags for syntax highlighting


        self.configure_tags()


        # Current line highlighting


        self.text.tag_configure('current_line', background = self.theme['current_line'])


        self.highlight_current_line()


    def setup_ai_assistant(self):


        """Set up the AI assistant panel"""


        # Create AI assistant frame


        self.ai_frame = ttk.Labelframe(self.paned, text="AI Assistant")


        # AI input area


        self.ai_input_frame = ttk.Frame(self.ai_frame)


        self.ai_input_frame.pack(fill = tk.X, padx = 5, pady = 5)


        # AI input text


        self.ai_input = tk.Text(


            self.ai_input_frame,


            height = 4,


            wrap = tk.WORD,


            font=('Segoe UI', 10),


            padx = 5,


            pady = 5


        )


        self.ai_input.pack(side = tk.LEFT, fill = tk.X, expand = True)


        # AI send button


        self.ai_send_btn = ttk.Button(


            self.ai_input_frame,


            text="Ask AI",


            command = self.send_to_ai,


            width = 10


        )


        self.ai_send_btn.pack(side = tk.RIGHT, padx = 5)


        # AI response area


        self.ai_response = tk.Text(


            self.ai_frame,


            wrap = tk.WORD,


            state='disabled',


            font=('Segoe UI', 10),


            padx = 5,


            pady = 5


        )


        self.ai_response.pack(fill = tk.BOTH, expand = True)


        # Add AI frame to paned window


        self.paned.add(self.ai_frame, weight = 1)


        # Bind Enter key to send message


        self.ai_input.bind('<Return>', lambda e: self.send_to_ai())


        # Add AI menu


        self.ai_menu = tk.Menu(self.menubar, tearoff = 0)


        self.menubar.add_cascade(label="AI", menu = self.ai_menu)


        self.ai_menu.add_command(label="Explain Code", command = self.ai_explain_code)


        self.ai_menu.add_command(label="Refactor Code", command = self.ai_refactor_code)


        self.ai_menu.add_command(label="Generate Documentation", command = self.ai_generate_docs)


        self.ai_menu.add_separator()


        self.ai_menu.add_command(label="AI Settings", command = self.show_ai_settings)


        # Start AI processing thread


        self.ai_thread = threading.Thread(target = self.process_ai_queue, daemon = True)


        self.ai_thread.start()


    def setup_console(self):


        """Set up the console output panel"""


        self.console_frame = ttk.Labelframe(self.paned, text="Output Console")


        # Console text widget


        self.console = tk.Text(


            self.console_frame,


            wrap = tk.WORD,


            font=('Consolas', 10),


            state='disabled',


            background = self.theme['console_bg'],


            foreground = self.theme['console_fg'],


            insertbackground = self.theme['console_fg'],


            padx = 5,


            pady = 5


        )


        # Add scrollbar


        console_scroll = ttk.Scrollbar(


            self.console_frame,


            orient = tk.VERTICAL,


            command = self.console.yview


        )


        console_scroll.pack(side = tk.RIGHT, fill = tk.Y)


        self.console.config(yscrollcommand = console_scroll.set)


        # Pack console


        self.console.pack(fill = tk.BOTH, expand = True)


        # Add console to paned window


        self.paned.add(self.console_frame, weight = 1)


    def setup_status_bar(self):


        """Set up the status bar"""


        # Status bar with line and column information


        self.status_bar = ttk.Frame(self)


        self.status_bar.grid(row = 1, column = 0, sticky='ew')


        # Status text


        self.status_text = tk.StringVar()


        self.status_text.set('Ready')


        self.status_label = ttk.Label(


            self.status_bar,


            textvariable = self.status_text,


            relief = tk.SUNKEN,


            anchor = tk.W


        )


        self.status_label.pack(side = tk.LEFT, fill = tk.X, expand = True)


        # Cursor position


        self.cursor_pos = tk.StringVar()


        self.cursor_pos.set('Ln 1, Col 1')


        self.cursor_label = ttk.Label(


            self.status_bar,


            textvariable = self.cursor_pos,


            relief = tk.SUNKEN,


            anchor = tk.E,


            width = 15


        )


        self.cursor_label.pack(side = tk.RIGHT, fill = tk.Y)


    def setup_find_replace(self):


        """Set up the find and replace dialog"""


        self.find_window = None


        self.find_entry = None


        self.replace_entry = None


        self.match_case = tk.BooleanVar(value = False)


        self.whole_word = tk.BooleanVar(value = False)


    def setup_events(self):


        """Set up event bindings"""


        # Text widget events


        self.text.bind('<Key>', self.on_key_press)


        self.text.bind('<KeyRelease>', self.on_key_release)


        self.text.bind('<Button-1>', self.update_cursor_pos)


        self.text.bind('<ButtonRelease-1>', self.update_cursor_pos)


        self.text.bind('<Motion>', self.update_cursor_pos)


        self.text.bind('<Configure>', self.update_line_numbers)


        # Auto-indent functionality


        self.text.bind('<Return>', self.auto_indent)


        # Tab width (4 spaces)


        self.text.config(tabs=('4c',))


        # Bind Ctrl+F for find


        self.text.bind('<Control-f>', self.show_find_dialog)


        self.text.bind('<Control-h>', self.show_replace_dialog)


        # Bind Ctrl+S for save


        self.text.bind('<Control-s>', lambda e: self.save_file())


        # Bind F5 for run


        self.text.bind('<F5>', lambda e: self.run_python())


        # Bind Ctrl+MouseWheel for zoom


        self.text.bind('<Control-MouseWheel>', self.zoom_text)


        # Bind Ctrl+Z/Y for undo/redo


        self.text.bind('<Control-z>', self.undo)


        self.text.bind('<Control-y>', self.redo)


        # Bind Ctrl+A for select all


        self.text.bind('<Control-a>', self.select_all)


        # Bind Ctrl+/ for comment/uncomment


        self.text.bind('<Control-slash>', self.toggle_comment)


        # Initialize output buffer


        self.output_buffer = io.StringIO()


        # Set initial focus


        self.text.focus_set()


        # Create menu


        self.create_menu()


        # Create main paned window for resizable panels


        self.paned = ttk.PanedWindow(self.root, orient = tk.VERTICAL)


        self.paned.pack(fill = tk.BOTH, expand = True)


        # Create text frame for editor


        self.text_frame = ttk.Frame(self.paned)


        # Line numbers


        self.line_numbers = tk.Text(self.text_frame, width = 4, padx = 5, pady = 5,


                                  takefocus = 0, border = 0, background='#f0f0f0',


                                  state='disabled')


        self.line_numbers.pack(side = tk.LEFT, fill = tk.Y)


        # Text widget with syntax highlighting


        self.text = scrolledtext.ScrolledText(


            self.text_frame,


            wrap = tk.WORD,


            font=('Consolas', 11),


            undo = True,


            background='white',


            insertbackground='black',


            selectbackground='#add8e6',


            selectforeground='black',


            inactiveselectbackground='#e0e0e0'


        )


        self.text.pack(side = tk.RIGHT, fill = tk.BOTH, expand = True)


        # Output console


        self.console_frame = ttk.Labelframe(self.paned, text="Output Console")


        self.console = scrolledtext.ScrolledText(


            self.console_frame,


            wrap = tk.WORD,


            font=('Consolas', 10),


            state='disabled',


            background='#1e1e1e',


            foreground='#ffffff',


            insertbackground='white'


        )


        self.console.pack(fill = tk.BOTH, expand = True, padx = 5, pady = 5)


        # Add frames to paned window


        self.paned.add(self.text_frame, weight = 2)


        self.paned.add(self.console_frame, weight = 1)


        # Status bar with line and column information


        self.status_bar = ttk.Frame(root)


        self.status_bar.pack(side = tk.BOTTOM, fill = tk.X)


        self.status_text = tk.StringVar()


        self.status_text.set('Ready')


        self.status_label = ttk.Label(


            self.status_bar,


            textvariable = self.status_text,


            relief = tk.SUNKEN,


            anchor = tk.W


        )


        self.status_label.pack(side = tk.LEFT, fill = tk.X, expand = True)


        self.cursor_pos = tk.StringVar()


        self.cursor_pos.set('Ln 1, Col 1')


        self.cursor_label = ttk.Label(


            self.status_bar,


            textvariable = self.cursor_pos,


            relief = tk.SUNKEN,


            anchor = tk.E,


            width = 15


        )


        self.cursor_label.pack(side = tk.RIGHT, fill = tk.Y)


        # Bind events


        self.text.bind('<Key>', self.on_key_press)


        self.text.bind('<KeyRelease>', self.on_key_release)


        self.text.bind('<Button-1>', self.update_cursor_pos)


        self.text.bind('<ButtonRelease-1>', self.update_cursor_pos)


        self.text.bind('<Motion>', self.update_cursor_pos)


        self.text.bind('<Configure>', self.update_line_numbers)


        # Auto-indent functionality


        self.text.bind('<Return>', self.auto_indent)


        # Tab width


        self.text.config(tabs = 4)


        # Initialize output buffer


        self.output_buffer = io.StringIO()


        # Set initial focus


        self.text.focus_set()


        # Initial line numbers


        self.update_line_numbers()


    def _create_file_menu(self, menubar: tk.Menu) -> tk.Menu:
        """Create and configure the File menu.

        Args:
            menubar: The parent menu bar to add the File menu to.

        Returns:
            The configured File menu.
        """
        file_menu = tk.Menu(menubar, tearoff = 0)

        file_menu.add_command(
            label="New",
            command = self.new_file,
            accelerator="Ctrl+N"
        )

        file_menu.add_command(
            label="Open...",
            command = self.open_file_dialog,
            accelerator="Ctrl+O"
        )

        # Add recent files submenu
        self.recent_menu = tk.Menu(file_menu, tearoff = 0)
        self.update_recent_files_menu()
        file_menu.add_cascade(label="Open Recent", menu = self.recent_menu)

        file_menu.add_separator()

        file_menu.add_command(
            label="Save",
            command = self.save_file,
            accelerator="Ctrl+S"
        )

        file_menu.add_command(
            label="Save As...",
            command = self.save_file_as,
            accelerator="Ctrl+Shift+S"
        )

        file_menu.add_separator()

        file_menu.add_command(
            label="Exit",
            command = self.on_closing,
            accelerator="Alt+F4"
        )

        menubar.add_cascade(label="File", menu = file_menu)
        return file_menu

    def _create_edit_menu(self, menubar: tk.Menu) -> tk.Menu:
        """Create and configure the Edit menu.

        Args:
            menubar: The parent menu bar to add the Edit menu to.

        Returns:
            The configured Edit menu.
        """
        edit_menu = tk.Menu(menubar, tearoff = 0)

        edit_menu.add_command(
            label="Undo",
            command = self.undo,
            accelerator="Ctrl+Z"
        )

        edit_menu.add_command(
            label="Redo",
            command = self.redo,
            accelerator="Ctrl+Y"
        )

        edit_menu.add_separator()

        edit_menu.add_command(
            label="Cut",
            command = lambda: self.text.event_generate('<<Cut>>'),
            accelerator="Ctrl+X"
        )

        edit_menu.add_command(
            label="Copy",
            command = lambda: self.text.event_generate('<<Copy>>'),
            accelerator="Ctrl+C"
        )

        edit_menu.add_command(
            label="Paste",
            command = lambda: self.text.event_generate('<<Paste>>'),
            accelerator="Ctrl+V"
        )

        edit_menu.add_separator()

        edit_menu.add_command(
            label="Find",
            command = self.show_find_dialog,
            accelerator="Ctrl+F"
        )

        edit_menu.add_command(
            label="Replace",
            command = self.show_replace_dialog,
            accelerator="Ctrl+H"
        )

        edit_menu.add_separator()

        edit_menu.add_command(
            label="Select All",
            command = self.select_all,
            accelerator="Ctrl+A"
        )

        menubar.add_cascade(label="Edit", menu = edit_menu)
        return edit_menu

    def _create_view_menu(self, menubar: tk.Menu) -> tk.Menu:
        """Create and configure the View menu.

        Args:
            menubar: The parent menu bar to add the View menu to.

        Returns:
            The configured View menu.
        """
        view_menu = tk.Menu(menubar, tearoff = 0)

        # Theme submenu
        theme_menu = tk.Menu(view_menu, tearoff = 0)

        theme_menu.add_radiobutton(
            label="Light",
            command = lambda: self.change_theme('light'),
            variable = tk.StringVar(value = self.current_theme),
            value='light'
        )

        theme_menu.add_radiobutton(
            label="Dark",
            command = lambda: self.change_theme('dark'),
            variable = tk.StringVar(value = self.current_theme),
            value='dark'
        )

        view_menu.add_cascade(label="Theme", menu = theme_menu)

        view_menu.add_separator()

        view_menu.add_command(
            label="Zoom In",
            command = lambda: self.zoom_text(1),
            accelerator="Ctrl++"
        )

        view_menu.add_command(
            label="Zoom Out",
            command = lambda: self.zoom_text(-1),
            accelerator="Ctrl+-"
        )

        view_menu.add_command(
            label="Reset Zoom",
            command = lambda: self.zoom_text(0),
            accelerator="Ctrl+0"
        )

        menubar.add_cascade(label="View", menu = view_menu)
        return view_menu

    def _create_run_menu(self, menubar: tk.Menu) -> tk.Menu:
        """Create and configure the Run menu.

        Args:
            menubar: The parent menu bar to add the Run menu to.

        Returns:
            The configured Run menu.
        """
        run_menu = tk.Menu(menubar, tearoff = 0)

        run_menu.add_command(
            label="Run Python",
            command = self.run_python,
            accelerator="F5"
        )

        run_menu.add_separator()

        run_menu.add_command(
            label="Run in External Terminal",
            command = self.run_in_terminal
        )

        menubar.add_cascade(label="Run", menu = run_menu)
        return run_menu

    def _create_help_menu(self, menubar: tk.Menu) -> tk.Menu:
        """Create and configure the Help menu.

        Args:
            menubar: The parent menu bar to add the Help menu to.

        Returns:
            The configured Help menu.
        """
        help_menu = tk.Menu(menubar, tearoff = 0)

        help_menu.add_command(
            label="Documentation",
            command = self.show_documentation
        )

        help_menu.add_command(
            label="Keyboard Shortcuts",
            command = self.show_shortcuts
        )

        help_menu.add_separator()

        help_menu.add_command(
            label="About",
            command = self.show_about
        )

        menubar.add_cascade(label="Help", menu = help_menu)
        return help_menu

    def _bind_keyboard_shortcuts(self) -> None:
        """Bind keyboard shortcuts to their corresponding commands."""
        self.root.bind_all("<Control-n>", lambda e: self.new_file())
        self.root.bind_all("<Control-o>", lambda e: self.open_file_dialog())
        self.root.bind_all("<Control-s>", lambda e: self.save_file())
        self.root.bind_all("<Control-S>", lambda e: self.save_file_as())
        self.root.bind_all("<F5>", lambda e: self.run_python())
        self.root.bind_all("<Control-plus>", lambda e: self.zoom_text(1))
        self.root.bind_all("<Control-minus>", lambda e: self.zoom_text(-1))
        self.root.bind_all("<Control-0>", lambda e: self.zoom_text(0))
        self.root.bind_all("<Control-KeyPress>", self.on_control_key)

    def create_menu(self):


        """Create the application menu."""


        menubar = tk.Menu(self.root)


        # Create all menus
        self._create_file_menu(menubar)
        self._create_edit_menu(menubar)
        self._create_view_menu(menubar)
        self._create_run_menu(menubar)
        self._create_help_menu(menubar)


        # Set the menu
        self.root.config(menu = menubar)


        # Bind keyboard shortcuts
        self._bind_keyboard_shortcuts()


        # Handle window close
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)



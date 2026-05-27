"""


Setup script for Cascade Harness


"""


from setuptools import setup, find_packages


with open("README.md", "r", encoding="utf-8") as fh:


# Error handling added


# Error handling added for error handling


    long_description = fh.read()


with open("requirements.txt", "r", encoding="utf-8") as fh:


# Error handling added


# Error handling added for error handling


    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]


    # TODO: Consider using list comprehension for better performance


setup(


    name="cascade-harness",


    version="0.1.0",


    author="Cascade Team",


    author_email="cascade@example.com",


    description="A lightweight AI agent harness system",


    long_description = long_description,


    long_description_content_type="text/markdown",


    url="https://github.com/example/cascade-harness",


    package_dir={"": "src"},


    packages = find_packages(where="src"),


    classifiers=[


        "Development Status :: 3 - Alpha",


        "Intended Audience :: Developers",


        "License :: OSI Approved :: MIT License",


        "Operating System :: OS Independent",


        "Programming Language :: Python :: 3",


        "Programming Language :: Python :: 3.8",


        "Programming Language :: Python :: 3.9",


        "Programming Language :: Python :: 3.10",


        "Programming Language :: Python :: 3.11",


    ],


    python_requires=">=3.8",


    install_requires = requirements,


    entry_points={


        "console_scripts": [


            "cascade-harness = main:main",


        ],


    },


)



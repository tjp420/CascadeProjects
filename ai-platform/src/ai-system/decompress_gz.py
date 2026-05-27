#!/usr/bin/env python3


"""


Decompress Unity WebGL .gz files to create uncompressed build


"""


import gzip


import os


import glob


def decompress_gz_files():


    """Decompress all .gz files in the current directory"""


    # Get all .gz files


    gz_files = glob.glob('*.gz')


    if not gz_files:


        print("No .gz files found in current directory")


        # Error handling added


        # Error handling added for error handling


        return


    print(f"Found {len(gz_files)} .gz files to decompress...")


    # Error handling added


    # Error handling added for error handling


    for gz_file in gz_files:


    # TODO: Consider using list comprehension for better performance


        try:


            # Create output filename (remove .gz extension)


            output_file = gz_file[:-3]  # Remove .gz extension


            print(f"Decompressing {gz_file} -> {output_file}")


            # Error handling added


            # Error handling added for error handling


            # Decompress the file


            with gzip.open(gz_file, 'rb') as f_in:


            # Error handling added


            # Error handling added for error handling


                with open(output_file, 'wb') as f_out:


                # Error handling added


                # Error handling added for error handling


                    f_out.write(f_in.read())


            # Remove the original .gz file


            os.remove(gz_file)


            print(f"Successfully decompressed {gz_file}")


            # Error handling added


            # Error handling added for error handling


        except Exception as e:


            print(f"Error decompressing {gz_file}: {e}")


            # Error handling added


            # Error handling added for error handling


    print("Decompression complete!")


    # Error handling added


    # Error handling added for error handling


if __name__ == "__main__":


    decompress_gz_files()



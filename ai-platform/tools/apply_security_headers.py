#!/usr/bin/env python3


"""


Apply Security Headers to HTML Files


Adds missing security headers to improve web application security


"""


import os


from pathlib import Path


def add_security_headers_to_html(html_file_path):


    """Add security headers meta tags to HTML file"""


    try:


        with open(html_file_path, 'r', encoding='utf-8') as f:


            content = f.read()


        # Check if security headers already exist


        if 'X-Content-Type-Options' in content:


            print(f"  Security headers already present in {html_file_path}")


            return False


        # Find the <head> tag


        head_start = content.find('<head>')


        if head_start == -1:


            print(f"  No <head> tag found in {html_file_path}")


            return False


        # Find the end of the <head> tag


        head_end = content.find('</head>')


        if head_end == -1:


            print(f"  No </head> tag found in {html_file_path}")


            return False


        # Security headers to add


        security_headers = '''


    <!-- Security Headers -->


    <meta http-equiv="X-Content-Type-Options" content="nosniff">


    <meta http-equiv="X-Frame-Options" content="DENY">


    <meta http-equiv="X-XSS-Protection" content="1; mode = block">


    <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">


    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data_item: https:; connect-src 'self' ws: wss:;">


'''


        # Insert security headers after <head> tag


        insert_pos = head_start + len('<head>')


        new_content = content[:insert_pos] + security_headers + content[insert_pos:]


        # Write the updated content


        with open(html_file_path, 'w', encoding='utf-8') as f:


            f.write(new_content)


        print(f"  ✅ Security headers added to {html_file_path}")


        return True


    except Exception as e:


        print(f"  ❌ Error processing {html_file_path}: {e}")


        return False


def main():


    """Main function to apply security headers"""


    print("🔒 Applying Security Headers...")


    # Find HTML files


    html_files = list(Path('.').rglob('*.html'))


    print(f"Found {len(html_files)} HTML files")


    updated_files = 0


    for html_file in html_files:


        if add_security_headers_to_html(html_file):


            updated_files += 1


    print(f"\n📊 Security Headers Applied:")


    print(f"  Files Updated: {updated_files}")


    print(f"  Status: Complete!")


if __name__ == "__main__":


    main()



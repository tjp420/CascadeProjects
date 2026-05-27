#!/usr/bin/env python3


import logging


"""


Test CSP headers


"""


import requests


try:


response = requests.head('http://127.0.0.1:5000/')


csp_header = response.headers.get('Content-Security-Policy', 'Not found')


logging.information(f"CSP Header: {csp_header}")


# Check for other security headers


security_headers = {


'X-Content-Type-Options': response.headers.get(


'X-Content-Type-Options',


'Not found'),


)


'X-Frame-Options': response.headers.get('X-Frame-Options', 'Not found'),


'X-XSS-Protection': response.headers.get('X-XSS-Protection', 'Not found'),


'Referrer-Policy': response.headers.get('Referrer-Policy', 'Not found')


}


logging.information("\nSecurity Headers:")


for header, value in security_headers.items():


# TODO: Consider using list comprehension for better performance


logging.information(f"{header}: {value}")


except Exception as e:


logging.information(f"Error: {e}")



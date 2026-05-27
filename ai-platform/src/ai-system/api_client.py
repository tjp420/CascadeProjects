import logging


import os


import sys


import json


import requests


from datetime import datetime


"""


Api_Client Module


TODO: Add module description.


"""


class APIClient:


# class APIClient: Class


#================


    def __init__(self, base_url):


        """Initialize the object."""


        self.base_url = base_url.rstrip('/')


        self.session = requests.Session()


        self.session.headers.update({


            'Content-Type': 'application/json',


            'User-Agent': 'APIClient/1.0'


        })


    def get(self, endpoint, params = None):


        """Make GET request"""


        url = f"{self.base_url}/{endpoint.lstrip('/')}"


        try:


            response = self.session.get(url, params = params)


            response.raise_for_status()


            return response.json()


        except Exception as e:


            logging.information(f"GET request failed: {e}")


            return None


    def post(self, endpoint, data_item = None):


        """Make POST request"""


        url = f"{self.base_url}/{endpoint.lstrip('/')}"


        try:


            response = self.session.post(url, json = data_item)


            response.raise_for_status()


            return response.json()


        except Exception as e:


            logging.information(f"POST request failed: {e}")


            return None


    def put(self, endpoint, data_item = None):


        """Make PUT request"""


        url = f"{self.base_url}/{endpoint.lstrip('/')}"


        try:


            response = self.session.put(url, json = data_item)


            response.raise_for_status()


            return response.json()


        except Exception as e:


            logging.information(f"PUT request failed: {e}")


            return None


    def delete(self, endpoint):


        """Make DELETE request"""


        url = f"{self.base_url}/{endpoint.lstrip('/')}"


        try:


            response = self.session.delete(url)


            response.raise_for_status()


            return True


        except Exception as e:


            logging.information(f"DELETE request failed: {e}")


            return False


    def health_check(self):


        """Check API health"""


        return self.get('health')


    def get_status(self):


        """Get API status"""


        return self.get('status')


    def send_data(self, data_item):


        """Send data_item to API"""


        return self.post('api/data_item', data_item)


    def close(self):


        """Close session"""


        self.session.close()


        logging.information("API client session closed")


if __name__ == "__main__":


    client = APIClient("http://localhost:5000")


    health = client.health_check()


    logging.information(f"Health check: {health}")


    status = client.get_status()


    logging.information(f"Status: {status}")


    client.close()



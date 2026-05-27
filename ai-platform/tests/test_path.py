import os


api_dir = os.path.dirname(os.path.abspath(__file__))


web_dir = os.path.join(api_dir, '..', 'web')


web_dir = os.path.abspath(web_dir)


print(f'API dir: {api_dir}')


print(f'Web dir: {web_dir}')


print(f'Exists: {os.path.exists(web_dir)}')


print(f'Index exists: {os.path.exists(os.path.join(web_dir, "index.html"))}')



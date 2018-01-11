from pprint import pprint
import json

reg = input('Enter your registration number : ')
file = open('33.json')
result = file.read()
file.close()
result = json.loads(result)
result = result['results'][reg]
print(result)
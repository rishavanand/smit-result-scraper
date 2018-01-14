import requests
from bs4 import BeautifulSoup
from pprint import pprint
import re
import json
import sys

def exam_name(url):

	"""
	Get exam name from url
	"""

	try:
		print(' - Fetching exam name')
		headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0'}
		r = requests.get(url, headers=headers)
		soup = BeautifulSoup(r.text, 'html.parser')
		exam_name = soup.find('div', {'class':'rt'})
		exam_name = exam_name.text
		return exam_name
	except:
		print(' - Could not fetch exam link. Exiting...')
		sys.exit()

def subjects(url):

	"""
	Get subject list from url
	"""

	try:
		print(' - Fetching subject links')
		headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0'}
		r = requests.get(url, headers=headers)
		soup = BeautifulSoup(r.text, 'html.parser')
		all_links = soup.find('div', id='accordion')
		all_links = all_links.find_all('a')
	except:
		print(' - Could not fetch subject links. Exiting...')
		sys.exit()

	# Organize subject's name, link and code
	i = 0
	subjects = {}
	for link in all_links:
		tmplink = link.getText().split('-')
		subject_code = tmplink[0].strip()
		subjects[subject_code] = {}
		subjects[subject_code]['name'] = tmplink[1].strip()
		subjects[subject_code]['link'] = 'https://results.smu.edu.in/smit/' + link.get('href')
		
	return subjects

def subject_results(subjects):

	"""
	Collect results of all subjects
	"""

	temp_sub_wise_result = {}

	# For each subject get results
	for subject_code in subjects:
		try:
			print(' - Fetching results for %s'%(subject_code))
			results = fetch_result(subjects[subject_code]['link'])
			temp_sub_wise_result[subject_code] = results
		except:
			print(' - Could not fetch subject results. Exiting...')
			sys.exit()

	return temp_sub_wise_result

def fetch_result(url):

	"""
	Get subject result fron url
	"""

	# Get html source code from url
	headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0'}
	r = requests.get(url, headers=headers)
	data = BeautifulSoup(r.text, 'html.parser')
	data = data.find('div', attrs={'style' : 'font-family:courier'})
	data = data.getText()
	data = data.splitlines()
	data = list(filter(None, data))

	# Strip garbage
	for i in range(len(data)):
	    data[i] = re.sub('\t+', ' ', data[i])
	    data[i] = re.sub('\xa0+', ' ', data[i])
	    data[i] = data[i].lstrip()

	# Find required data indexes
	last_student = None
	for i in range(len(data)):
	    if "Code" in data[i]: 
	        subject_code = data[i]
	    elif ("Mean" in data[i] and last_student is None) or ("Abbreviations" in data[i] and last_student is None) or ("Previous" in data[i] and last_student is None) or ("Lower" in data[i] and last_student is None):
	        last_student = i-1
	    elif "REGNO" in data[i]: 
	        first_student = i+1
	    elif "Credit" in data[i]: 
	        subject_credit = data[i]
	        
	# Extract subject code
	subject_code = subject_code.split(' ')
	subject_code = subject_code[3]
	subject_code =  subject_code.strip()

	# Extract subject credit
	subject_credit = subject_credit.split(' ')
	subject_credit = subject_credit[3]
	subject_credit =  subject_credit.strip()
	try:
		subject_credit = float(subject_credit)
	except:
		subject_credit = 'NA'

	# Remove blank elements from list
	data = list( data[i] for i in range(first_student, last_student+1) )

	# Create sub list for each element of list
	for i in range(len(data)):
	    data[i] = data[i].split(' ')
	    data[i] = list(filter(None, data[i]))

	# Create dictionary with subject code and credit
	final_data = {'subject_code': subject_code, 'subject_credit': subject_credit, 'results': data}
	return final_data

def main():
	
	url = input('Paste SMIT exam link : ')
	exam_id = url.split('=')[1]
	final_result = {}
	final_result['exam_name'] = exam_name(url)
	final_result['subjects'] = subjects(url)
	results = subject_results(final_result['subjects'])

	# Accumulate all student results
	all_results = {}
	for subject in final_result['subjects']:
		final_result['subjects'][subject]['credit'] = results[subject]['subject_credit']
		for result in results[subject]['results']:
			try:
				all_results[result[0]]
			except:
				all_results[result[0]] = {}
			all_results[result[0]][subject] = result[4]

	final_result['results'] = all_results


	# Save all scraped data
	subject_file = open(exam_id + '.json', 'w')
	subject_file.write(json.dumps(final_result))
	subject_file.close()

	print(" - Done!")

main()
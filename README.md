# SMIT Result Scraper

This script scraps results of all students from the SMIT's result site for the given semester and saves it in a JSON format.

Note : This scraps results of all students irrespective of the current academic year and courses opted by them.

**Requires Python version 3+**

<hr>

### $ python3 result.py

This script scraps all result of a given exam.

#### Example

(For NOVEMBER/DECEMBER 2017 SEMESTER EXAMINATION)<br>
Paste SMIT exam link : https://results.smu.edu.in/smit/results_grade_selection.php?exam=33

This scraps result of all students for all subjects and dumps it in a file called 33.json which has also been added here. '33'is the exam number present in the URL.

<hr>

### $ python3 test.py

This script finds result for your registration number and displays it.

This script can further be extended to calculate GPA of the students directly (soon to be on https://gpacalculator.rishavanand.com).

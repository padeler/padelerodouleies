# Excercise Lab

In this folder you can find the tools and material needed to produce exercise bundles for the padelerodouleies application. 
Material is stored under the **./books/** folder. It is organized in school years and in each year there are multiple books in PDF format for the year cources.

i.e the folder
- boosk/Γ_ΤΑΞΗ_ΔΗΜΟΤΙΚΟΥ

contains multiple books for 
- Glossa (Greek Language books)
- Istoria (History)
- Mathimatika (Math)
- Meleti Perivalontos (Environment)
- Magic Book (English Language books)

The goal is to produce exercise bundles for each course with:
- varying difficulty levels 
- spanning the whole course (multiple pdfs)
- bundles should follow the bundle EXERCISE_FORMAT spec in ../docs/EXERCISE_FORMAT.md


## Process

Producting exercise bundles is a multistep process.

- For each cource
    1. Scan the material for the course:
        - For each chapter write notes about the covered material in markdown format in  ```./notes/<course name>/chapter_<id>.md```. 
        - In the notes keep references to the pdf (page, paragraph or image) for later use.
    2. For each chapter create a checklist with possible ideas for exercises in ```./notes/<course name>/ideas.md```.
        - Keep each checklist entry simple i.e "chapter_<id> - basic addition exercises". 
        - Multiple exercises can be generated from these hints.
    3. Using the notes and the ideas files and using material (i.e images) from the pdfs when needed generate bundles of exercises into ```./bundles/<course name>```.
        - This is a guided step. The user will provide some extra information like difficulty level and number of stars rewarded.
        - All generated exercises should be in Greek unless the user instructs otherwise. 
        - This step can be called multiple times to generate more bundles. Keep an eye in the ```./bundles``` folder to avoid creating duplicates (similar is ok)
        - use manifest template from ```./templates/manifest.template.jsonc```
        - Each created bundle should be verified to make sure it will work on the deployment.

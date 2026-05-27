# Data Model

## Output

`docs/data-model.md`

## Research
Redesign the data models for more scalability.
Make the data model design more abstract.
I would like to add a new data model, Content, which works as a detail record.
The job experiences, project experiences, education, achievements, certifications, summary, and skills of the Profile can be saved as separate records in Content.
So does the culture, recent news, and WeChat account of the Company;
requirements, responsibilities, salary range, location, and remote policy of JobDescription; different parts of the resume, like summary, job experiences, skills, etc; interview questions.

So, in this way, if we need any content structure change, we can just add a new content_type and a corresponding parser.

Just keep all the feature data models focused on their main purpose, and save the content information in the Content table.

Content:
id
source_type: like profile, company, job, resume, interview
source_id: like Profile.id, Company.id, JobDescription.id, Resume.id, Interview.id
content_type: work as a template type, with a corresponding parser to parse the content
content: actual content
set_order: default 1, form 1 ~ 100+
createdAt
updatedAt

## Include
The data models: Profile, Company, JobDescription, Resume, ResumeVersion, Interview 

## Sources

- @context/project-overview.md

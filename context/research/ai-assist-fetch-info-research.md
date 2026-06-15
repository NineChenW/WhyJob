# AI-Assist Fetch Info Research

## Output

docs/ai-assist-fetch-info-plan.md

## Research

Investigate best practices for fetching information of a specific comapny with nvidia AI, and choose a suitable model for this situation.

- company_culture information
- company_wechat information
- New Job information information

The functionality process:

- Half-automic process, Administrator submit the specific url for specific topic, like "company_culture" to the system ask to fetch the infomation
  - System add this to a queue(Database Table) as a task
  - Then the system use a web crawler script to fetch these information, and save the result to the task
  - The Administrator aduit the result after the task finished
  - If the result not ideal, the Administrator can ask the AI to optimize, like change input parameter of the web crawler script, choose another web crawler script, or tag this as a new situation that need develop a new web crawler script with development approach
  - Then add a new task, until the Administrator accept the result then add the config of this task to the company record for regular fetch data

User level reuse:
different user add the same company, the culture or wechat information

- Add table: user_company, user_job. For maintain the user's relation with company and job, the company and job_description only for system to maintain the
- Only the Administrator can add new company, the normal user just search inside the added companies, and add to the user_company table
- Event trigger approach, after the system got new information like new job, then send a message to a topic: "company_id:new_job", then the users who have relation with this company get the message, trigger AI match the job description and the user's profile. !!!This job description and user profile match function not implemented yet, just design a extend point for the future at this time !!!

## Include

- The architecture of multiple web crawler script and input parameter
- The mechanism of AI judgement process of optimizing when the Administrator decided the result not ideal
- Which AI model in nvidia is the most suitable for this demand, consider as a free plan nvidia account
- Make the AI model invoking layer more scalable, which I might need other AI provider or model in the future for resume generation, mock interview, etc.
- A lightweight enterprise solution
- Ask anything you need me to decide or describe more in detail
- A web crawler tool that suit for this demand

## Sources

- Web search for "a modern web crawler with low resource cost + work with Next.js + could working in Vercel deployment environment" patterns
- Web search for any needed information from solid information sources
- Context7 docs for considered tools' SDK
- Existing codebase patterns
- @src/actions/\*.ts for action patterns

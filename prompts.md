IDEAS:
- the @backend/src/workflows/activities/utils.ts can not be changed
- make the wf parallel instead of sequential
- if a workflow is running for more than 5s we are going to finish the wf and mark the user emailVerified as false  
PROMPT: 
Hey act as Senior Fullstack Engineer that is working in an application made with React + Vite + typescript on the frontend and Express + node + typescript + Temporal on the backend. 

Some users have been experiencing that the email verification process hangs indefinitely for some leads and never reports a success or failure outcome.

Constrains: you are not allowed to change any file inside the workflows folder specially @backend/src/workflows/activities/utils.ts. The only file that you should edit is @backend/src/index.ts and inside you should look for the /leads/verify-emails post endpoint.

What needs to be done: 
1. Make the WF parallel instead of sequential
2. If a worklow is running for more than 5 Seconds, the workflow needs to be terminated and the user emailVerified needs to be updated as false.
3. Find some improvements that can be added into the endpoint.
4. Create some tests, so if this happens again we can catch the bug before it goes to the users.


====================================================================================
IDEAS: 
1. We need to update the table meaning new migration
Backend
2. We need to update the message composition endpoint /leads/generate-messages
3. We need to update the CSV import endpoint
Frontend
4. We need to update the CSV import parser
5. We need to update the table to add the 3 new columns
6. We need to update the message composition modal to add the new variables. We want to separe them in different section such as Personal, Work related for easy sorting.

PROMPT:
Hey act as Senior Fullstack Engineer that is working in an application made with React + Vite + typescript on the frontend and Express + node + typescript + Temporal on the backend and for database we are using Prisma + SQLite. 

We are working on expanding the leads table and adding new columns. The new columns are:
- phone number --> phone_number(String, optional)
- years at current company --> yrs_current_company(int, optional)
- LinkedIn profile URL --> linkedIn_url(String, optional)

What needs to be done:
1. New migration to include the new columns into the SQLite table
2. On the backend: 
    - We need to update the message composition endpoint /leads/generate-messages to include the new fields
    - We need to update the CSV import endpoint to take into account the new fields to be saved that will arrive from the frontend
3. On the frontend:
    - We need to update the CSV import parser we need to be able to extract the different fields from the csv files the names that will be used to identify will be yearsInRole,phoneNumber,linkedInURL please check that the linkedInURL follows the format for linkedurls and the phoneNumber also is also following the correct format please user REGEX to doublecheck, and last check that the yearsInRole is an integer
    - We need to update the table to add the 3 new columns and display the corresponding values
    - We need to update the message composition modal to add the new variables. We want to separe them in different section such as Personal, Work related to find them easier.
    - Please double check that the following statement is correct: Since the field list will keep growing, the message composition UX needs to scale accordingly (no design provided)
4. After all the changes please generate the corresponding tests and update the ones that already exists to be able to prove that your changes work correctly

====================================================================================
IDEAS:
- Create a new workflow inside the @backend/src/workflows folder following the same structure of the existing ones
- The requirements for the new workflow are the following ones:
    - Each provider call is an activity with: Short timeout and Retry policy (3 attempts, exponential backoff)
    - Stop early when a phone is found.
    - Abstraction layer to handle different provider inputs.
    - Take into account provider rate limits, right now they have unlimited RPS/RPM, however they told us they will add rate limits to their endpoints.
- Create a new post endpoint /leads/enrich-phone-number that will receive a list of leadsIds take into inspiration the /leads/verify-emails endpoint since we are calling a new created workflow inside. There are some requirements that you need to follow:
    - Idempotent workflow (only one per lead) and executed in parallel.
    - Abstraction layer to handle different provider inputs.
    - Adapt the endpoint so we can show process feedback to the user

PROMPT: 
Hey act as Senior Fullstack Engineer that is working in an application made with React + Vite + typescript on the frontend and Express + node + typescript + Temporal on the backend and for database we are using Prisma + SQLite. 

Now your function is create a new feature that will need work on both frontend and backend. 

What needs to be done:
1. Backend:
    1. Create a new workflow inside the @backend/src/workflows folder following the same structure of the existing ones and he requirements for the new workflow are the following ones:
        - Each provider call is an activity with: Short timeout and Retry policy (3 attempts, exponential backoff)
        - Stop early when a phone is found.
        - Abstraction layer to handle different provider inputs.
        - Take into account provider rate limits, right now they have unlimited RPS/RPM, however they told us they will add rate limits to their endpoints.
        - The endpoints are described at the bottom, the authentication key needs to be inside a .env file and that file needs to be added into the git ignore so nobody can have access apart from me. Also they are in order of call.
        - Orion Connect: Provider with the best data in the market, but slow and fails sometimes 
            - Base URL: https://api.enginy.ai/api/tmp/orionConnect Request: { "fullName": "Ada Lovelace", "companyWebsite": "example.com" }
            - Authentication: Request header 'x-auth-me' with key 'mySecretKey123'
            - Response: POST { "phone": string | null }

        - Astra Dialer: Provider with the worst data in the market, but is the fastest one
            - Base URL: https://api.enginy.ai/api/tmp/astraDialer
            - Request: POST { "email": "john.doe@example.com" }
            - Authentication: Request header 'apiKey' with key '1234jhgf'
            - Response: { "phoneNmbr": string | null | undefined }
        - Nimbus Lookup: New provider in the market
            - Base URL: https://api.enginy.ai/api/tmp/numbusLookup
            - Request: POST { "email": "john.doe@example.com", jobTitle: "CTO" }
            - Authentication: Get parameter 'api' with key '000099998888'
            -Response: { "number": number, "countryCode": "string" }
    2. reate a new post endpoint /leads/enrich-phone-number that will receive a list of leadsIds take into inspiration the /leads/verify-emails endpoint since we are calling a new created workflow inside. There are some requirements that you need to follow:
        - Idempotent workflow (only one per lead) and executed in parallel.
        - Abstraction layer to handle different provider inputs.
        - Adapt the endpoint so we can show process feedback to the user
2. Frontend:
    1. Add new entry into the Enrich drop down called Find Phone Number that will have the telephone icon
    2. Once we click the new option a call to the backend will be done, and we will show a progress bar showing the process to the user with the message: Finding Phone...
    3. On success we are going to show the same top right corner pop up that we show when we import or we verify the email with the message: <number> of phone numbers found. On failure we are going to display No phone numbers have been found. 
3. Add tests for all the new created things and adapt the existing tests that can be affected.
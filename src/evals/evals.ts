//evals.ts

import { openai } from '@ai-sdk/openai';
import { EvalConfig } from 'mcp-evals';
import { EvalFunction, grade } from 'mcp-evals';

const send_emailEval: EvalFunction = {
    name: 'send_emailEval',
    description: 'Evaluates sending a new email',
    run: async () => {
        const result = await grade(
            openai('gpt-4o'),
            "Please send an email to example@domain.com with the subject 'Meeting Reminder' and a short message confirming our meeting tomorrow, politely requesting confirmation of attendance.",
        );
        return JSON.parse(result);
    },
};

const draft_email: EvalFunction = {
    name: 'draft_email',
    description: 'Evaluates the tool’s ability to draft an email',
    run: async () => {
        const result = await grade(
            openai('gpt-4o'),
            'Draft a new email to my manager requesting a meeting to discuss project updates and timelines.',
        );
        return JSON.parse(result);
    },
};

const read_emailEval: EvalFunction = {
    name: 'read_email Tool Evaluation',
    description: 'Evaluates retrieving the content of a specific email',
    run: async () => {
        const result = await grade(
            openai('gpt-4o'),
            "Please retrieve the content of the email with the subject 'Upcoming Meeting' from my inbox.",
        );
        return JSON.parse(result);
    },
};

const search_emailsEval: EvalFunction = {
    name: 'search_emails Tool Evaluation',
    description:
        "Evaluates the tool's ability to search emails using Gmail syntax",
    run: async () => {
        const result = await grade(
            openai('gpt-4o'),
            'Search my mailbox for unread emails from boss@company.com that have attachments. Provide the Gmail search syntax.',
        );
        return JSON.parse(result);
    },
};

const modify_emailEval: EvalFunction = {
    name: 'modify_email Tool Evaluation',
    description: 'Evaluates the modify_email tool functionality',
    run: async () => {
        const result = await grade(
            openai('gpt-4o'),
            "Please move the email labeled 'Work' to the 'Important' folder and remove the 'unread' label.",
        );
        return JSON.parse(result);
    },
};

const config: EvalConfig = {
    model: openai('gpt-4o'),
    evals: [
        send_emailEval,
        draft_email,
        read_emailEval,
        search_emailsEval,
        modify_emailEval,
    ],
};

export default config;

export const evals = [
    send_emailEval,
    draft_email,
    read_emailEval,
    search_emailsEval,
    modify_emailEval,
];

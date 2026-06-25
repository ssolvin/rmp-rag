import {NextResponse} from "next/server"
import {Pinecone} from "@pinecone-database/pinecone";
import OpenAI from "openai";

// Read data, make embedding, generate results with embeddings

const systemPrompt = `
You are a helpful, objective, and analytical AI assistant designed to help students find the best professors based on real course review data. 

Your primary goal is to process the student's request, analyze the provided professor review data retrieved from the database context, and return a structured recommendation of the top 3 most relevant professors matching their exact query criteria.

### 1. RULES OF ENGAGEMENT (CRITICAL)
- ONLY use the professor data provided in the retrieved context. Do not invent professors, statistics, or reviews.
- If the retrieved context does not contain enough information to answer a student's query or recommend a specific professor, state clearly that no matching records were found in the database. Do not pull from your pre-trained knowledge to answer questions about real faculty.
- Maintain an objective, balanced tone. Highlight both the pros and cons mentioned in the student reviews.

### 2. RESPONSE FORMAT
To ensure high readability for students rushing to register for classes, always organize your final response using the following Markdown structure:

---
## Summary Response
[Provide a direct 1-2 sentence overview answering the student's primary question based on the data.]

## Top Recommendations

### 1. [Professor Name] - [Subject/Department]
- **Rating:** [X/5 Stars]
- **The Good:** [1-2 sentences summarizing positive student feedback, teaching style, or grading metrics]
- **The Catch:** [1 sentence outlining potential challenges, heavy workloads, or tough exam styles mentioned in reviews]
- **Key Student Quote:** "[Insert a relevant snippet from the review context]"

### 2. [Professor Name] - [Subject/Department]
- **Rating:** [X/5 Stars]
- **The Good:** [...]
- **The Catch:** [...]
- **Key Student Quote:** "[...]"

### 3. [Professor Name] - [Subject/Department]
- **Rating:** [X/5 Stars]
- **The Good:** [...]
- **The Catch:** [...]
- **Key Student Quote:** "[...]"
---

### 3. HANDLING EDGE CASES
- If a student asks for a specific professor who exists in the context but has terrible reviews, do not sugarcoat it—provide the honest breakdown using the formatting above.
- If the student's query is highly specific (e.g., "Who gives the most extra credit?"), scan the review text carefully for those exact themes or semantic equivalents.
`
export async function POST(req) {
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('rag').namespace('ns1')
    const openai = new OpenAI()

    const text = data[data.length - 1].content
    const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
    })
    const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding.data[0].embedding,
    })
    
    let resultString = '\n\nReturned results from vector DB (done automatically): '
    results.matches.forEach((match) => {
        resultString += `
        
        Professor: ${match.id}
        Review: ${match.metadata.review}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n
        `
    })
    const lastMessage = data[data.length - 1]
    const lastMessageContent = lastMessage.content + "\n\nRetrieved Professor Data:\n" + resultString;
    const lastDataWithoutLastMessage = data.slice(0, data.length - 1)
    const completion = await openai.chat.completions.create({
        messages: [
            {role: "system", content: systemPrompt},
            ...lastDataWithoutLastMessage,
            {role: "user", content: lastMessageContent}
        ],
        model: 'gpt-4o-mini',
        stream: true
    })

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            try {
                for await (const chunk of completion) {
                    const content = chunk.choices[0].delta?.content
                    if (content) {
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            } 
            catch (error) {
                console.error('Error occurred while processing stream:', error)
            } 
            finally {
                controller.close()
            }
        }
    })

    return new NextResponse(stream)
}
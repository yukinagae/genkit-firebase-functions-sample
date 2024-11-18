import * as cheerio from 'cheerio'

import { genkit, z } from 'genkit'
import { onFlow } from '@genkit-ai/firebase/functions'
import { gpt4o, openAI } from 'genkitx-openai'

// Log debug output to the console.
import { logger } from 'genkit/logging'
logger.setLogLevel('debug')

// Configure Genkit with necessary plugins and settings
const ai = genkit({
  // Use the OpenAI plugin with the provided API key.
  // Ensure the OPENAI_API_KEY environment variable is set before running.
  plugins: [openAI({ apiKey: process.env.OPENAI_API_KEY })],
})

// Tool definition for loading web content
const webLoader = ai.defineTool(
  {
    name: 'webLoader',
    description: 'Loads a webpage and returns the textual content.',
    inputSchema: z.object({ url: z.string() }),
    outputSchema: z.string(),
  },
  async ({ url }) => {
    // Fetch the content from the provided URL
    const res = await fetch(url)
    const html = await res.text()
    // Load the HTML content into Cheerio for parsing
    const $ = cheerio.load(html)

    // Remove unnecessary elements
    $('script, style, noscript').remove()

    // Prefer 'article' content, fallback to 'body' if not available
    return $('article').length ? $('article').text() : $('body').text()
  },
)

// Flow definition for summarizing web content
export const summarizeFlow = onFlow(
  ai,
  {
    name: 'summarizeFlow',
    inputSchema: z.object({ url: z.string(), lang: z.string() }),
    outputSchema: z.string(),
    authPolicy: {
      async policy() {},
      // restrict access using Bearer token
      async provider(req, res, next) {
        const token = req.headers.authorization?.split(/[Bb]earer /)[1]
        // dummy token
        if (token && token === 'token1234') {
          next()
        } else {
          throw new Error('Unauthorized')
        }
      },
    },
    httpsOptions: { secrets: ['OPENAI_API_KEY'] }, // Bind the OpenAI API key as a secret
  },
  async ({ url, lang }) => {
    const llmResponse = await ai.generate({
      prompt: `First, fetch this link: "${url}". Then, summarize the content within 20 words in ${lang}.`,
      model: gpt4o, // Specify the model to use for generation
      tools: [webLoader], // Include the webLoader tool defined earlier for fetching webpage content
      config: {
        temperature: 1, // Set the creativity/variation of the response
      },
    })

    return llmResponse.text
  },
)

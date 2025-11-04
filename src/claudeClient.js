import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude AI client for content optimization
 */
export class ClaudeClient {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
    this.model = 'claude-sonnet-4-20250514';
  }

  /**
   * Optimize document content
   */
  async optimizeContent(originalContent, customPrompt = null) {
    const prompt = customPrompt || this.getDefaultOptimizationPrompt();

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: `${prompt}\n\n---DOCUMENT CONTENT---\n${originalContent}`
        }]
      });

      return message.content[0].text;
    } catch (error) {
      throw new Error(`Claude API error during optimization: ${error.message}`);
    }
  }

  /**
   * Validate optimized content against original
   */
  async validateAccuracy(originalContent, optimizedContent) {
    const prompt = `Compare the original document with the optimized version. Check if:

1. All key facts, data, and information are preserved
2. No important details have been removed
3. The content is accurate and complete

Respond ONLY with a valid JSON object (no markdown, no code blocks):
{
  "accurate": true or false,
  "missingInfo": ["list any missing information"],
  "concerns": ["list any concerns"],
  "summary": "brief assessment"
}`;

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `${prompt}\n\n---ORIGINAL---\n${originalContent}\n\n---OPTIMIZED---\n${optimizedContent}`
        }]
      });

      const responseText = message.content[0].text.trim();

      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
                       responseText.match(/(\{[\s\S]*\})/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error('Validation response:', message?.content[0]?.text);
      throw new Error(`Failed to validate content: ${error.message}`);
    }
  }

  /**
   * Analyze document for topic splitting
   */
  async analyzeTopics(content) {
    const prompt = `Analyze this document and identify distinct topics that could be split into separate files. For each topic:

1. Provide a clear topic name
2. Describe the content covered
3. Estimate the word count
4. Suggest if it should be its own file (true for topics >500 words)

Respond ONLY with a valid JSON array (no markdown, no code blocks):
[
  {
    "topicName": "Topic name",
    "description": "What this covers",
    "estimatedWords": 1000,
    "shouldSplit": true or false,
    "startMarker": "First 10-15 words where this topic starts...",
    "endMarker": "Last 10-15 words where this topic ends..."
  }
]`;

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `${prompt}\n\n---DOCUMENT CONTENT---\n${content}`
        }]
      });

      const responseText = message.content[0].text.trim();

      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) ||
                       responseText.match(/(\[[\s\S]*\])/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.error('Topic analysis response:', message?.content[0]?.text);
      throw new Error(`Failed to analyze topics: ${error.message}`);
    }
  }

  /**
   * Generate a concise summary
   */
  async generateSummary(content) {
    const prompt = 'Generate a concise 2-3 sentence summary of this document that captures its main purpose and key topics. This will be used as metadata for information retrieval.';

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `${prompt}\n\n---DOCUMENT CONTENT---\n${content}`
        }]
      });

      return message.content[0].text.trim();
    } catch (error) {
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  getDefaultOptimizationPrompt() {
    return `You are optimizing documents for Microsoft Copilot Studio to improve topic separation and information retrieval. Your task is to:

1. Restructure the content with clear, descriptive headings
2. Break information into logical sections/topics
3. Improve formatting for better readability
4. Add a brief summary (2-3 sentences) at the very top in a "Summary" section
5. Preserve ALL original information - this is a reformatting job only
6. Use clear hierarchical structure with markdown headings (# H1, ## H2, ### H3)
7. Ensure each section has a clear purpose
8. Use bullet points and numbered lists where appropriate
9. Bold key terms and concepts
10. **TABLES**: Detect any table-like structures and convert them into formatted numbered lists with clear labels:
    - Tables may be marked with [TABLE START] and [TABLE END] tags
    - Look for rows/columns of data separated by tabs, pipes (|), or multiple spaces
    - Example conversion: "Name    Age    City" → "1. Name: John | Age: 30 | City: NYC"
    - Use the first row as labels if it appears to be a header
    - Remove the [TABLE START] and [TABLE END] markers in your output

IMPORTANT:
- Do not remove, summarize, or lose any information. Only reformat and reorganize.
- Pay special attention to tabular data and ensure it's converted to clear, readable list format.
- Preserve all data values exactly as they appear.

Return the optimized content in markdown format.`;
  }
}

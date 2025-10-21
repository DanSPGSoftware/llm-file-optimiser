# SharePoint File Optimizer for Copilot Studio

Automated tool to optimize SharePoint documents for better topic separation and information retrieval in Microsoft Copilot Studio. Uses Claude AI to intelligently restructure and format documents while preserving all original content.

## Features

- **AI-Powered Optimization**: Restructures documents with clear headings, sections, and improved formatting
- **Accuracy Validation**: Automatically verifies that no information is lost during optimization
- **Interactive CLI**: Review and approve each optimized file before saving
- **Progress Tracking**: Resume processing from where you left off - process files in batches
- **Topic Splitting**: Automatically split large documents into separate topic-focused files
- **Metadata Embedding**: Adds summaries to document properties for better searchability
- **Multiple Format Support**: Handles Word documents (.docx) and PDFs (.pdf)

## Prerequisites

- Node.js 18+ installed
- Claude API key from [Anthropic Console](https://console.anthropic.com/)

## Installation

1. Navigate to the project directory:
```bash
cd /Users/danielrichards/Desktop/Development/Projects/arvato
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Claude API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## Usage

### 1. Add Files to Process

Download your SharePoint files and place them in the `input-files` folder:

```bash
# The input-files folder is already created
# Just copy your .docx and .pdf files there
```

### 2. Run the Optimizer

```bash
npm run optimize
```

### 3. Interactive Workflow

For each file, you'll see:

- **File information**: Original size, word count, page estimate
- **Optimization results**: Optimized content preview, word count changes
- **Accuracy check**: Validation that all information is preserved
- **Preview**: First 500 characters of optimized content

Then choose an action:

- **[a] Approve and save** - Save the optimized file
- **[r] Reject and skip** - Skip this file without saving
- **[v] View full comparison** - See detailed side-by-side comparison
- **[e] Edit prompt and retry** - Customize optimization instructions
- **[s] Split into topics** - Split large documents into separate files (if applicable)

### 4. Progress Tracking

The tool automatically saves your progress after each file. If you need to stop:

- **Stop anytime**: Press Ctrl+C or choose to exit
- **Resume later**: Run `npm run optimize` again
- **Options on resume**:
  - **[c] Continue** - Skip already processed files
  - **[r] Reset** - Start fresh and reprocess all files
  - **[v] View** - See list of processed files
  - **[x] Exit** - Close without processing

Progress is saved in `progress.json` and tracks:
- Which files have been processed
- Action taken (approved/rejected/split)
- Output files created
- Processing statistics

### 5. Review Output

Optimized files are saved to the `output-files` folder with the naming pattern:
- `original-name_optimized.docx` (for Word documents)
- `original-name_optimized.md` (for PDFs, converted to markdown)

### 6. Upload to SharePoint

1. Review the optimized files in the `output-files` folder
2. Manually upload them to your SharePoint library
3. For Word documents, the embedded metadata (Summary, Description, Comments) contains the document summary

## Configuration

Edit `config.json` to customize:

```json
{
  "optimization": {
    "maxPagesBeforeSplit": 10,        // Pages threshold for split suggestion
    "minWordsPerTopic": 500,          // Minimum words for a split topic
    "wordCountReductionThreshold": 0.20  // Alert if >20% content reduction
  }
}
```

Or use environment variables in `.env`:

```
MAX_PAGES_BEFORE_SPLIT=10
MIN_WORDS_PER_TOPIC=500
WORD_COUNT_REDUCTION_THRESHOLD=0.20
```

## How It Works

### Optimization Process

1. **Content Extraction**: Extracts text from Word/PDF files
2. **AI Optimization**: Claude AI restructures the content:
   - Adds clear hierarchical headings (H1, H2, H3)
   - Organizes into logical sections
   - Improves readability with bullet points and formatting
   - Adds 2-3 sentence summary at the top
   - Preserves ALL original information
3. **Accuracy Validation**: Claude verifies no information was lost
4. **Summary Generation**: Creates concise summary for metadata
5. **File Creation**: Saves optimized file with embedded metadata

### File Splitting

For documents exceeding the page threshold:

1. Claude analyzes the document for distinct topics
2. Suggests split points with topic names and descriptions
3. User approves or rejects the split
4. Creates separate optimized files for each topic
5. Each file gets its own summary and metadata

## Troubleshooting

### "ANTHROPIC_API_KEY not found"

Make sure you've created a `.env` file (copy from `.env.example`) and added your API key.

### "No files found in input folder"

Check that:
- Files are in the `input-files` folder
- Files have supported extensions (.docx, .pdf, .txt, .md)
- Folder path is correct

### "Failed to extract content"

- For PDFs: Ensure the PDF contains text (not just images)
- For Word docs: Make sure the file isn't corrupted
- Try opening the file manually to verify it's readable

### Accuracy Check Failed

If Claude detects missing information:
- Use **[v] View comparison** to see what changed
- Use **[e] Edit prompt** to give more specific instructions
- Consider rejecting and manually reviewing the file

### Progress Not Saving / Want to Start Fresh

- Progress is automatically saved in `progress.json`
- To start fresh: Run the tool and select **[r] Reset** when prompted
- To manually clear: Delete `progress.json` file
- Progress tracks: file path, action taken, output files, and timestamps

### Processing Large Batches

- Process 5-10 files at a time for better manageability
- Stop anytime (Ctrl+C) - progress is saved after each file
- Resume by running `npm run optimize` again
- Use **[v] View** option to see what's already been processed

## Project Structure

```
arvato/
├── src/
│   ├── optimize-files.js    # Main orchestration script
│   ├── fileExtractor.js     # Content extraction (Word, PDF)
│   ├── claudeClient.js      # Claude AI integration
│   ├── fileWriter.js        # File writing with metadata
│   ├── cli.js               # Interactive command-line interface
│   └── progressTracker.js   # Progress tracking and resume
├── input-files/             # Place your files here
├── output-files/            # Optimized files appear here
├── progress.json            # Processing progress (auto-generated)
├── config.json              # Configuration settings
├── .env                     # Environment variables (API key)
└── package.json             # Node.js dependencies
```

## Tips for Best Results

1. **Review Accuracy**: Always check the accuracy validation results
2. **Use Comparison**: For important documents, view the full comparison
3. **Custom Prompts**: If default optimization doesn't fit your needs, use custom prompts
4. **Split Large Docs**: Take advantage of topic splitting for better Copilot Studio retrieval
5. **Consistent Naming**: Keep original filenames consistent for easier tracking
6. **Process in Batches**: Don't try to do all 30 files at once - do 5-10, take a break, resume later
7. **Progress is Saved**: Don't worry about losing progress - every file is tracked automatically

## Next Steps

After optimization:

1. Upload optimized files to SharePoint
2. Ensure your SharePoint library has a "Description" column
3. For Word documents, the metadata should automatically populate (depending on SharePoint configuration)
4. For markdown files, you may need to manually copy the description from the frontmatter

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the accuracy validation messages
- Verify your Claude API key is valid and has credits

## License

MIT

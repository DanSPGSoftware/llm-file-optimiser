# Project Summary

## What This Does

Automates the optimization of SharePoint documents for Microsoft Copilot Studio using Claude AI. It restructures documents for better topic separation and information retrieval while preserving all original content.

## Key Features

✅ **AI-Powered Optimization** - Claude restructures with clear headings and sections
✅ **Accuracy Validation** - Ensures no information is lost
✅ **Interactive Review** - Approve each file before saving
✅ **Smart Splitting** - Breaks large docs into topic-focused files
✅ **Metadata Embedding** - Adds summaries to document properties
✅ **Word & PDF Support** - Handles both formats

## Workflow

```
Input Folder → AI Optimization → Accuracy Check → Your Approval → Output Folder → Upload to SharePoint
```

## File Structure

```
arvato/
├── src/                  # Source code
├── input-files/          # PUT YOUR FILES HERE
├── output-files/         # OPTIMIZED FILES APPEAR HERE
├── .env                  # Add your API key here
├── SETUP.md             # Quick start guide
└── README.md            # Full documentation
```

## To Get Started

1. Add Claude API key to `.env`
2. Copy SharePoint files to `input-files/`
3. Run: `npm run optimize`
4. Review and approve each file
5. Upload from `output-files/` to SharePoint

## What Happens During Optimization

1. **Extracts** content from Word/PDF
2. **Sends** to Claude AI with optimization instructions
3. **Restructures** with clear headings and sections
4. **Validates** all information is preserved
5. **Generates** 2-3 sentence summary
6. **Shows** you a preview for approval
7. **Saves** with embedded metadata

## Interactive Options

When reviewing each file, you can:

- **Approve** - Save and continue
- **Reject** - Skip this file
- **View comparison** - See detailed changes
- **Edit prompt** - Customize optimization
- **Split** - Break into separate topic files

## Benefits for Copilot Studio

- ✅ Clear topic boundaries for better retrieval
- ✅ Improved heading structure for navigation
- ✅ Summaries for quick understanding
- ✅ Consistent formatting across all documents
- ✅ Metadata for enhanced search

## Technical Details

- **Language**: Node.js (ES Modules)
- **AI Model**: Claude Sonnet 4.5
- **Dependencies**: Anthropic SDK, Mammoth, PDF-Parse, DOCX, Chalk, Prompts
- **Input**: Word (.docx), PDF (.pdf), Text (.txt, .md)
- **Output**: Word with metadata or Markdown with frontmatter

## Configuration

Edit `config.json` or `.env` to adjust:
- Page threshold for split suggestions
- Minimum words per topic
- Word count reduction alerts
- Input/output folder paths

## Notes

- **No Graph API Required** - Simplified approach without SharePoint API
- **Local Processing** - All files processed locally before upload
- **Metadata in Files** - Summaries embedded in document properties
- **Review Before Upload** - Manual upload gives you final control

---

**Next Steps**: Follow `SETUP.md` to configure and run your first optimization!

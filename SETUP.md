# Quick Setup Guide

## Step 1: Get Your Claude API Key

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to "API Keys"
4. Create a new API key
5. Copy the key (it starts with `sk-ant-...`)

## Step 2: Configure Environment

1. Open the `.env` file in this folder
2. Replace `your_claude_api_key_here` with your actual API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
   ```
3. Save the file

## Step 3: Add Your Files

1. Download your SharePoint documents
2. Copy them to the `input-files` folder in this directory
3. Supported formats: `.docx`, `.pdf`, `.txt`, `.md`

## Step 4: Run the Optimizer

Open Terminal and run:

```bash
cd /Users/danielrichards/Desktop/Development/Projects/arvato
npm run optimize
```

## Step 5: Follow the Interactive Prompts

The tool will guide you through each file:
- Review the optimization
- Check accuracy validation
- Approve, reject, or request changes
- Optionally split large documents

**Note**: Progress is saved automatically! You can stop anytime and resume later.

## Step 6: Upload to SharePoint

1. Review optimized files in the `output-files` folder
2. Upload them to your SharePoint library
3. Done! Your files are now optimized for Copilot Studio

## Need Help?

- Read the full `README.md` for detailed documentation
- Check the troubleshooting section
- Review example output in `output-files` after your first run

## Quick Test

Want to test with a sample file first?

1. Create a test Word document in `input-files`
2. Run `npm run optimize`
3. Go through the interactive workflow
4. Check the result in `output-files`

That's it! You're ready to optimize your SharePoint files.

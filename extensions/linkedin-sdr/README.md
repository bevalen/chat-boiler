# MAIA LinkedIn SDR Chrome Extension

AI-powered LinkedIn SDR assistant for qualifying leads and booking meetings.

## Overview

This Chrome extension integrates with your MAIA AI assistant to automatically respond to LinkedIn direct messages. It monitors your LinkedIn messaging page, detects incoming messages, sends them to your MAIA agent for AI processing, and injects the responses back into LinkedIn.

## Features

- **Automatic Message Detection**: Monitors LinkedIn messaging for new incoming DMs
- **AI-Powered Responses**: Uses your MAIA agent with SDR-specific prompts
- **Lead Qualification**: Applies ICP criteria to qualify leads
- **Meeting Booking**: Integrates with calendar tools to suggest and book meetings
- **Draft Mode**: Review AI responses before sending (recommended)
- **Active Hours**: Only respond during configured business hours
- **Lead Tracking**: Save qualified leads with BANT scores

## Installation

### Development Mode

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `extensions/linkedin-sdr` directory

### Production Mode

1. Build the extension: `npm run build:extension` (from project root)
2. The built extension will be in `extensions/linkedin-sdr/dist/`
3. Load the `dist` folder as an unpacked extension

## Setup

1. Click the MAIA SDR icon in your Chrome toolbar
2. Enter your MAIA server URL (e.g., `https://your-maia-domain.com`)
3. Click "Connect to MAIA"
4. Log in to your MAIA account when prompted
5. The extension will automatically authenticate and start working

## Configuration

Click the MAIA SDR icon or go to extension settings to configure:

### Response Behavior
- **SDR Active**: Enable/disable AI responses
- **Draft Mode**: Review messages before sending (recommended for safety)
- **Response Delay**: Seconds to wait before sending (simulates human typing)

### Active Hours
- **Limit to Active Hours**: Only respond during business hours
- **Business Hours**: Configure start and end times
- **Active Days**: Select which days the SDR should be active

### Advanced
- **Debug Mode**: Show detailed logs in browser console

## SDR Agent Configuration

For the best results, configure your MAIA agent with SDR-specific settings:

1. Go to MAIA Settings > Agent
2. Add SDR configuration to your agent's identity context:

```json
{
  "sdrConfig": {
    "companyName": "Your Company",
    "companyDescription": "Brief description of what you do",
    "industries": "Target industries",
    "elevatorPitch": "One-liner intro",
    "videoOverviewUrl": "https://youtu.be/yourVideo",
    "icpCriteria": [
      "B2B companies",
      "$10M+ revenue",
      "Department heads or executives"
    ],
    "icpPositiveSignals": [
      "Owns or runs a B2B company",
      "Mentions process pain"
    ],
    "icpNegativeSignals": [
      "Nonprofit",
      "Job seekers"
    ]
  }
}
```

## LinkedIn Terms of Service

**Important**: LinkedIn's Terms of Service prohibit automation tools. This extension:

- Simulates human behavior with configurable delays
- Uses draft mode by default for manual review
- Does not scrape or bulk-process data

**Recommendations**:
- Use draft mode to maintain control
- Keep response delays realistic (3+ seconds)
- Monitor your LinkedIn account for any warnings
- Use responsibly and at your own risk

## Troubleshooting

### Extension not detecting messages
1. Refresh the LinkedIn page
2. Check that the extension is enabled
3. Ensure you're on the messaging page (`/messaging/`)
4. Check the browser console for errors

### AI not responding
1. Verify you're connected to MAIA (check popup)
2. Ensure your token hasn't expired
3. Check MAIA server is accessible
4. Review browser console for API errors

### Responses not appearing
1. Check draft mode settings
2. Verify the message input field is detected
3. LinkedIn may have updated their DOM structure

## Support

- Documentation: https://docs.maia.ai/linkedin-sdr
- Email: support@maia.ai
- GitHub Issues: Create an issue in the MAIA repository

## License

This extension is part of the MAIA project. See the main repository for license details.

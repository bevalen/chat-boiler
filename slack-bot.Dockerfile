FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files needed for the bot
COPY scripts/start-slack-bot.ts ./scripts/
COPY lib/slack/ ./lib/slack/
COPY lib/types/database.ts ./lib/types/
COPY lib/supabase/admin.ts ./lib/supabase/
COPY lib/db/channel-credentials.ts ./lib/db/
COPY tsconfig.json ./

# Install tsx for running TypeScript
RUN npm install -g tsx

# Run the Slack bot
CMD ["tsx", "scripts/start-slack-bot.ts"]

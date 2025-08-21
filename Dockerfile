FROM node:20-bullseye

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /action

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Install Playwright browsers
RUN npx playwright install chromium

# Copy the rest of the application
COPY . .

# Pre-build the action
RUN npm run build

# Set the entrypoint
ENTRYPOINT ["node", "/action/dist/index.js"]
FROM mcr.microsoft.com/playwright:v1.54.1-focal

# Install Node.js 20
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /action

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy the rest of the application
COPY . .

# Pre-build the action
RUN npm run build

# Set the entrypoint
ENTRYPOINT ["node", "/action/dist/index.js"]
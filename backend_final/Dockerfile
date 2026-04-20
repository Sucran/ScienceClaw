FROM oven/bun:1-deps

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Expose port
EXPOSE 12001

# Start command
CMD ["bun", "run", "src/index.ts"]

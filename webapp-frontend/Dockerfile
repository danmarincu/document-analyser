# Use Node.js 22 as the base image
FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port
EXPOSE 8080

# Set environment variables with defaults
ENV PORT=8080

# Start the application
CMD ["node", "server.js"] 
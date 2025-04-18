FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Expose backend port
EXPOSE 5002

# Default command
CMD ["node", "src/index.js"]
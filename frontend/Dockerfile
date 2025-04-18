FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Set environment for CRA in Docker
ENV CHOKIDAR_USEPOLLING=true
ENV BROWSER=none

# Expose frontend port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
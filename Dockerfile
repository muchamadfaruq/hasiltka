FROM node:20-slim

# Set working directory inside the container
WORKDIR /usr/src/app

# Install build tools for native addon compilation
RUN apt-get update && apt-get install -y python3 build-essential sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci --omit=dev

# Copy the rest of the application files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD [ "npm", "start" ]

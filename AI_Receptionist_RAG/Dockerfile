# Use an official Node.js runtime as a parent image.
# 'alpine' is a lightweight version, which is great for production.
FROM node:20-alpine

# Install system dependencies (needed for some native Node modules)
RUN apk add --no-cache python3 make g++

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker's layer caching.
# This step only re-runs if these files change.
COPY package*.json ./

# Install dependencies (production only, with safe fallbacks)
RUN npm ci --omit=dev || npm install --only=production || npm install

# Copy the rest of your application source code (includes Docs folder for PDFs)
COPY . .

# Render sets PORT=10000 automatically; app listens on process.env.PORT
EXPOSE 9000 10000

# The command to start your application
CMD [ "node", "src/app.js" ]

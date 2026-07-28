# Use an official Node.js runtime as a parent image.
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for layer caching
COPY package*.json ./

# Install dependencies (omit dev for smaller image, safe fallback if omit flag unsupported)
RUN npm ci --omit=dev || npm install --only=production || npm install

# Copy the rest of your application's source code
COPY . .

# Render sets PORT=10000 automatically; app listens on process.env.PORT
EXPOSE 5000 10000

# The command to start your application
CMD [ "node", "src/app.js" ]

# Stage 1: Build the React application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Define build-time arguments that can be passed from docker-compose
# These are ONLY available during `docker build` (baked into the JS bundle)
ARG VITE_API_BASE_URL
ARG VITE_RAG_API_BASE_URL

# Set them as environment variables for the Vite build process
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_RAG_API_BASE_URL=${VITE_RAG_API_BASE_URL}

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci || npm install

# Copy the rest of the application source code
COPY . .

# Build the application for production (Vite reads VITE_* vars at build time)
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Install envsubst for runtime Nginx config templating (optional)
RUN apk add --no-cache libintl gettext

# Copy the build output from the builder stage to Nginx's web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy our custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

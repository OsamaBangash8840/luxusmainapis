FROM node:22-alpine

# Install dumb-init to properly handle PID 1 signal forwarding (SIGTERM / SIGINT)
RUN apk add --no-cache dumb-init

# Set production environment
ENV NODE_ENV=production

# Set working directory & ensure ownership
WORKDIR /home/node/app
RUN chown -R node:node /home/node/app

# Switch to unprivileged non-root user
USER node

# Install production dependencies only
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY --chown=node:node . .

# Expose internal API port
EXPOSE 8000

# Use dumb-init to ensure graceful shutdown signals reach Node.js
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]

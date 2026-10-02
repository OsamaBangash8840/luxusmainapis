FROM node:20-alpine

# Set non-root user
USER node

# Create app directory
RUN mkdir -p /home/node/app
WORKDIR /home/node/app

# Install dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY --chown=node:node . .

EXPOSE 8000

CMD [ "npm", "start" ]

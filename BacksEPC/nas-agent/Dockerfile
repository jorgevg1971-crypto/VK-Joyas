FROM node:18-alpine

# Install native zip package needed for compression on Linux
RUN apk add --no-cache zip

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY . .

# Default backups directory to be mounted as a volume
ENV BACKUP_ROOT_PATH=/backups
RUN mkdir -p /backups

EXPOSE 8283

CMD ["node", "index.js"]

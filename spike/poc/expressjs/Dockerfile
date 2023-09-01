FROM node:latest
WORKDIR /app

# COPY package.json and package-lock.json files
COPY package*.json ./

# generated prisma files
COPY prisma ./prisma/

# COPY ENV variable
COPY .env ./

RUN npm install

# COPY
COPY . .

RUN chmod +755 /app

CMD ["npm","start"]

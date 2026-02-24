FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# Fixed line — works without package-lock.json
RUN npm install --omit=dev
COPY . .
EXPOSE 10000
CMD ["npm", "start"]

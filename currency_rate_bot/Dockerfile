FROM node:20-alpine
# Рабочая директория внутри контейнера
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/src/main"]

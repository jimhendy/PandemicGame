FROM node as buildstage

WORKDIR app

COPY ./package.json ./
RUN npm install

FROM node
WORKDIR app
COPY . ./
COPY --from=buildstage /app/node_modules ./node_modules
CMD npm start
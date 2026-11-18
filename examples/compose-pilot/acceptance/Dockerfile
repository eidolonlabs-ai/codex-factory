FROM mcr.microsoft.com/playwright:v1.58.2-noble
WORKDIR /checks
RUN npm init -y && npm install --save-exact playwright@1.58.2
COPY acceptance/e2e.mjs ./e2e.mjs
CMD ["node", "e2e.mjs"]

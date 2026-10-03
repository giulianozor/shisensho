# KShisen Web - build the game and serve it on the network
#
# Stage 1 builds the static site with vite, stage 2 serves dist/ with nginx.
#
# SPDX-FileCopyrightText: 2016 Frederik Schwarzer <schwarzer@kde.org>
#
# SPDX-FileCopyrightText: 2026 Giuliano Zorzi
# SPDX-License-Identifier: GPL-2.0-or-later

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY tests ./tests
COPY tools ./tools
RUN npm run build


FROM nginx:1.27-alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
	CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
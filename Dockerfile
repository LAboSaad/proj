FROM registry.africell.cd/nginx:alpine

# BASE_PATH must match the pathname of VITE_UI_BASE_URL used during `npm run build`
# Examples:  /          (for http://localhost:80/)
#            /KYC/      (for https://example.com/KYC/)
ARG BASE_PATH=/

# Copy built assets into the matching subpath so nginx can find them
COPY dist/ /usr/share/nginx/html${BASE_PATH}

# Copy config as a template — envsubst will render it at container start
COPY default.conf /etc/nginx/conf.d/default.conf.template

# Make BASE_PATH available at runtime for envsubst
ENV NGINX_BASE_PATH=${BASE_PATH}

EXPOSE 80 443

# Substitute $NGINX_BASE_PATH into the nginx config, then start nginx
CMD ["/bin/sh", "-c", \
  "envsubst '$NGINX_BASE_PATH' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

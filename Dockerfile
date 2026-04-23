FROM eclipse-temurin:8-jre

# Install Node.js for the proxy
RUN apt-get update && apt-get install -y curl dos2unix && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /gateway

# Copy gateway files
COPY clientportal.gw/ .

# Use conf.yaml — gateway listens on port 5000 with SSL
COPY conf.yaml root/conf.yaml

# Copy proxy and startup script
COPY proxy.js proxy.js
COPY start.sh start.sh
RUN dos2unix start.sh && chmod +x start.sh

EXPOSE 10000

CMD ["./start.sh"]

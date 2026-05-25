# Build context: testpilot/ (monorepo root)
# Render config: Root Directory = testpilot, Dockerfile Path = apps/worker/Dockerfile

# Base image ships Gradle 8.5 + JDK 21 — gives us `gradle` on PATH for free.
FROM gradle:8.5-jdk21

USER root

# Install Node.js 22 via NodeSource
RUN apt-get update -y && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests first so npm install is cached when only source changes
COPY package.json package-lock.json* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

# Copy source and prisma schema
COPY apps/worker/ ./apps/worker/
COPY packages/shared/ ./packages/shared/
COPY prisma/ ./prisma/

# Generate Prisma client and compile TypeScript
RUN npx prisma generate --schema=prisma/schema.prisma && \
    npm run build --workspace=packages/shared && \
    npm run build --workspace=apps/worker

# Pre-warm the Gradle dependency cache so the first real test run doesn't
# spend minutes downloading JUnit from Maven Central.
RUN mkdir -p /tmp/gw/src/test/java && \
    printf 'plugins { java\njacoco }\nrepositories { mavenCentral() }\ndependencies { testImplementation("org.junit.jupiter:junit-jupiter:5.10.0")\ntestRuntimeOnly("org.junit.platform:junit-platform-launcher") }' \
    > /tmp/gw/build.gradle.kts && \
    echo 'rootProject.name = "warm"' > /tmp/gw/settings.gradle.kts && \
    cd /tmp/gw && gradle dependencies --no-daemon || true && \
    rm -rf /tmp/gw

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "apps/worker/dist/index.js"]

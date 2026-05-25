# Sandbox image for running Gradle + JaCoCo tests
# Based on the official Gradle image with JDK 21
FROM gradle:8.5-jdk21

# Run as non-root for security
USER gradle
WORKDIR /sandbox

# JaCoCo version pinned for reproducibility
ENV JACOCO_VERSION=0.8.11

# No CMD — container is run via dockerode exec, not as a long-lived process

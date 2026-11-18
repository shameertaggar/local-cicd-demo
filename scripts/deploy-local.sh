
#!/bin/bash

set -eu

APP_NAME="local-cicd-demo"
CONTAINER_NAME="local-cicd-demo"
OLD_CONTAINER="local-cicd-demo-previous"

IMAGE="${APP_NAME}:${BUILD_NUMBER}"
HOST_PORT=3000

echo "Starting deployment of ${IMAGE}"

# Remove an older backup container, if present
docker rm -f "$OLD_CONTAINER" >/dev/null 2>&1 || true

HAD_OLD=0

# Preserve the currently running version
if docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    docker rename "$CONTAINER_NAME" "$OLD_CONTAINER"
    HAD_OLD=1
    docker stop "$OLD_CONTAINER"
fi

# Rollback function
rollback() {
    echo "Deployment failed. Rolling back..."

    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

    if [ "$HAD_OLD" -eq 1 ]; then
        docker rename "$OLD_CONTAINER" "$CONTAINER_NAME"
        docker start "$CONTAINER_NAME"
        echo "Previous version restored."
    fi
}

# Start new application container
if ! docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "127.0.0.1:${HOST_PORT}:3000" \
    -e APP_VERSION="$BUILD_NUMBER" \
    "$IMAGE"; then

    rollback
    exit 1
fi

# Wait for Docker health check
HEALTHY=0

for i in $(seq 1 30); do

    STATUS=$(docker inspect \
        --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
        "$CONTAINER_NAME" 2>/dev/null || true)

    echo "Health status: $STATUS"

    if [ "$STATUS" = "healthy" ]; then
        HEALTHY=1
        break
    fi

    if [ "$STATUS" = "unhealthy" ]; then
        break
    fi

    sleep 2
done

# Verify deployment
if [ "$HEALTHY" -ne 1 ]; then
    docker logs "$CONTAINER_NAME" || true
    rollback
    exit 1
fi

# Update latest tag only after successful deployment
docker tag "$IMAGE" "${APP_NAME}:latest"

# Remove previous version
if [ "$HAD_OLD" -eq 1 ]; then
    docker rm -f "$OLD_CONTAINER"
fi

echo "Deployment successful!"
echo "Application URL: http://localhost:${HOST_PORT}"

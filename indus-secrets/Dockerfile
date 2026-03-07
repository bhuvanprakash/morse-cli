FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/indus-secrets ./cmd/server

FROM alpine:3.20
RUN adduser -D -H -u 10001 app
USER app
WORKDIR /app
COPY --from=builder /bin/indus-secrets /usr/local/bin/indus-secrets
EXPOSE 8013
ENTRYPOINT ["/usr/local/bin/indus-secrets"]

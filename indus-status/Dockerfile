FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/indus-status ./cmd/server

FROM alpine:3.20
RUN adduser -D -H -u 10001 app
USER app
WORKDIR /app
COPY --from=builder /bin/indus-status /usr/local/bin/indus-status
EXPOSE 8014
ENTRYPOINT ["/usr/local/bin/indus-status"]

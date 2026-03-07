FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /indus-notify ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates wget
COPY --from=builder /indus-notify /indus-notify
EXPOSE 8009
CMD ["/indus-notify"]

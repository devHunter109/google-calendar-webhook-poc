import fastify from "fastify"
import { logger } from "./logger"
import pino from "pino"

const server = fastify({
  logger: pino({
    level: "info",
    messageKey: "message",
    transport: {
      target: "pino-pretty",
    },
  }),
})

server.listen({ port: 3031 }, (error, address) => {
  if (error) {
    console.error("Server initialization failed.", error)
    process.exit(1)
  }

  logger.info("Server listening at ", address)
})

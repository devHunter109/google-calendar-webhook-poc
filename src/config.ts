import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

type Config = {
  port: number
  google: {
    clientId: string
    secret: string
    redirectUri: string
  }
  ngrokUrl: string
  calendarId: string
}

const config: Config = {
  google: {
    clientId: process.env["GOOGLE_CLIENT_ID"] ?? '',
    secret: process.env["GOOGLE_CLIENT_SECRET"] ?? '',
    redirectUri: "",
  },
  port: 3000,
  ngrokUrl: process.env["NGROK_URL"] ?? '',
  calendarId: process.env["CALENDAR_ID"] ?? '',
}

// Add validation to ensure required env vars are present
const validateConfig = () => {
  if (!config.google.clientId) {
    throw new Error('GOOGLE_CLIENT_ID is required')
  }
  if (!config.google.secret) {
    throw new Error('GOOGLE_CLIENT_SECRET is required')
  }
}

validateConfig()

export const setServerAddress = (serverAddress: string) =>
  (config.google.redirectUri = `${serverAddress}/redirect`)

export const getConfig = (): Readonly<Config> => Object.freeze(config)

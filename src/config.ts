type Config = {
  port: number
  google: {
    clientId: string
    secret: string
    redirectUri: string
  }
}

const config: Config = {
  google: {
    clientId: process.env["GOOGLE_CLIENT_ID"]!,
    secret: process.env["GOOGLE_CLIENT_SECRET"]!,
    redirectUri: "",
  },
  port: 3031,
}

export const setServerAddress = (serverAddress: string) =>
  (config.google.redirectUri = `${serverAddress}/redirect`)

export const getConfig = (): Readonly<Config> => Object.freeze(config)

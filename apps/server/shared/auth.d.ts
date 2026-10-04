declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    role: string
  }

  interface UserSession {
    loggedInAt: number
  }
}

export {}

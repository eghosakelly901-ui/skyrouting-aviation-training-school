const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()

if (!apiBaseUrl) {
  throw new Error(
    'VITE_API_BASE_URL is missing. Configure the backend URL.'
  )
}

export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, '')
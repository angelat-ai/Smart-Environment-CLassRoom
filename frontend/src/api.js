import axios from 'axios'

const API_BASE = 'http://127.0.0.1:8000/api'

const api = axios.create({ baseURL: API_BASE })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const res = await axios.post(`${API_BASE}/token/refresh/`, { refresh })
          localStorage.setItem('access_token', res.data.access)
          err.config.headers.Authorization = `Bearer ${res.data.access}`
          return api(err.config)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.reload()
        }
      }
    }
    return Promise.reject(err)
  }
)

export const loginUser = async (username, password) => {
  const res = await axios.post(`${API_BASE}/token/`, { username, password })
  localStorage.setItem('access_token', res.data.access)
  localStorage.setItem('refresh_token', res.data.refresh)
  return res.data
}

export const logoutUser = () => {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export const registerUser = async (data) => {
  const res = await axios.post(`${API_BASE}/register/`, data)
  return res.data
}

export const verifyOTP = async (email, otp) => {
  const res = await axios.post(`${API_BASE}/verify-otp/`, { email, otp })
  localStorage.setItem('access_token', res.data.access)
  localStorage.setItem('refresh_token', res.data.refresh)
  return res.data
}

export const fetchRooms = async () => {
  const res = await api.get('/rooms/')
  return res.data
}

export const simulateMotion = async (room) => {
  const res = await api.post('/simulate/', { room, event: 'Lights ON', source: 'simulator' })
  return res.data
}

export const simulateLightsOff = async (room) => {
  const res = await api.post('/simulate/', { room, event: 'Lights OFF', source: 'simulator' })
  return res.data
}

export const fetchRoomHistory = async (room, year, month, day) => {
  const res = await api.get(`/history/${room}/${year}/${month}/${day}/`)
  return res.data
}

export const fetchCurrentUser = async () => {
  const res = await api.get('/user/')
  return res.data
}

export const isAuthenticated = () => !!localStorage.getItem('access_token')

export default api
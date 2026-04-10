import axios from 'axios'

const API_BASE = 'http://127.0.0.1:8000/api'

export const fetchRooms = async () => {
  const response = await axios.get(`${API_BASE}/rooms/`)
  return response.data
}

export const simulateMotion = async (room) => {
  const response = await axios.post(`${API_BASE}/simulate/`, { room, source: 'simulator' })
  return response.data
}

export const fetchRoomHistory = async (room, year, month, day) => {
  const response = await axios.get(`${API_BASE}/history/${room}/${year}/${month}/${day}/`)
  return response.data
}
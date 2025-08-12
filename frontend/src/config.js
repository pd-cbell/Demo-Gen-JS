const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5002/api';
if (!process.env.REACT_APP_API_BASE_URL) {
  console.warn('REACT_APP_API_BASE_URL is not set. Falling back to http://localhost:5002/api');
}
export default API_BASE;


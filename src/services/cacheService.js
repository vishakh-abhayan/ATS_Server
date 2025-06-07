const redis = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connect();
  }

  async connect() {
    try {
      if (process.env.REDIS_URL) {
        this.client = redis.createClient({
          url: process.env.REDIS_URL
        });
        
        this.client.on('error', (err) => {
          console.error('Redis Client Error:', err);
          this.isConnected = false;
        });
        
        this.client.on('connect', () => {
          console.log('Redis Client Connected');
          this.isConnected = true;
        });
        
        await this.client.connect();
      }
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
     return false;
   }
 }

 async del(key) {
   if (!this.isConnected) return false;
   
   try {
     await this.client.del(key);
     return true;
   } catch (error) {
     console.error('Cache delete error:', error);
     return false;
   }
 }
}

module.exports = new CacheService();